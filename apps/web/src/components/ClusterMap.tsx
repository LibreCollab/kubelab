import {
  isPodReady,
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeNode,
  type KubeReplicaSet,
  type KubeSecret,
  type KubeService,
  matchesLabels,
  type Pod,
} from "@kubelab/sim";
import { useEffect } from "react";
import { createPortal } from "react-dom";

import styles from "./cluster-map.module.scss";

const MAX_VISIBLE_PODS = 10;

export interface ClusterMapProps {
  nodes: KubeNode[];
  deployments: KubeDeployment[];
  replicaSets: KubeReplicaSet[];
  pods: Pod[];
  services: KubeService[];
  ingresses: KubeIngress[];
  configMaps: KubeConfigMap[];
  secrets: KubeSecret[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function key(namespace: string, name: string): string {
  return `${namespace}/${name}`;
}

function objectName(object: { metadata: { name: string; namespace: string } }): string {
  return object.metadata.namespace === "default"
    ? object.metadata.name
    : `${object.metadata.namespace}/${object.metadata.name}`;
}

function podState(pod: Pod): string {
  if (isPodReady(pod)) {
    return "running";
  }
  return pod.status.phase === "Running" ? "not-ready" : pod.status.phase.toLowerCase();
}

function selectorLabel(selector: Record<string, string>): string {
  const entries = Object.entries(selector).sort(([left], [right]) => left.localeCompare(right));
  return entries.length === 0
    ? "no selector"
    : entries.map(([name, value]) => `${name}=${value}`).join(",");
}

function PodChips({ pods }: { pods: Pod[] }) {
  const visible = pods.slice(0, MAX_VISIBLE_PODS);
  const hidden = pods.length - visible.length;

  if (pods.length === 0) {
    return <span className={styles.noPods}>no pods</span>;
  }

  return (
    <ul className={styles.pods} aria-label={`${pods.length} pods`}>
      {visible.map((pod) => (
        <li
          key={key(pod.metadata.namespace, pod.metadata.name)}
          className={styles.pod}
          data-map-pod
          data-state={podState(pod)}
          title={`${pod.metadata.name} · ${pod.status.phase}`}
        >
          <span className={styles.podDot} aria-hidden="true" />
          <span className={styles.podName}>{pod.metadata.name}</span>
          <span className={styles.srOnly}>{pod.status.phase}</span>
        </li>
      ))}
      {hidden > 0 ? <li className={styles.more}>+{hidden}</li> : null}
    </ul>
  );
}

function ReplicaSetRow({ replicaSet, pods }: { replicaSet: KubeReplicaSet; pods: Pod[] }) {
  const ready = pods.filter(isPodReady).length;
  const state =
    replicaSet.spec.replicas === 0
      ? "retired"
      : ready >= replicaSet.spec.replicas
        ? "ready"
        : "progressing";

  return (
    <div
      className={styles.replicaSet}
      data-object="replicaset"
      data-testid={`cluster-replicaset-${replicaSet.metadata.name}`}
      data-state={state}
    >
      <div className={styles.replicaSetHead}>
        <span>r{replicaSet.spec.revision}</span>
        <span className={styles.hash}>
          {replicaSet.metadata.labels["pod-template-hash"] ?? "hash"}
        </span>
        <span className={styles.count}>
          {ready}/{replicaSet.spec.replicas}
        </span>
        <span className={styles.srOnly}>{state}</span>
      </div>
      <PodChips pods={pods} />
    </div>
  );
}

export function ClusterMap({
  nodes,
  deployments,
  replicaSets,
  pods,
  services,
  ingresses,
  configMaps,
  secrets,
  open,
  onOpenChange,
}: ClusterMapProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", close);
    };
  }, [onOpenChange, open]);

  const replicaSetsByDeployment = new Map<string, KubeReplicaSet[]>();
  const replicaSetKeys = new Set<string>();
  for (const replicaSet of replicaSets) {
    const deploymentName = replicaSet.metadata.labels.deployment;
    const hash = replicaSet.metadata.labels["pod-template-hash"];
    if (deploymentName === undefined || hash === undefined) {
      continue;
    }
    const grouping = key(replicaSet.metadata.namespace, deploymentName);
    const existing = replicaSetsByDeployment.get(grouping) ?? [];
    existing.push(replicaSet);
    replicaSetsByDeployment.set(grouping, existing);
    replicaSetKeys.add(key(replicaSet.metadata.namespace, `${deploymentName}/${hash}`));
  }

  const podsByReplicaSet = new Map<string, Pod[]>();
  const managedPods = new Set<string>();
  for (const pod of pods) {
    const deploymentName = pod.metadata.labels.deployment;
    const hash = pod.metadata.labels["pod-template-hash"];
    if (deploymentName === undefined || hash === undefined) {
      continue;
    }
    const grouping = key(pod.metadata.namespace, `${deploymentName}/${hash}`);
    if (!replicaSetKeys.has(grouping)) {
      continue;
    }
    const existing = podsByReplicaSet.get(grouping) ?? [];
    existing.push(pod);
    podsByReplicaSet.set(grouping, existing);
    managedPods.add(key(pod.metadata.namespace, pod.metadata.name));
  }

  const standalonePods = pods.filter(
    (pod) => !managedPods.has(key(pod.metadata.namespace, pod.metadata.name)),
  );
  const runningPods = pods.filter(isPodReady).length;
  const pendingPods = pods.filter((pod) => pod.status.phase === "Pending").length;
  const readyNodes = nodes.filter((node) => node.status.ready).length;
  const hasWorkloads = deployments.length > 0 || standalonePods.length > 0;
  const hasRouting = services.length > 0 || ingresses.length > 0;
  const hasConfig = configMaps.length > 0 || secrets.length > 0;
  const hasResources = hasWorkloads || hasRouting || hasConfig;

  const clusterState =
    readyNodes < nodes.length ? "not-ready" : pendingPods > 0 ? "pending" : "ready";
  const summary = `${pods.length} pod${pods.length === 1 ? "" : "s"} · ${services.length} svc`;

  return (
    <>
      <button
        type="button"
        className={styles.statusChip}
        data-testid="cluster-status"
        data-state={clusterState}
        data-pods={pods.length}
        data-running={runningPods}
        data-deployments={deployments.length}
        data-services={services.length}
        data-ingresses={ingresses.length}
        data-configmaps={configMaps.length}
        data-secrets={secrets.length}
        aria-label={`Open cluster state: ${summary}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="cluster-drawer"
        onClick={() => onOpenChange(true)}
      >
        <span className={styles.statusDot} aria-hidden="true" />
        <span>{summary}</span>
      </button>

      {open
        ? createPortal(
            <>
              <div
                className={styles.scrim}
                aria-hidden="true"
                onClick={() => onOpenChange(false)}
              />
              <aside
                id="cluster-drawer"
                className={styles.popup}
                role="dialog"
                aria-modal="true"
                aria-label="Live cluster state"
                data-testid="cluster-map"
                data-pods={pods.length}
                data-running={runningPods}
                data-deployments={deployments.length}
                data-services={services.length}
                data-ingresses={ingresses.length}
                data-configmaps={configMaps.length}
                data-secrets={secrets.length}
              >
                <header className={styles.mapHead}>
                  <div>
                    <h2>Cluster state</h2>
                    <p>
                      {readyNodes}/{nodes.length} nodes · {pods.length} pods · {services.length} svc
                      {ingresses.length > 0 ? ` · ${ingresses.length} ingress` : ""}
                    </p>
                  </div>
                  <div className={styles.headActions}>
                    <div className={styles.legend} aria-hidden="true">
                      <span data-tone="running">running</span>
                      <span data-tone="pending">pending</span>
                      <span data-tone="retired">retired</span>
                    </div>
                    <button
                      type="button"
                      className={styles.closeButton}
                      aria-label="Close cluster state"
                      onClick={() => onOpenChange(false)}
                    >
                      Close
                    </button>
                  </div>
                </header>
                <section className={styles.mapBody} aria-label="Cluster resources">
                  <div className={styles.nodes}>
                    {nodes.map((node) => {
                      const assigned = pods.filter(
                        (pod) => pod.spec.nodeName === node.metadata.name,
                      ).length;
                      return (
                        <div
                          key={node.metadata.name}
                          className={styles.node}
                          data-testid={`cluster-node-${node.metadata.name}`}
                          data-state={node.status.ready ? "ready" : "not-ready"}
                        >
                          <span className={styles.nodeDot} aria-hidden="true" />
                          <span className={styles.nodeName}>{node.metadata.name}</span>
                          <span className={styles.nodeMeta}>
                            {assigned} pod{assigned === 1 ? "" : "s"} ·{" "}
                            {node.status.allocatable.cpu} CPU · {node.status.allocatable.memory}
                          </span>
                          <span className={styles.srOnly}>
                            {node.status.ready ? "Ready" : "Not ready"}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {!hasResources ? (
                    <div className={styles.empty}>
                      <strong>No workloads yet</strong>
                      <span>
                        Run <code>kubectl run web --image=nginx</code> or create a Deployment to
                        populate the graph.
                      </span>
                    </div>
                  ) : null}

                  {hasWorkloads ? (
                    <section className={styles.group} aria-label="Workloads">
                      <div className={styles.sectionHead}>
                        <span>Workloads</span>
                        <span>
                          {runningPods} running{pendingPods > 0 ? ` · ${pendingPods} pending` : ""}
                        </span>
                      </div>
                      <div className={styles.cards}>
                        {deployments.map((deployment) => {
                          const replicaSetsForDeployment = [
                            ...(replicaSetsByDeployment.get(
                              key(deployment.metadata.namespace, deployment.metadata.name),
                            ) ?? []),
                          ].sort((left, right) => right.spec.revision - left.spec.revision);
                          const deploymentPods = pods.filter(
                            (pod) =>
                              pod.metadata.namespace === deployment.metadata.namespace &&
                              pod.metadata.labels.deployment === deployment.metadata.name,
                          );
                          const ready = deployment.status.readyReplicas;
                          const state =
                            deployment.spec.replicas === 0
                              ? "retired"
                              : ready >= deployment.spec.replicas
                                ? "ready"
                                : "progressing";

                          return (
                            <article
                              key={key(deployment.metadata.namespace, deployment.metadata.name)}
                              className={styles.deployment}
                              data-object="deployment"
                              data-testid={`cluster-deployment-${deployment.metadata.name}`}
                              data-state={state}
                            >
                              <div className={styles.deploymentHead}>
                                <div>
                                  <span className={styles.kind}>Deployment</span>
                                  <strong>{objectName(deployment)}</strong>
                                </div>
                                <span className={styles.count}>
                                  {ready}/{deployment.spec.replicas}
                                </span>
                              </div>
                              <p className={styles.image}>
                                {deployment.spec.template.containers
                                  .map((container) => container.image)
                                  .join(", ")}
                              </p>
                              <span className={styles.srOnly}>{state}</span>
                              <div className={styles.replicaSets}>
                                {replicaSetsForDeployment.length === 0 ? (
                                  <span className={styles.waiting}>waiting for ReplicaSet</span>
                                ) : (
                                  replicaSetsForDeployment.map((replicaSet) => (
                                    <ReplicaSetRow
                                      key={key(
                                        replicaSet.metadata.namespace,
                                        replicaSet.metadata.name,
                                      )}
                                      replicaSet={replicaSet}
                                      pods={
                                        podsByReplicaSet.get(
                                          key(
                                            replicaSet.metadata.namespace,
                                            `${replicaSet.metadata.labels.deployment}/${replicaSet.metadata.labels["pod-template-hash"]}`,
                                          ),
                                        ) ?? []
                                      }
                                    />
                                  ))
                                )}
                              </div>
                              {deploymentPods.length === 0 ? (
                                <span className={styles.waiting}>no pods scheduled</span>
                              ) : null}
                            </article>
                          );
                        })}

                        {standalonePods.length > 0 ? (
                          <article
                            className={styles.deployment}
                            data-object="pods"
                            data-testid="cluster-standalone-pods"
                            data-state={standalonePods.every(isPodReady) ? "ready" : "progressing"}
                          >
                            <div className={styles.deploymentHead}>
                              <div>
                                <span className={styles.kind}>Pods</span>
                                <strong>standalone</strong>
                              </div>
                              <span className={styles.count}>
                                {
                                  standalonePods.filter((pod) => pod.status.phase === "Running")
                                    .length
                                }
                                /{standalonePods.length}
                              </span>
                            </div>
                            <PodChips pods={standalonePods} />
                          </article>
                        ) : null}
                      </div>
                    </section>
                  ) : null}

                  {hasRouting ? (
                    <section className={styles.group} aria-label="Routing">
                      <div className={styles.sectionHead}>
                        <span>Routing</span>
                        <span>
                          {ingresses.length} ingress · {services.length} services
                        </span>
                      </div>
                      <div className={styles.cards}>
                        {ingresses.map((ingress) => (
                          <article
                            key={key(ingress.metadata.namespace, ingress.metadata.name)}
                            className={`${styles.service} ${styles.ingress}`}
                            data-object="ingress"
                            data-testid={`cluster-ingress-${ingress.metadata.name}`}
                          >
                            <div className={styles.deploymentHead}>
                              <div>
                                <span className={styles.kind}>Ingress</span>
                                <strong>{objectName(ingress)}</strong>
                              </div>
                              <span className={styles.count}>
                                {ingress.spec.rules.length} rule
                                {ingress.spec.rules.length === 1 ? "" : "s"}
                              </span>
                            </div>
                            {ingress.spec.rules.map((rule) => {
                              const service = services.find(
                                (candidate) =>
                                  candidate.metadata.namespace === ingress.metadata.namespace &&
                                  candidate.metadata.name === rule.serviceName,
                              );
                              const endpoints =
                                service === undefined
                                  ? []
                                  : pods.filter(
                                      (pod) =>
                                        Object.keys(service.spec.selector).length > 0 &&
                                        pod.metadata.namespace === service.metadata.namespace &&
                                        isPodReady(pod) &&
                                        matchesLabels(pod.metadata.labels, service.spec.selector),
                                    );
                              return (
                                <p
                                  key={`${rule.host}${rule.path}`}
                                  className={styles.selector}
                                  data-service={rule.serviceName}
                                  data-endpoints={endpoints.length}
                                >
                                  {rule.host}
                                  {rule.path} → {rule.serviceName}:{rule.servicePort} ·{" "}
                                  {endpoints.length} ep
                                </p>
                              );
                            })}
                          </article>
                        ))}

                        {services.map((service) => {
                          const endpoints =
                            Object.keys(service.spec.selector).length === 0
                              ? []
                              : pods.filter(
                                  (pod) =>
                                    pod.metadata.namespace === service.metadata.namespace &&
                                    isPodReady(pod) &&
                                    matchesLabels(pod.metadata.labels, service.spec.selector),
                                );
                          const port = service.spec.ports[0];

                          return (
                            <article
                              key={key(service.metadata.namespace, service.metadata.name)}
                              className={styles.service}
                              data-object="service"
                              data-testid={`cluster-service-${service.metadata.name}`}
                              data-endpoints={endpoints.length}
                            >
                              <div className={styles.deploymentHead}>
                                <div>
                                  <span className={styles.kind}>{service.spec.type}</span>
                                  <strong>{objectName(service)}</strong>
                                </div>
                                <span className={styles.count}>{endpoints.length} ep</span>
                              </div>
                              <p className={styles.selector}>
                                {service.spec.clusterIP}:{port?.port ?? 80} →{" "}
                                {selectorLabel(service.spec.selector)}
                              </p>
                              {endpoints.length === 0 ? (
                                <span className={styles.waiting}>no ready endpoints</span>
                              ) : (
                                <div className={styles.endpoints}>
                                  {endpoints.slice(0, MAX_VISIBLE_PODS).map((pod) => (
                                    <span
                                      key={key(pod.metadata.namespace, pod.metadata.name)}
                                      className={styles.endpoint}
                                    >
                                      {pod.status.podIP ?? "<none>"}:
                                      {port?.targetPort ?? port?.port ?? 80}
                                    </span>
                                  ))}
                                  {endpoints.length > MAX_VISIBLE_PODS ? (
                                    <span className={styles.more}>
                                      +{endpoints.length - MAX_VISIBLE_PODS}
                                    </span>
                                  ) : null}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {hasConfig ? (
                    <section className={styles.group} aria-label="Configuration">
                      <div className={styles.sectionHead}>
                        <span>Configuration</span>
                        <span>
                          {configMaps.length} configmap{configMaps.length === 1 ? "" : "s"} ·{" "}
                          {secrets.length} secret{secrets.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className={styles.cards}>
                        {configMaps.map((configMap) => (
                          <article
                            key={key(configMap.metadata.namespace, configMap.metadata.name)}
                            className={`${styles.service} ${styles.configMap}`}
                            data-object="configmap"
                            data-testid={`cluster-configmap-${configMap.metadata.name}`}
                            data-keys={Object.keys(configMap.data).length}
                          >
                            <div className={styles.deploymentHead}>
                              <div>
                                <span className={styles.kind}>ConfigMap</span>
                                <strong>{objectName(configMap)}</strong>
                              </div>
                              <span className={styles.count}>
                                {Object.keys(configMap.data).length} keys
                              </span>
                            </div>
                            <p className={styles.selector}>
                              {Object.keys(configMap.data).join(", ")}
                            </p>
                          </article>
                        ))}
                        {secrets.map((secret) => (
                          <article
                            key={key(secret.metadata.namespace, secret.metadata.name)}
                            className={`${styles.service} ${styles.secret}`}
                            data-object="secret"
                            data-testid={`cluster-secret-${secret.metadata.name}`}
                            data-keys={Object.keys(secret.data).length}
                          >
                            <div className={styles.deploymentHead}>
                              <div>
                                <span className={styles.kind}>Secret</span>
                                <strong>{objectName(secret)}</strong>
                              </div>
                              <span className={styles.count}>
                                {Object.keys(secret.data).length} keys
                              </span>
                            </div>
                            <p className={styles.selector}>
                              {Object.keys(secret.data).join(", ")} · values redacted
                            </p>
                          </article>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </section>
              </aside>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
