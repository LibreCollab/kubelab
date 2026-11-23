import {
  type KubeDeployment,
  type KubeNode,
  type KubeReplicaSet,
  type KubeService,
  matchesLabels,
  type Pod,
} from "@kubelab/sim";
import styles from "./cluster-map.module.scss";

const MAX_VISIBLE_PODS = 10;

export interface ClusterMapProps {
  nodes: KubeNode[];
  deployments: KubeDeployment[];
  replicaSets: KubeReplicaSet[];
  pods: Pod[];
  services: KubeService[];
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
  return pod.status.phase === "Running" ? "running" : pod.status.phase.toLowerCase();
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
  const ready = pods.filter((pod) => pod.status.phase === "Running").length;
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

export function ClusterMap({ nodes, deployments, replicaSets, pods, services }: ClusterMapProps) {
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
  const runningPods = pods.filter((pod) => pod.status.phase === "Running").length;
  const pendingPods = pods.filter((pod) => pod.status.phase === "Pending").length;
  const readyNodes = nodes.filter((node) => node.status.ready).length;
  const hasWorkloads = deployments.length > 0 || standalonePods.length > 0;

  return (
    <section
      className={styles.map}
      data-testid="cluster-map"
      aria-label="Live cluster state"
      data-pods={pods.length}
      data-running={runningPods}
      data-deployments={deployments.length}
      data-services={services.length}
    >
      <header className={styles.mapHead}>
        <div>
          <h2>Cluster state</h2>
          <p>
            {readyNodes}/{nodes.length} nodes ready · {pods.length} pods · {services.length} service
            {services.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span data-tone="running">running</span>
          <span data-tone="pending">pending</span>
          <span data-tone="retired">retired</span>
        </div>
      </header>

      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the scrollable cluster map must be keyboard reachable */}
      <section className={styles.mapBody} tabIndex={0} aria-label="Cluster resources">
        <div className={styles.nodes}>
          {nodes.map((node) => {
            const assigned = pods.filter((pod) => pod.spec.nodeName === node.metadata.name).length;
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
                  {assigned} pod{assigned === 1 ? "" : "s"} · {node.status.allocatable.cpu} CPU ·{" "}
                  {node.status.allocatable.memory}
                </span>
                <span className={styles.srOnly}>{node.status.ready ? "Ready" : "Not ready"}</span>
              </div>
            );
          })}
        </div>

        <div className={styles.sectionHead}>
          <span>Workloads</span>
          <span>
            {runningPods} running{pendingPods > 0 ? ` · ${pendingPods} pending` : ""}
          </span>
        </div>

        {hasWorkloads ? (
          <div className={styles.workloads}>
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
                          key={key(replicaSet.metadata.namespace, replicaSet.metadata.name)}
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
                data-state={
                  standalonePods.every((pod) => pod.status.phase === "Running")
                    ? "ready"
                    : "progressing"
                }
              >
                <div className={styles.deploymentHead}>
                  <div>
                    <span className={styles.kind}>Pods</span>
                    <strong>standalone</strong>
                  </div>
                  <span className={styles.count}>
                    {standalonePods.filter((pod) => pod.status.phase === "Running").length}/
                    {standalonePods.length}
                  </span>
                </div>
                <PodChips pods={standalonePods} />
              </article>
            ) : null}
          </div>
        ) : (
          <p className={styles.empty}>Run a workload to populate the cluster graph.</p>
        )}

        <div className={styles.sectionHead}>
          <span>Services</span>
          <span>{services.length} total</span>
        </div>

        {services.length === 0 ? (
          <p className={styles.empty}>No Services exposed yet.</p>
        ) : (
          <div className={styles.services}>
            {services.map((service) => {
              const endpoints =
                Object.keys(service.spec.selector).length === 0
                  ? []
                  : pods.filter(
                      (pod) =>
                        pod.metadata.namespace === service.metadata.namespace &&
                        pod.status.phase === "Running" &&
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
                          {pod.status.podIP ?? "<none>"}:{port?.targetPort ?? port?.port ?? 80}
                        </span>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
