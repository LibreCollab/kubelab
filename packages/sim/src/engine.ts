import { parseAllDocuments, stringify as stringifyYaml } from "yaml";
import { VirtualClock } from "./clock";
import { resolveServiceDns } from "./dns";
import { EventBus } from "./events";
import { MAX_REPLICAS, type ParsedCommand, parseCommand } from "./kubectl";
import { filterPods, isPodReady, matchesLabels, type PodFilter } from "./selectors";

import { ClusterStore } from "./store";
import type {
  CommandResult,
  ContainerStatus,
  KubeApplication,
  KubeConfigMap,
  KubeCronJob,
  KubeDaemonSet,
  KubeDeployment,
  KubeEvent,
  KubeHelmRelease,
  KubeHorizontalPodAutoscaler,
  KubeIngress,
  KubeJob,
  KubeLimitRange,
  KubeNamespace,
  KubeNetworkPolicy,
  KubeNode,
  KubeObject,
  KubePersistentVolume,
  KubePersistentVolumeClaim,
  KubePodDisruptionBudget,
  KubeReplicaSet,
  KubeResourceQuota,
  KubeRole,
  KubeRoleBinding,
  KubeSecret,
  KubeService,
  KubeStatefulSet,
  KubeStorageClass,
  KubeWidget,
  NetworkPolicyPeer,
  NetworkPolicyPort,
  NodeSelectorRequirement,
  Pod,
  PodTemplate,
  ProbeState,
  Scenario,
} from "./types";

export interface SimEngineOptions {
  intervalMs?: number;
}

const HELP = `kubectl controls the Kubelab simulated cluster.

Supported in this scaffold:
  kubectl get pods|deployments|replicasets|services|endpoints|ingresses|configmaps|secrets
  kubectl get pv|pvc|storageclass|networkpolicy|serviceaccount|role|rolebinding|namespace|hpa|events
  kubectl get nodes [name] [-o yaml]
  kubectl top pods|nodes
  kubectl run <name> --image=<image> [--labels=key=value]
  kubectl create deployment <name> --image=<image> [--replicas=N]
  kubectl create configmap <name> --from-literal=KEY=VALUE
  kubectl create secret generic <name> --from-literal=KEY=VALUE
  kubectl create ingress <name> --rule=host/path=service:port
  kubectl exec <pod> [-n ns] -- <command> [args...]
  kubectl logs <pod> [-c container] [-n ns]
  kubectl auth can-i <verb> <resource> [--as=<subject>]
  kubectl expose deployment|pod <name> --port=80 [--type=ClusterIP]
  kubectl scale deployment <name> --replicas=N
  kubectl set image deployment/<name> <container>=<image>
  kubectl set env deployment/<name> --from=configmap|secret/<name>
  kubectl rollout status|undo deployment/<name>
  kubectl apply -f <file> | -k <dir>
  kubectl describe pod|deployment|service|ingress|node|pvc|networkpolicy|role|rolebinding|namespace|hpa <name>
  helm list|status|history
  argocd app list|get
  kubectl kustomize <dir>
  kubectl delete pod|deployment|service|ingress|configmap|secret <name>
  kubectl help

Coming next: apply, volumes, storage, ingress backends.`;

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function decodeBase64(value: string): string {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
}

function matchesIngressPath(rulePath: string, requestPath: string): boolean {
  if (rulePath === "/") {
    return true;
  }
  if (requestPath === rulePath) {
    return true;
  }
  return requestPath.startsWith(rulePath.endsWith("/") ? rulePath : `${rulePath}/`);
}

function formatLabels(labels: Record<string, string>): string {
  const entries = Object.entries(labels).sort(([left], [right]) => left.localeCompare(right));
  return entries.length === 0
    ? "<none>"
    : entries.map(([key, value]) => `${key}=${value}`).join(",");
}

function templateHash(template: PodTemplate): string {
  const containers = template.containers
    .map((container) => {
      const env = (container.env ?? [])
        .map((variable) => `${variable.name}=${variable.value}`)
        .join("&");
      const envFrom = (container.envFrom ?? [])
        .map((source) => `${source.kind}:${source.name}`)
        .join("&");
      return `${container.name}:${container.image}[${env}][${envFrom}]`;
    })
    .join(",");
  const labels = Object.entries(template.labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join(",");
  const text = `${labels}|${containers}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).slice(0, 6);
}

function toleratesTaint(pod: Pod, taint: { key: string; value?: string; effect: string }): boolean {
  if (taint.effect !== "NoSchedule" && taint.effect !== "NoExecute") {
    return true;
  }

  return (pod.spec.tolerations ?? []).some((toleration) => {
    if (toleration.effect !== undefined && toleration.effect !== taint.effect) {
      return false;
    }
    if (toleration.operator === "Exists") {
      return toleration.key === undefined || toleration.key === taint.key;
    }
    return (
      toleration.key === taint.key &&
      (toleration.value === undefined || toleration.value === taint.value)
    );
  });
}

function nodeMatchesPod(node: KubeNode, pod: Pod): boolean {
  const selector = pod.spec.nodeSelector ?? {};
  if (!Object.entries(selector).every(([key, value]) => node.metadata.labels[key] === value)) {
    return false;
  }
  return (node.spec?.taints ?? []).every((taint) => toleratesTaint(pod, taint));
}

function resolveStrategyCount(
  value: number | string | undefined,
  desired: number,
  fallback: number,
): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value === "number") {
    return Math.max(0, value);
  }
  const percent = /^(\d+)%$/.exec(value);
  if (percent !== null) {
    return Math.max(0, Math.ceil((desired * Number(percent[1])) / 100));
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : Math.max(0, parsed);
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [network, bitsText] = cidr.split("/");
  const bits = Number(bitsText);
  if (network === undefined || Number.isNaN(bits)) {
    return false;
  }
  const ipParts = ip.split(".").map(Number);
  const networkParts = network.split(".").map(Number);
  if (ipParts.length !== 4 || networkParts.length !== 4) {
    return false;
  }
  const ipValue = ipParts.reduce((value, part) => (value << 8) | part, 0) >>> 0;
  const networkValue = networkParts.reduce((value, part) => (value << 8) | part, 0) >>> 0;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipValue & mask) === (networkValue & mask);
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function parseCpuMillis(value: string): number {
  if (value.endsWith("m")) {
    return Number(value.slice(0, -1)) || 1000;
  }
  return (Number(value) || 1) * 1000;
}

function parseMemoryBytes(value: string): number {
  const units: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
  };
  const match = /^(\d+(?:\.\d+)?)([KMGT]i)?$/.exec(value);
  if (match === null) {
    return 1024 ** 3;
  }
  return Number(match[1]) * (match[2] === undefined ? 1 : (units[match[2]] ?? 1));
}

function formatTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...rows.map((row) => (row[index] ?? "").length)),
  );

  const renderRow = (row: string[]): string =>
    row
      .map((cell, index) => cell.padEnd(widths[index] ?? 0))
      .join("   ")
      .trimEnd();

  return [renderRow(headers), ...rows.map(renderRow)].join("\n");
}

function notFound(resource: string, name: string): CommandResult {
  return {
    ok: false,
    output: `Error from server (NotFound): ${resource} "${name}" not found`,
  };
}

function notSimulated(action: string, resource: string): CommandResult {
  return { ok: false, output: `error: ${action} ${resource} is not simulated yet` };
}

function normalizeEnvFrom(containers: unknown): void {
  if (!Array.isArray(containers)) {
    return;
  }
  for (const container of containers) {
    if (typeof container !== "object" || container === null) {
      continue;
    }
    const value = container as Record<string, unknown>;
    if (!Array.isArray(value.envFrom)) {
      continue;
    }
    value.envFrom = value.envFrom.flatMap((source) => {
      if (typeof source !== "object" || source === null) {
        return [];
      }
      const entry = source as Record<string, unknown>;
      const configMapRef = entry.configMapRef as Record<string, unknown> | undefined;
      const secretRef = entry.secretRef as Record<string, unknown> | undefined;
      if (typeof configMapRef?.name === "string") {
        return [{ kind: "ConfigMap", name: configMapRef.name }];
      }
      if (typeof secretRef?.name === "string") {
        return [{ kind: "Secret", name: secretRef.name }];
      }
      return [entry];
    });
  }
}

function normalizeManifestEnvFrom(manifest: Record<string, unknown>): void {
  const kind = manifest.kind;
  const spec = manifest.spec as Record<string, unknown> | undefined;
  if (kind === "Pod") {
    normalizeEnvFrom(spec?.containers);
    return;
  }
  if (
    kind === "Deployment" ||
    kind === "ReplicaSet" ||
    kind === "StatefulSet" ||
    kind === "DaemonSet" ||
    kind === "Job"
  ) {
    const template = spec?.template as Record<string, unknown> | undefined;
    normalizeEnvFrom(template?.containers);
    return;
  }
  if (kind === "CronJob") {
    const jobSpec = (spec?.jobTemplate as Record<string, unknown> | undefined)?.spec as
      | Record<string, unknown>
      | undefined;
    const template = jobSpec?.template as Record<string, unknown> | undefined;
    normalizeEnvFrom(template?.containers);
  }
}

function mergeManifest(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const current = result[key];
    if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof current === "object" &&
      current !== null &&
      !Array.isArray(current)
    ) {
      result[key] = mergeManifest(
        current as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

export class SimEngine {
  readonly store = new ClusterStore();
  readonly clock: VirtualClock;
  readonly events = new EventBus();
  #commands: ParsedCommand[] = [];
  #uid = 0;
  #ipCounter = 0;
  #serviceCounter = 0;
  #nodePortCounter = 30000;
  #files: Record<string, string> = {};

  constructor(options: SimEngineOptions = {}) {
    this.clock = new VirtualClock(options.intervalMs ?? 500);
    this.clock.onTick(() => {
      this.#reconcile();
    });
  }

  get commands(): readonly ParsedCommand[] {
    return this.#commands;
  }

  seed(scenario: Scenario): void {
    this.#files = scenario.files ?? {};
    for (const node of scenario.nodes) {
      const kubeNode: KubeNode = {
        apiVersion: "v1",
        kind: "Node",
        metadata: {
          name: node.name,
          namespace: "",
          labels: { "kubernetes.io/hostname": node.name, ...node.labels },
          uid: this.#nextUid("node"),
          resourceVersion: 0,
          creationTick: this.clock.tick,
        },
        ...(node.taints === undefined ? {} : { spec: { taints: node.taints } }),
        status: {
          ready: true,
          allocatable: {
            cpu: node.cpu ?? "4",
            memory: node.memory ?? "8Gi",
          },
        },
      };

      this.store.upsert(kubeNode);
    }

    for (const raw of scenario.objects ?? []) {
      this.#seedObject(raw);
    }
  }

  #seedObject(raw: unknown): void {
    if (typeof raw !== "object" || raw === null) {
      return;
    }

    const manifest = raw as Record<string, unknown>;
    const kind = manifest.kind;
    const metadata = manifest.metadata;
    if (typeof kind !== "string" || typeof metadata !== "object" || metadata === null) {
      return;
    }

    const meta = metadata as Record<string, unknown>;
    const name = meta.name;
    if (typeof name !== "string" || name.length === 0) {
      return;
    }

    const clusterScoped =
      kind === "Namespace" ||
      kind === "Node" ||
      kind === "PersistentVolume" ||
      kind === "StorageClass" ||
      kind === "ClusterRole" ||
      kind === "ClusterRoleBinding";
    const namespace =
      typeof meta.namespace === "string" ? meta.namespace : clusterScoped ? "" : "default";
    const labels =
      typeof meta.labels === "object" && meta.labels !== null
        ? (meta.labels as Record<string, string>)
        : {};

    if (kind === "DaemonSet") {
      manifest.status ??= { desiredNumberScheduled: 0, currentNumberScheduled: 0, numberReady: 0 };
    } else if (kind === "StatefulSet") {
      manifest.status ??= { replicas: 0, readyReplicas: 0 };
      const spec = manifest.spec as Record<string, unknown> | undefined;
      if (spec !== undefined) {
        spec.replicas ??= 1;
      }
    } else if (kind === "Job") {
      manifest.status ??= { active: 0, succeeded: 0, failed: 0 };
      const spec = manifest.spec as Record<string, unknown> | undefined;
      if (spec !== undefined) {
        spec.completions ??= 1;
        spec.parallelism ??= 1;
      }
    } else if (kind === "CronJob") {
      manifest.status ??= {};
    } else if (kind === "PodDisruptionBudget") {
      manifest.status ??= { currentHealthy: 0, desiredHealthy: 0, disruptionsAllowed: 0 };
    } else if (kind === "ResourceQuota") {
      manifest.status ??= {};
    }

    const object = {
      apiVersion: "v1",
      ...manifest,
      kind,
      metadata: {
        name,
        namespace,
        labels,
        uid: this.#nextUid(kind.toLowerCase()),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
    } as KubeObject;

    this.store.upsert(object);
  }

  start(): void {
    this.clock.start();
  }

  pause(): void {
    this.clock.stop();
  }

  step(): void {
    this.clock.advance();
  }

  followLogs(input: string, onLine: (line: string) => void): (() => void) | undefined {
    const parsed = parseCommand(input);
    if ("error" in parsed || parsed.verb !== "logs" || !parsed.follow) {
      return undefined;
    }
    const pod = this.store.get<Pod>("Pod", parsed.name, parsed.namespace);
    if (pod === undefined) {
      return undefined;
    }
    if (parsed.container !== undefined) {
      if (!pod.spec.containers.some((container) => container.name === parsed.container)) {
        return undefined;
      }
    } else if (pod.spec.containers.length > 1) {
      return undefined;
    }

    let cursor = 0;
    const emit = () => {
      const current = this.store.get<Pod>("Pod", parsed.name, parsed.namespace);
      const logs = current?.logs ?? [];
      for (; cursor < logs.length; cursor += 1) {
        const line = logs[cursor];
        if (line !== undefined) {
          onLine(line);
        }
      }
    };
    emit();
    return this.clock.onTick(emit);
  }

  execute(input: string): CommandResult {
    const parsed = parseCommand(input);

    if ("error" in parsed) {
      return { ok: false, output: `error: ${parsed.error}` };
    }

    const result = this.#execute(parsed);

    if (result.ok) {
      this.#commands.push(parsed);
    }

    return result;
  }

  #execute(parsed: ParsedCommand): CommandResult {
    switch (parsed.verb) {
      case "help":
        return { ok: true, output: HELP };
      case "get":
        return this.#get(parsed);
      case "run":
        return this.#run(parsed);
      case "create":
        if (parsed.resource === "ingresses") {
          return this.#createIngress(parsed);
        }
        if (parsed.resource === "configmaps") {
          return this.#createConfigMap(parsed);
        }
        if (parsed.resource === "secrets") {
          return this.#createSecret(parsed);
        }
        return this.#createDeployment(parsed);
      case "top":
        return this.#top(parsed);
      case "exec":
        return this.#exec(parsed);
      case "logs":
        return this.#logs(parsed);
      case "auth":
        return this.#auth(parsed);
      case "helm":
        return this.#helm(parsed);
      case "argocd":
        return this.#argocd(parsed);
      case "kustomize":
        return this.#kustomize(parsed);
      case "apply":
        return this.#apply(parsed);
      case "expose":
        return this.#expose(parsed);
      case "scale":
        return this.#scale(parsed);
      case "set":
        return parsed.action === "env" ? this.#setEnv(parsed) : this.#setImage(parsed);
      case "rollout":
        return this.#rollout(parsed);
      case "delete":
        return this.#delete(parsed);
      case "describe":
        return this.#describe(parsed);
    }
  }

  #get(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    if (command.output === "yaml") {
      return this.#getYaml(command);
    }

    if (command.resource === "pods") {
      return this.#getPods(command);
    }

    if (command.resource === "nodes") {
      return this.#getNodes(command);
    }

    if (command.resource === "deployments") {
      return this.#getDeployments(command);
    }

    if (command.resource === "replicasets") {
      return this.#getReplicaSets(command);
    }

    if (command.resource === "daemonsets") {
      return this.#getDaemonSets(command);
    }

    if (command.resource === "statefulsets") {
      return this.#getStatefulSets(command);
    }

    if (command.resource === "jobs") {
      return this.#getJobs(command);
    }

    if (command.resource === "cronjobs") {
      return this.#getCronJobs(command);
    }

    if (command.resource === "services") {
      return this.#getServices(command);
    }

    if (command.resource === "endpoints") {
      return this.#getEndpoints(command);
    }

    if (command.resource === "ingresses") {
      return this.#getIngresses(command);
    }

    if (command.resource === "configmaps") {
      return this.#getConfigMaps(command);
    }

    if (command.resource === "secrets") {
      return this.#getSecrets(command);
    }

    if (command.resource === "storageclasses") {
      return this.#getStorageClasses(command);
    }

    if (command.resource === "persistentvolumes") {
      return this.#getPersistentVolumes(command);
    }

    if (command.resource === "persistentvolumeclaims") {
      return this.#getPersistentVolumeClaims(command);
    }

    if (command.resource === "networkpolicies") {
      return this.#getNetworkPolicies(command);
    }

    if (command.resource === "resourcequotas") {
      return this.#getResourceQuotas(command);
    }

    if (command.resource === "limitranges") {
      return this.#getLimitRanges(command);
    }

    if (command.resource === "poddisruptionbudgets") {
      return this.#getPodDisruptionBudgets(command);
    }

    if (command.resource === "serviceaccounts") {
      return this.#getSimple(command, "ServiceAccount", "serviceaccounts");
    }

    if (command.resource === "roles") {
      return this.#getRoles(command);
    }

    if (command.resource === "rolebindings") {
      return this.#getRoleBindings(command);
    }

    if (command.resource === "clusterroles") {
      return this.#getSimple(command, "ClusterRole", "clusterroles", true);
    }

    if (command.resource === "clusterrolebindings") {
      return this.#getSimple(command, "ClusterRoleBinding", "clusterrolebindings", true);
    }

    if (command.resource === "namespaces") {
      return this.#getNamespaces(command);
    }

    if (command.resource === "horizontalpodautoscalers") {
      return this.#getHorizontalPodAutoscalers(command);
    }

    if (command.resource === "events") {
      return this.#getEvents(command);
    }

    const customKind = this.#customKind(command.resource);
    if (this.store.list(customKind).length > 0) {
      return this.#getSimple(command, customKind, command.resource);
    }

    return {
      ok: false,
      output: `error: the server doesn't have a resource type "${command.resource}" in this lesson`,
    };
  }

  #getYaml(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const resources: Record<string, { kind: string; clusterScoped?: boolean }> = {
      pods: { kind: "Pod" },
      nodes: { kind: "Node", clusterScoped: true },
      deployments: { kind: "Deployment" },
      replicasets: { kind: "ReplicaSet" },
      daemonsets: { kind: "DaemonSet" },
      statefulsets: { kind: "StatefulSet" },
      jobs: { kind: "Job" },
      cronjobs: { kind: "CronJob" },
      services: { kind: "Service" },
      ingresses: { kind: "Ingress" },
      configmaps: { kind: "ConfigMap" },
      secrets: { kind: "Secret" },
      storageclasses: { kind: "StorageClass", clusterScoped: true },
      persistentvolumes: { kind: "PersistentVolume", clusterScoped: true },
      persistentvolumeclaims: { kind: "PersistentVolumeClaim" },
      networkpolicies: { kind: "NetworkPolicy" },
      resourcequotas: { kind: "ResourceQuota" },
      limitranges: { kind: "LimitRange" },
      poddisruptionbudgets: { kind: "PodDisruptionBudget" },
      serviceaccounts: { kind: "ServiceAccount" },
      roles: { kind: "Role" },
      rolebindings: { kind: "RoleBinding" },
      clusterroles: { kind: "ClusterRole", clusterScoped: true },
      clusterrolebindings: { kind: "ClusterRoleBinding", clusterScoped: true },
      namespaces: { kind: "Namespace", clusterScoped: true },
      horizontalpodautoscalers: { kind: "HorizontalPodAutoscaler" },
      events: { kind: "Event" },
    };
    const target = resources[command.resource] ?? {
      kind: this.#customKind(command.resource),
    };
    const namespace = target.clusterScoped || command.allNamespaces ? undefined : command.namespace;
    const objects = command.name
      ? [
          this.store.get<KubeObject>(
            target.kind,
            command.name,
            target.clusterScoped ? "" : command.namespace,
          ),
        ].filter((object): object is KubeObject => object !== undefined)
      : this.store.list<KubeObject>(target.kind, namespace);

    if (command.name !== undefined && objects.length === 0) {
      return notFound(command.resource, command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = objects
      .filter((object) => selector.every(([key, value]) => object.metadata.labels[key] === value))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      return {
        ok: true,
        output: command.allNamespaces
          ? "No resources found."
          : `No resources found in ${command.namespace} namespace.`,
      };
    }

    return {
      ok: true,
      output: filtered.map((object) => stringifyYaml(object).trimEnd()).join("\n---\n"),
    };
  }

  #top(command: Extract<ParsedCommand, { verb: "top" }>): CommandResult {
    if (command.resource === "nodes") {
      const nodes = this.store
        .list<KubeNode>("Node")
        .filter((node) => command.name === undefined || node.metadata.name === command.name)
        .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
      if (command.name !== undefined && nodes.length === 0) {
        return notFound("nodes", command.name);
      }
      return {
        ok: true,
        output: formatTable(
          ["NAME", "CPU(cores)", "CPU%", "MEMORY(bytes)", "MEMORY%"],
          nodes.map((node) => {
            const cpu = parseCpuMillis(node.status.allocatable.cpu);
            const memory = parseMemoryBytes(node.status.allocatable.memory);
            const usedCpu = Math.max(12, Math.round(cpu * 0.18));
            const usedMemory = Math.max(64, Math.round(memory * 0.31));
            return [
              node.metadata.name,
              `${usedCpu}m`,
              `${Math.round((usedCpu / cpu) * 100)}%`,
              `${Math.round(usedMemory / (1024 * 1024))}Mi`,
              `${Math.round((usedMemory / memory) * 100)}%`,
            ];
          }),
        ),
      };
    }

    const pods = filterPods(this.store.list<Pod>("Pod"), {
      ...(command.allNamespaces ? {} : { namespace: command.namespace }),
      ...(command.name === undefined ? {} : { name: command.name }),
    }).sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));
    if (command.name !== undefined && pods.length === 0) {
      return notFound("pods", command.name);
    }
    if (pods.length === 0) {
      return {
        ok: true,
        output: command.allNamespaces
          ? "No resources found."
          : `No resources found in ${command.namespace} namespace.`,
      };
    }
    return {
      ok: true,
      output: formatTable(
        ["NAME", "CPU(cores)", "MEMORY(bytes)"],
        pods.map((pod) => {
          const cpu = pod.status.usage?.cpuMillicores ?? 8 + (hashString(pod.metadata.name) % 92);
          const memoryBytes =
            pod.status.usage?.memoryBytes ??
            (32 + (hashString(`${pod.metadata.name}:memory`) % 224)) * 1024 * 1024;
          return [
            command.allNamespaces
              ? `${pod.metadata.namespace}/${pod.metadata.name}`
              : pod.metadata.name,
            `${cpu}m`,
            `${Math.round(memoryBytes / (1024 * 1024))}Mi`,
          ];
        }),
      ),
    };
  }

  #getPods(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const filter: PodFilter = {
      ...(command.allNamespaces && command.name === undefined
        ? {}
        : { namespace: command.namespace }),
      ...(command.name === undefined ? {} : { name: command.name }),
      labels: command.selector,
    };

    const pods = filterPods(this.store.list<Pod>("Pod"), filter);

    if (command.name !== undefined && pods.length === 0) {
      return notFound("pods", command.name);
    }

    const wide = command.output === "wide";
    const headers = ["NAME", "READY", "STATUS", "RESTARTS", "AGE"];
    if (wide) {
      headers.push("IP", "NODE");
    }
    if (command.showLabels) {
      headers.push("LABELS");
    }

    const rows = [...pods]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((pod) => {
        const ready =
          pod.status.containerStatuses === undefined
            ? isPodReady(pod)
              ? pod.spec.containers.length
              : 0
            : pod.status.containerStatuses.filter((status) => status.ready).length;
        const restarts =
          pod.status.containerStatuses?.reduce((sum, status) => sum + status.restartCount, 0) ?? 0;
        const age = `${Math.max(0, this.clock.tick - pod.metadata.creationTick)}s`;
        const name = command.allNamespaces
          ? `${pod.metadata.namespace}/${pod.metadata.name}`
          : pod.metadata.name;
        const row = [
          name,
          `${ready}/${pod.spec.containers.length}`,
          pod.status.reason ?? pod.status.phase,
          String(restarts),
          age,
        ];
        if (wide) {
          row.push(pod.status.podIP ?? "<none>", pod.spec.nodeName ?? "<none>");
        }
        if (command.showLabels) {
          row.push(formatLabels(pod.metadata.labels));
        }
        return row;
      });

    if (rows.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    return { ok: true, output: formatTable(headers, rows) };
  }

  #getNodes(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const nodes = command.name
      ? [this.store.get<KubeNode>("Node", command.name, "")].filter(
          (node): node is KubeNode => node !== undefined,
        )
      : this.store.list<KubeNode>("Node");

    if (command.name !== undefined && nodes.length === 0) {
      return notFound("nodes", command.name);
    }

    const headers = ["NAME", "STATUS", "ROLES", "AGE", "VERSION"];
    if (command.showLabels) {
      headers.push("LABELS");
    }
    const rows = nodes.map((node) => {
      const row = [
        node.metadata.name,
        node.status.ready ? "Ready" : "NotReady",
        "<none>",
        "1d",
        "v1.37.0",
      ];
      if (command.showLabels) {
        row.push(formatLabels(node.metadata.labels));
      }
      return row;
    });

    return { ok: true, output: formatTable(headers, rows) };
  }

  #run(command: Extract<ParsedCommand, { verb: "run" }>): CommandResult {
    if (this.store.get<Pod>("Pod", command.name, command.namespace) !== undefined) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): pods "${command.name}" already exists`,
      };
    }

    const tick = this.clock.tick;
    const pod: Pod = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name: command.name,
        namespace: command.namespace,
        labels: { run: command.name, ...command.labels },
        uid: this.#nextUid("pod"),
        resourceVersion: 0,
        creationTick: tick,
      },
      spec: {
        containers: [{ name: command.name, image: command.image }],
      },
      status: {
        phase: "Pending",
      },
    };

    const stored = this.store.upsert(pod);
    this.events.emit({ type: "pod.created", tick, pod: stored });

    return { ok: true, output: `pod/${command.name} created` };
  }

  #createDeployment(
    command: Extract<ParsedCommand, { verb: "create"; resource: "deployments" }>,
  ): CommandResult {
    if (command.replicas > MAX_REPLICAS) {
      return { ok: false, output: `error: replicas must be at most ${MAX_REPLICAS}` };
    }

    if (this.store.get<KubeDeployment>("Deployment", command.name, command.namespace)) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): deployments.apps "${command.name}" already exists`,
      };
    }

    const tick = this.clock.tick;
    const imageName = command.image.split("/").pop() ?? command.name;
    const containerName = imageName.split("@")[0]?.split(":")[0] ?? command.name;
    const template: PodTemplate = {
      labels: { app: command.name },
      containers: [{ name: containerName, image: command.image }],
    };
    const deployment: KubeDeployment = {
      apiVersion: "apps/v1",
      kind: "Deployment",
      metadata: {
        name: command.name,
        namespace: command.namespace,
        labels: { app: command.name },
        uid: this.#nextUid("deployment"),
        resourceVersion: 0,
        creationTick: tick,
      },
      spec: {
        replicas: command.replicas,
        template,
      },
      status: {
        replicas: 0,
        readyReplicas: 0,
        updatedReplicas: 0,
        availableReplicas: 0,
      },
    };

    this.store.upsert(deployment);
    return { ok: true, output: `deployment.apps/${command.name} created` };
  }

  #createConfigMap(
    command: Extract<ParsedCommand, { verb: "create"; resource: "configmaps" }>,
  ): CommandResult {
    if (this.store.get<KubeConfigMap>("ConfigMap", command.name, command.namespace)) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): configmaps "${command.name}" already exists`,
      };
    }

    this.store.upsert<KubeConfigMap>({
      apiVersion: "v1",
      kind: "ConfigMap",
      metadata: {
        name: command.name,
        namespace: command.namespace,
        labels: { app: command.name },
        uid: this.#nextUid("configmap"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      data: command.data,
    });

    return { ok: true, output: `configmap/${command.name} created` };
  }

  #createSecret(
    command: Extract<ParsedCommand, { verb: "create"; resource: "secrets" }>,
  ): CommandResult {
    if (this.store.get<KubeSecret>("Secret", command.name, command.namespace)) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): secrets "${command.name}" already exists`,
      };
    }

    this.store.upsert<KubeSecret>({
      apiVersion: "v1",
      kind: "Secret",
      type: "Opaque",
      metadata: {
        name: command.name,
        namespace: command.namespace,
        labels: { app: command.name },
        uid: this.#nextUid("secret"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      data: Object.fromEntries(
        Object.entries(command.data).map(([name, value]) => [name, encodeBase64(value)]),
      ),
    });

    return { ok: true, output: `secret/${command.name} created` };
  }

  #createIngress(
    command: Extract<ParsedCommand, { verb: "create"; resource: "ingresses" }>,
  ): CommandResult {
    if (this.store.get<KubeIngress>("Ingress", command.name, command.namespace)) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): ingresses.networking.k8s.io "${command.name}" already exists`,
      };
    }

    this.store.upsert<KubeIngress>({
      apiVersion: "networking.k8s.io/v1",
      kind: "Ingress",
      metadata: {
        name: command.name,
        namespace: command.namespace,
        labels: { app: command.name },
        uid: this.#nextUid("ingress"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      spec: {
        ...(command.ingressClassName === undefined
          ? {}
          : { ingressClassName: command.ingressClassName }),
        rules: [command.rule],
      },
    });

    return { ok: true, output: `ingress.networking.k8s.io/${command.name} created` };
  }

  #exec(command: Extract<ParsedCommand, { verb: "exec" }>): CommandResult {
    const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
    if (pod === undefined) {
      return notFound("pods", command.name);
    }
    if (pod.status.phase !== "Running") {
      return {
        ok: false,
        output: `error: pod "${command.name}" is not running (${pod.status.phase})`,
      };
    }

    if (command.command === "nslookup" || command.command === "getent") {
      let query: string | undefined;
      if (command.command === "getent") {
        if (command.args[0] !== "hosts" || command.args.length !== 2) {
          return { ok: false, output: "getent: usage: getent hosts <name>" };
        }
        query = command.args[1];
      } else {
        if (command.args.length !== 1) {
          return { ok: false, output: "nslookup: usage: nslookup <name>" };
        }
        query = command.args[0];
      }
      if (query === undefined) {
        return { ok: false, output: `${command.command}: missing host` };
      }

      const target = resolveServiceDns(query, command.namespace);
      const service =
        target === undefined
          ? undefined
          : this.store.get<KubeService>("Service", target.name, target.namespace);

      if (target === undefined || service === undefined) {
        return {
          ok: false,
          output: `** server can't find ${query}: NXDOMAIN`,
        };
      }

      const addresses =
        service.spec.clusterIP === "None"
          ? this.#servicePods(service).flatMap((pod) =>
              pod.status.podIP === undefined ? [] : [pod.status.podIP],
            )
          : [service.spec.clusterIP];
      if (addresses.length === 0) {
        return {
          ok: false,
          output: `** server can't find ${query}: NXDOMAIN`,
        };
      }

      if (command.command === "getent") {
        return {
          ok: true,
          output: addresses.map((address) => `${address} ${target.canonical}`).join("\n"),
        };
      }

      return {
        ok: true,
        output: [
          "Server:         10.96.0.10",
          "Address:        10.96.0.10:53",
          "",
          `Name:           ${target.canonical}`,
          ...addresses.map((address) => `Address:        ${address}`),
        ].join("\n"),
      };
    }

    if (command.command === "cat" && command.args.length === 1) {
      const path = command.args[0];
      if (path === "/var/run/secrets/kubernetes.io/serviceaccount/token") {
        return {
          ok: true,
          output: `kubelab-token.${pod.metadata.namespace}.${pod.spec.serviceAccountName ?? "default"}.${pod.metadata.uid}`,
        };
      }
      if (path === "/var/run/secrets/kubernetes.io/serviceaccount/namespace") {
        return { ok: true, output: pod.metadata.namespace };
      }
      if (path === "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt") {
        return {
          ok: true,
          output: "-----BEGIN CERTIFICATE-----\nKUBELAB-CA\n-----END CERTIFICATE-----",
        };
      }
      return { ok: false, output: `cat: ${path}: No such file or directory` };
    }

    if (command.command === "env" || command.command === "printenv") {
      const env = pod.spec.containers[0]?.env ?? [];
      if (command.command === "printenv") {
        const name = command.args[0];
        if (name === undefined) {
          return { ok: false, output: "printenv: missing variable name" };
        }
        const variable = env.find((entry) => entry.name === name);
        return variable === undefined
          ? { ok: false, output: `printenv: ${name}: not found` }
          : { ok: true, output: variable.value };
      }

      return {
        ok: true,
        output: [...env]
          .sort((left, right) => left.name.localeCompare(right.name))
          .map((entry) => `${entry.name}=${entry.value}`)
          .join("\n"),
      };
    }

    if (command.command === "curl") {
      const headerIndex = command.args.findIndex(
        (argument) => argument === "-H" || argument === "--header",
      );
      const header = headerIndex === -1 ? undefined : command.args[headerIndex + 1];
      const url = command.args.find(
        (argument) => argument.startsWith("http://") || argument.startsWith("https://"),
      );

      let host = header?.toLowerCase().startsWith("host:")
        ? (header.slice("host:".length).trim().split(":")[0] ?? "")
        : undefined;
      let path = "/";
      let secure = false;

      if (url !== undefined) {
        try {
          const parsed = new URL(url);
          host = host ?? parsed.hostname;
          path = parsed.pathname.length === 0 ? "/" : parsed.pathname;
          secure = parsed.protocol === "https:";
        } catch {
          return { ok: false, output: `curl: (3) URL rejected: ${url}` };
        }
      }

      if (host === undefined || host.length === 0) {
        return { ok: false, output: "curl: (6) Could not resolve host" };
      }

      const route = this.store
        .list<KubeIngress>("Ingress", command.namespace)
        .flatMap((ingress) =>
          ingress.spec.rules.map((rule) => ({
            ingress,
            rule,
          })),
        )
        .filter(
          ({ rule }) =>
            rule.host.toLowerCase() === host.toLowerCase() && matchesIngressPath(rule.path, path),
        )
        .sort((left, right) => right.rule.path.length - left.rule.path.length)[0];

      if (secure) {
        const tlsHosts = route?.ingress.spec.tls?.flatMap((tls) => tls.hosts) ?? [];
        if (route === undefined || !tlsHosts.includes(host)) {
          return {
            ok: false,
            output: `curl: (35) SSL connect error\nno TLS certificate matches ${host}`,
          };
        }
      }

      if (route === undefined) {
        const dnsTarget = resolveServiceDns(host, command.namespace);
        const directService =
          dnsTarget === undefined
            ? undefined
            : this.store.get<KubeService>("Service", dnsTarget.name, dnsTarget.namespace);
        if (directService !== undefined) {
          const backend = this.#servicePods(directService)[0];
          if (backend === undefined) {
            return {
              ok: false,
              output: `HTTP/1.1 503 Service Unavailable\nContent-Type: text/plain\n\nno ready endpoints for ${directService.metadata.name}`,
            };
          }
          if (!this.#ingressAllowed(backend, pod, directService.spec.ports[0]?.port ?? 80)) {
            return {
              ok: true,
              output: `HTTP/1.1 403 Forbidden\nContent-Type: text/plain\n\nNetworkPolicy denied access to ${directService.metadata.name}`,
            };
          }
          return {
            ok: true,
            output: [
              "HTTP/1.1 200 OK",
              "Content-Type: text/plain",
              `X-Kubelab-Backend: ${directService.metadata.name}`,
              "",
              `${directService.metadata.name} -> ${backend.metadata.name} (${backend.status.podIP ?? "<none>"})`,
            ].join("\n"),
          };
        }

        return {
          ok: false,
          output: `HTTP/1.1 404 Not Found\nContent-Type: text/plain\n\nno Ingress rule for ${host}${path}`,
        };
      }

      const service = this.store.get<KubeService>(
        "Service",
        route.rule.serviceName,
        route.ingress.metadata.namespace,
      );
      const backend = service === undefined ? undefined : this.#servicePods(service)[0];
      if (
        service === undefined ||
        !service.spec.ports.some((port) => port.port === route.rule.servicePort) ||
        backend === undefined
      ) {
        return {
          ok: false,
          output: `HTTP/1.1 503 Service Unavailable\nContent-Type: text/plain\n\nno ready endpoints for ${route.rule.serviceName}`,
        };
      }

      if (!this.#ingressAllowed(backend, pod, route.rule.servicePort)) {
        return {
          ok: true,
          output: `HTTP/1.1 403 Forbidden\nContent-Type: text/plain\n\nNetworkPolicy denied access to ${service.metadata.name}`,
        };
      }

      return {
        ok: true,
        output: [
          "HTTP/1.1 200 OK",
          "Content-Type: text/plain",
          `X-Kubelab-Backend: ${service.metadata.name}`,
          "",
          `${route.ingress.metadata.name} -> ${service.metadata.name} -> ${backend.metadata.name} (${backend.status.podIP ?? "<none>"})`,
        ].join("\n"),
      };
    }

    return { ok: false, output: `error: executable file not found: ${command.command}` };
  }

  #expose(command: Extract<ParsedCommand, { verb: "expose" }>): CommandResult {
    if (this.store.get<KubeService>("Service", command.serviceName, command.namespace)) {
      return {
        ok: false,
        output: `Error from server (AlreadyExists): services "${command.serviceName}" already exists`,
      };
    }

    let selector: Record<string, string>;

    if (command.resource === "deployments") {
      const deployment = this.store.get<KubeDeployment>(
        "Deployment",
        command.name,
        command.namespace,
      );
      if (deployment === undefined) {
        return notFound("deployments.apps", command.name);
      }
      selector = { ...deployment.spec.template.labels };
    } else {
      const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
      if (pod === undefined) {
        return notFound("pods", command.name);
      }
      selector = Object.fromEntries(
        Object.entries(pod.metadata.labels).filter(
          ([key]) => key !== "pod-template-hash" && key !== "deployment",
        ),
      );
    }

    this.#serviceCounter += 1;
    const service: KubeService = {
      apiVersion: "v1",
      kind: "Service",
      metadata: {
        name: command.serviceName,
        namespace: command.namespace,
        labels: { ...selector },
        uid: this.#nextUid("service"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      spec: {
        type: command.serviceType,
        selector,
        ports: [
          {
            port: command.port,
            targetPort: command.targetPort,
            ...(command.serviceType === "NodePort" ? { nodePort: this.#nextNodePort() } : {}),
          },
        ],
        clusterIP: `10.96.${Math.floor((this.#serviceCounter - 1) / 254)}.${((this.#serviceCounter - 1) % 254) + 1}`,
      },
    };

    this.store.upsert(service);
    return { ok: true, output: `service/${command.serviceName} exposed` };
  }

  #scale(command: Extract<ParsedCommand, { verb: "scale" }>): CommandResult {
    if (command.replicas > MAX_REPLICAS) {
      return { ok: false, output: `error: replicas must be at most ${MAX_REPLICAS}` };
    }

    const deployment = this.store.get<KubeDeployment>(
      "Deployment",
      command.name,
      command.namespace,
    );
    if (deployment === undefined) {
      return notFound("deployments.apps", command.name);
    }

    this.store.upsert({
      ...deployment,
      spec: { ...deployment.spec, replicas: command.replicas },
      status: {
        replicas: 0,
        readyReplicas: 0,
        updatedReplicas: 0,
        availableReplicas: 0,
      },
    });
    return { ok: true, output: `deployment.apps/${command.name} scaled` };
  }

  #setImage(command: Extract<ParsedCommand, { verb: "set"; action: "image" }>): CommandResult {
    const deployment = this.store.get<KubeDeployment>(
      "Deployment",
      command.name,
      command.namespace,
    );
    if (deployment === undefined) {
      return notFound("deployments.apps", command.name);
    }

    if (
      !deployment.spec.template.containers.some((container) => container.name === command.container)
    ) {
      return { ok: false, output: `error: unable to find container named ${command.container}` };
    }

    this.store.upsert({
      ...deployment,
      spec: {
        ...deployment.spec,
        template: {
          ...deployment.spec.template,
          containers: deployment.spec.template.containers.map((container) =>
            container.name === command.container
              ? { ...container, image: command.image }
              : container,
          ),
        },
      },
      status: {
        replicas: 0,
        readyReplicas: 0,
        updatedReplicas: 0,
        availableReplicas: 0,
      },
    });

    return { ok: true, output: `deployment.apps/${command.name} image updated` };
  }

  #setEnv(command: Extract<ParsedCommand, { verb: "set"; action: "env" }>): CommandResult {
    const deployment = this.store.get<KubeDeployment>(
      "Deployment",
      command.name,
      command.namespace,
    );
    if (deployment === undefined) {
      return notFound("deployments.apps", command.name);
    }

    const configMap =
      command.fromKind === "ConfigMap"
        ? this.store.get<KubeConfigMap>("ConfigMap", command.fromName, command.namespace)
        : undefined;
    const secret =
      command.fromKind === "Secret"
        ? this.store.get<KubeSecret>("Secret", command.fromName, command.namespace)
        : undefined;
    const source = configMap ?? secret;

    if (source === undefined) {
      return notFound(`${command.fromKind.toLowerCase()}s`, command.fromName);
    }

    let values: Record<string, string>;
    try {
      values =
        command.fromKind === "Secret"
          ? Object.fromEntries(
              Object.entries(source.data).map(([name, value]) => [name, decodeBase64(value)]),
            )
          : source.data;
    } catch {
      return {
        ok: false,
        output: `error: ${command.fromKind.toLowerCase()} "${command.fromName}" contains invalid data`,
      };
    }

    this.store.upsert({
      ...deployment,
      spec: {
        ...deployment.spec,
        template: {
          ...deployment.spec.template,
          containers: deployment.spec.template.containers.map((container) => {
            const env = [...(container.env ?? [])];
            for (const [name, value] of Object.entries(values)) {
              const existing = env.findIndex((variable) => variable.name === name);
              const entry = {
                name,
                value,
                source: { kind: command.fromKind, name: command.fromName },
              };
              if (existing === -1) {
                env.push(entry);
              } else {
                env[existing] = entry;
              }
            }

            const envFrom = [...(container.envFrom ?? [])];
            if (
              !envFrom.some(
                (entry) => entry.kind === command.fromKind && entry.name === command.fromName,
              )
            ) {
              envFrom.push({ kind: command.fromKind, name: command.fromName });
            }

            return { ...container, env, envFrom };
          }),
        },
      },
      status: {
        replicas: 0,
        readyReplicas: 0,
        updatedReplicas: 0,
        availableReplicas: 0,
      },
    });

    return { ok: true, output: `deployment.apps/${command.name} env updated` };
  }

  #rollout(command: Extract<ParsedCommand, { verb: "rollout" }>): CommandResult {
    const deployment = this.store.get<KubeDeployment>(
      "Deployment",
      command.name,
      command.namespace,
    );
    if (deployment === undefined) {
      return notFound("deployments.apps", command.name);
    }

    if (command.action === "undo") {
      const replicaSets = this.#replicaSetsFor(deployment);
      const current = this.#currentReplicaSet(deployment);
      const currentRevision = current?.spec.revision ?? 0;
      const previous = replicaSets
        .filter((replicaSet) => replicaSet.spec.revision < currentRevision)
        .sort((left, right) => right.spec.revision - left.spec.revision)[0];

      if (previous === undefined) {
        return {
          ok: false,
          output: `error: no rollout history found for deployment "${command.name}"`,
        };
      }

      const nextRevision =
        Math.max(0, ...replicaSets.map((replicaSet) => replicaSet.spec.revision)) + 1;
      this.store.upsert({
        ...previous,
        spec: { ...previous.spec, revision: nextRevision },
      });
      this.store.upsert({
        ...deployment,
        spec: { ...deployment.spec, template: previous.spec.template },
        status: {
          replicas: 0,
          readyReplicas: 0,
          updatedReplicas: 0,
          availableReplicas: 0,
        },
      });

      return { ok: true, output: `deployment.apps/${command.name} rolled back` };
    }

    const pods = this.#deploymentPods(deployment);
    const ready = pods.filter(isPodReady).length;
    const current = this.#currentReplicaSet(deployment);
    const desired = deployment.spec.replicas;
    const currentDesired = current?.spec.replicas ?? 0;

    if (ready === desired && pods.length === desired && currentDesired === desired) {
      return { ok: true, output: `deployment "${command.name}" successfully rolled out` };
    }

    if (desired === 0) {
      return {
        ok: true,
        output: `Waiting for deployment "${command.name}" scale down to finish: ${pods.length} old replicas remain`,
      };
    }

    if (pods.length > desired) {
      return {
        ok: true,
        output: `Waiting for deployment "${command.name}" scale down to finish: ${pods.length - desired} old replicas remain`,
      };
    }

    return {
      ok: true,
      output: `Waiting for deployment "${command.name}" rollout to finish: ${ready} out of ${desired} updated replicas are available...`,
    };
  }

  #getDeployments(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const deployments = command.name
      ? [this.store.get<KubeDeployment>("Deployment", command.name, command.namespace)].filter(
          (deployment): deployment is KubeDeployment => deployment !== undefined,
        )
      : this.store.list<KubeDeployment>(
          "Deployment",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && deployments.length === 0) {
      return notFound("deployments.apps", command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = deployments
      .filter((deployment) =>
        selector.every(([key, value]) => deployment.metadata.labels[key] === value),
      )
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    const headers = ["NAME", "READY", "UP-TO-DATE", "AVAILABLE", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }

    const rows = filtered.map((deployment) => {
      const name = command.allNamespaces
        ? `${deployment.metadata.namespace}/${deployment.metadata.name}`
        : deployment.metadata.name;
      const row = [
        name,
        `${deployment.status.readyReplicas}/${deployment.spec.replicas}`,
        String(deployment.status.updatedReplicas),
        String(deployment.status.availableReplicas),
        `${Math.max(0, this.clock.tick - deployment.metadata.creationTick)}s`,
      ];
      if (command.showLabels) {
        row.push(formatLabels(deployment.metadata.labels));
      }
      return row;
    });

    return { ok: true, output: formatTable(headers, rows) };
  }

  #getReplicaSets(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const replicaSets = command.name
      ? [this.store.get<KubeReplicaSet>("ReplicaSet", command.name, command.namespace)].filter(
          (replicaSet): replicaSet is KubeReplicaSet => replicaSet !== undefined,
        )
      : this.store.list<KubeReplicaSet>(
          "ReplicaSet",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && replicaSets.length === 0) {
      return notFound("replicasets.apps", command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = replicaSets
      .filter((replicaSet) =>
        selector.every(([key, value]) => replicaSet.metadata.labels[key] === value),
      )
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    const headers = ["NAME", "DESIRED", "CURRENT", "READY", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }

    const rows = filtered.map((replicaSet) => {
      const pods = this.#replicaSetPods(replicaSet);
      const ready = pods.filter(isPodReady).length;
      const name = command.allNamespaces
        ? `${replicaSet.metadata.namespace}/${replicaSet.metadata.name}`
        : replicaSet.metadata.name;
      const row = [
        name,
        String(replicaSet.spec.replicas),
        String(pods.length),
        String(ready),
        `${Math.max(0, this.clock.tick - replicaSet.metadata.creationTick)}s`,
      ];
      if (command.showLabels) {
        row.push(formatLabels(replicaSet.metadata.labels));
      }
      return row;
    });

    return { ok: true, output: formatTable(headers, rows) };
  }

  #getServices(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const services = command.name
      ? [this.store.get<KubeService>("Service", command.name, command.namespace)].filter(
          (service): service is KubeService => service !== undefined,
        )
      : this.store.list<KubeService>(
          "Service",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && services.length === 0) {
      return notFound("services", command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = services
      .filter((service) => selector.every(([key, value]) => service.metadata.labels[key] === value))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    const headers = ["NAME", "TYPE", "CLUSTER-IP", "EXTERNAL-IP", "PORT(S)", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }

    const rows = filtered.map((service) => {
      const name = command.allNamespaces
        ? `${service.metadata.namespace}/${service.metadata.name}`
        : service.metadata.name;
      const ports = service.spec.ports
        .map(
          (port) =>
            `${port.port}${port.nodePort === undefined ? "" : `:${port.nodePort}`}/${port.targetPort}`,
        )
        .join(",");
      const row = [
        name,
        service.spec.type,
        service.spec.clusterIP === "None" ? "<none>" : service.spec.clusterIP,
        service.spec.type === "LoadBalancer" ? "<pending>" : "<none>",
        ports,
        `${Math.max(0, this.clock.tick - service.metadata.creationTick)}s`,
      ];
      if (command.showLabels) {
        row.push(formatLabels(service.metadata.labels));
      }
      return row;
    });

    return { ok: true, output: formatTable(headers, rows) };
  }

  #getEndpoints(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const services = command.name
      ? [this.store.get<KubeService>("Service", command.name, command.namespace)].filter(
          (service): service is KubeService => service !== undefined,
        )
      : this.store.list<KubeService>(
          "Service",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && services.length === 0) {
      return notFound("endpoints", command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = services
      .filter((service) => selector.every(([key, value]) => service.metadata.labels[key] === value))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    const rows = filtered.map((service) => {
      const pods = this.#servicePods(service);
      const port = service.spec.ports[0]?.targetPort ?? 80;
      const endpoints = pods.map((pod) => `${pod.status.podIP ?? "<none>"}:${port}`).join(",");
      const name = command.allNamespaces
        ? `${service.metadata.namespace}/${service.metadata.name}`
        : service.metadata.name;
      return [
        name,
        endpoints.length > 0 ? endpoints : "<none>",
        `${Math.max(0, this.clock.tick - service.metadata.creationTick)}s`,
      ];
    });

    return { ok: true, output: formatTable(["NAME", "ENDPOINTS", "AGE"], rows) };
  }

  #getDaemonSets(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeDaemonSet>("DaemonSet", command.name, command.namespace)].filter(
          (item): item is KubeDaemonSet => item !== undefined,
        )
      : this.store.list<KubeDaemonSet>(
          "DaemonSet",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("daemonsets.apps", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        String(item.status.desiredNumberScheduled),
        String(item.status.currentNumberScheduled),
        String(item.status.numberReady),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);
    return rows.length === 0
      ? this.#noResources(command)
      : {
          ok: true,
          output: formatTable(["NAME", "DESIRED", "CURRENT", "READY", "AGE"], rows),
        };
  }

  #getStatefulSets(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeStatefulSet>("StatefulSet", command.name, command.namespace)].filter(
          (item): item is KubeStatefulSet => item !== undefined,
        )
      : this.store.list<KubeStatefulSet>(
          "StatefulSet",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("statefulsets.apps", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        `${item.status.readyReplicas}/${item.spec.replicas}`,
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);
    return rows.length === 0
      ? this.#noResources(command)
      : { ok: true, output: formatTable(["NAME", "READY", "AGE"], rows) };
  }

  #getJobs(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeJob>("Job", command.name, command.namespace)].filter(
          (item): item is KubeJob => item !== undefined,
        )
      : this.store.list<KubeJob>("Job", command.allNamespaces ? undefined : command.namespace);
    if (command.name !== undefined && items.length === 0) {
      return notFound("jobs.batch", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => {
        const status =
          item.status.succeeded >= item.spec.completions
            ? "Complete"
            : item.status.failed > 0
              ? "Failed"
              : item.status.active > 0
                ? "Running"
                : "Pending";
        return [
          command.allNamespaces
            ? `${item.metadata.namespace}/${item.metadata.name}`
            : item.metadata.name,
          status,
          `${item.status.succeeded}/${item.spec.completions}`,
          `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
        ];
      });
    return rows.length === 0
      ? this.#noResources(command)
      : { ok: true, output: formatTable(["NAME", "STATUS", "COMPLETIONS", "AGE"], rows) };
  }

  #getCronJobs(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeCronJob>("CronJob", command.name, command.namespace)].filter(
          (item): item is KubeCronJob => item !== undefined,
        )
      : this.store.list<KubeCronJob>(
          "CronJob",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("cronjobs.batch", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => {
        const active = this.store
          .list<KubeJob>("Job", item.metadata.namespace)
          .filter((job) => job.metadata.labels.cronjob === item.metadata.name).length;
        return [
          command.allNamespaces
            ? `${item.metadata.namespace}/${item.metadata.name}`
            : item.metadata.name,
          item.spec.schedule,
          "False",
          String(active),
          item.status.lastScheduleTick === undefined
            ? "<none>"
            : `${Math.max(0, this.clock.tick - item.status.lastScheduleTick)}s ago`,
          `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
        ];
      });
    return rows.length === 0
      ? this.#noResources(command)
      : {
          ok: true,
          output: formatTable(
            ["NAME", "SCHEDULE", "SUSPEND", "ACTIVE", "LAST SCHEDULE", "AGE"],
            rows,
          ),
        };
  }

  #getResourceQuotas(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [
          this.store.get<KubeResourceQuota>("ResourceQuota", command.name, command.namespace),
        ].filter((item): item is KubeResourceQuota => item !== undefined)
      : this.store.list<KubeResourceQuota>(
          "ResourceQuota",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("resourcequotas", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        Object.entries(item.status.used ?? {})
          .map(([key, value]) => `${key}=${value}`)
          .join(",") || "<none>",
        Object.entries(item.spec.hard)
          .map(([key, value]) => `${key}=${value}`)
          .join(",") || "<none>",
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);
    return rows.length === 0
      ? this.#noResources(command)
      : { ok: true, output: formatTable(["NAME", "USED", "HARD", "AGE"], rows) };
  }

  #getLimitRanges(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeLimitRange>("LimitRange", command.name, command.namespace)].filter(
          (item): item is KubeLimitRange => item !== undefined,
        )
      : this.store.list<KubeLimitRange>(
          "LimitRange",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("limitranges", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        String(item.spec.limits.length),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);
    return rows.length === 0
      ? this.#noResources(command)
      : { ok: true, output: formatTable(["NAME", "LIMITS", "AGE"], rows) };
  }

  #getPodDisruptionBudgets(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [
          this.store.get<KubePodDisruptionBudget>(
            "PodDisruptionBudget",
            command.name,
            command.namespace,
          ),
        ].filter((item): item is KubePodDisruptionBudget => item !== undefined)
      : this.store.list<KubePodDisruptionBudget>(
          "PodDisruptionBudget",
          command.allNamespaces ? undefined : command.namespace,
        );
    if (command.name !== undefined && items.length === 0) {
      return notFound("poddisruptionbudgets", command.name);
    }
    const rows = items
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        String(item.spec.minAvailable ?? "<none>"),
        String(item.spec.maxUnavailable ?? "<none>"),
        String(item.status.disruptionsAllowed),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);
    return rows.length === 0
      ? this.#noResources(command)
      : {
          ok: true,
          output: formatTable(["NAME", "MIN AVAILABLE", "MAX UNAVAILABLE", "ALLOWED", "AGE"], rows),
        };
  }

  #getConfigMaps(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const configMaps = command.name
      ? [this.store.get<KubeConfigMap>("ConfigMap", command.name, command.namespace)].filter(
          (configMap): configMap is KubeConfigMap => configMap !== undefined,
        )
      : this.store.list<KubeConfigMap>(
          "ConfigMap",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && configMaps.length === 0) {
      return notFound("configmaps", command.name);
    }

    const selector = Object.entries(command.selector);
    const headers = ["NAME", "DATA", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }
    const rows = configMaps
      .filter((configMap) =>
        selector.every(([key, value]) => configMap.metadata.labels[key] === value),
      )
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((configMap) => {
        const row = [
          command.allNamespaces
            ? `${configMap.metadata.namespace}/${configMap.metadata.name}`
            : configMap.metadata.name,
          String(Object.keys(configMap.data).length),
          `${Math.max(0, this.clock.tick - configMap.metadata.creationTick)}s`,
        ];
        if (command.showLabels) {
          row.push(formatLabels(configMap.metadata.labels));
        }
        return row;
      });

    if (rows.length === 0) {
      return {
        ok: true,
        output: command.allNamespaces
          ? "No resources found."
          : `No resources found in ${command.namespace} namespace.`,
      };
    }

    return { ok: true, output: formatTable(headers, rows) };
  }

  #getSecrets(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const secrets = command.name
      ? [this.store.get<KubeSecret>("Secret", command.name, command.namespace)].filter(
          (secret): secret is KubeSecret => secret !== undefined,
        )
      : this.store.list<KubeSecret>(
          "Secret",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && secrets.length === 0) {
      return notFound("secrets", command.name);
    }

    const selector = Object.entries(command.selector);
    const headers = ["NAME", "TYPE", "DATA", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }
    const rows = secrets
      .filter((secret) => selector.every(([key, value]) => secret.metadata.labels[key] === value))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((secret) => {
        const row = [
          command.allNamespaces
            ? `${secret.metadata.namespace}/${secret.metadata.name}`
            : secret.metadata.name,
          secret.type,
          String(Object.keys(secret.data).length),
          `${Math.max(0, this.clock.tick - secret.metadata.creationTick)}s`,
        ];
        if (command.showLabels) {
          row.push(formatLabels(secret.metadata.labels));
        }
        return row;
      });

    if (rows.length === 0) {
      return {
        ok: true,
        output: command.allNamespaces
          ? "No resources found."
          : `No resources found in ${command.namespace} namespace.`,
      };
    }

    return { ok: true, output: formatTable(headers, rows) };
  }

  #noResources(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    return {
      ok: true,
      output: command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`,
    };
  }

  #getSimple(
    command: Extract<ParsedCommand, { verb: "get" }>,
    kind: string,
    resource: string,
    clusterScoped = false,
  ): CommandResult {
    const objects = command.name
      ? [
          this.store.get<KubeObject>(kind, command.name, clusterScoped ? "" : command.namespace),
        ].filter((object): object is KubeObject => object !== undefined)
      : this.store.list<KubeObject>(
          kind,
          clusterScoped || command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && objects.length === 0) {
      return notFound(resource, command.name);
    }

    const rows = objects
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((object) => [
        command.allNamespaces
          ? `${object.metadata.namespace}/${object.metadata.name}`
          : object.metadata.name,
        `${Math.max(0, this.clock.tick - object.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return { ok: true, output: formatTable(["NAME", "AGE"], rows) };
  }

  #getStorageClasses(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeStorageClass>("StorageClass", command.name, "")].filter(
          (item): item is KubeStorageClass => item !== undefined,
        )
      : this.store.list<KubeStorageClass>("StorageClass");

    if (command.name !== undefined && items.length === 0) {
      return notFound("storageclasses.storage.k8s.io", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        item.metadata.name,
        item.provisioner,
        item.reclaimPolicy,
        item.volumeBindingMode,
        String(item.allowVolumeExpansion ?? false),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return { ok: true, output: "No resources found." };
    }

    return {
      ok: true,
      output: formatTable(
        [
          "NAME",
          "PROVISIONER",
          "RECLAIMPOLICY",
          "VOLUMEBINDINGMODE",
          "ALLOWVOLUMEEXPANSION",
          "AGE",
        ],
        rows,
      ),
    };
  }

  #getPersistentVolumes(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubePersistentVolume>("PersistentVolume", command.name, "")].filter(
          (item): item is KubePersistentVolume => item !== undefined,
        )
      : this.store.list<KubePersistentVolume>("PersistentVolume");

    if (command.name !== undefined && items.length === 0) {
      return notFound("persistentvolumes", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        item.metadata.name,
        item.spec.capacity.storage,
        item.spec.accessModes.join(","),
        "Retain",
        item.status.phase,
        item.spec.claimRef === undefined
          ? ""
          : `${item.spec.claimRef.namespace}/${item.spec.claimRef.name}`,
        item.spec.storageClassName ?? "",
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return { ok: true, output: "No resources found." };
    }

    return {
      ok: true,
      output: formatTable(
        [
          "NAME",
          "CAPACITY",
          "ACCESS MODES",
          "RECLAIM POLICY",
          "STATUS",
          "CLAIM",
          "STORAGECLASS",
          "AGE",
        ],
        rows,
      ),
    };
  }

  #getPersistentVolumeClaims(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [
          this.store.get<KubePersistentVolumeClaim>(
            "PersistentVolumeClaim",
            command.name,
            command.namespace,
          ),
        ].filter((item): item is KubePersistentVolumeClaim => item !== undefined)
      : this.store.list<KubePersistentVolumeClaim>(
          "PersistentVolumeClaim",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && items.length === 0) {
      return notFound("persistentvolumeclaims", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        item.status.phase,
        item.spec.volumeName ?? "",
        item.status.capacity ?? item.spec.resources.requests.storage,
        item.spec.accessModes.join(","),
        item.spec.storageClassName ?? "",
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return {
      ok: true,
      output: formatTable(
        ["NAME", "STATUS", "VOLUME", "CAPACITY", "ACCESS MODES", "STORAGECLASS", "AGE"],
        rows,
      ),
    };
  }

  #getNetworkPolicies(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [
          this.store.get<KubeNetworkPolicy>("NetworkPolicy", command.name, command.namespace),
        ].filter((item): item is KubeNetworkPolicy => item !== undefined)
      : this.store.list<KubeNetworkPolicy>(
          "NetworkPolicy",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && items.length === 0) {
      return notFound("networkpolicies.networking.k8s.io", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        formatLabels(item.spec.podSelector),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return { ok: true, output: formatTable(["NAME", "POD-SELECTOR", "AGE"], rows) };
  }

  #getRoles(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    return this.#getSimple(command, "Role", "roles.rbac.authorization.k8s.io");
  }

  #getRoleBindings(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeRoleBinding>("RoleBinding", command.name, command.namespace)].filter(
          (item): item is KubeRoleBinding => item !== undefined,
        )
      : this.store.list<KubeRoleBinding>(
          "RoleBinding",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && items.length === 0) {
      return notFound("rolebindings.rbac.authorization.k8s.io", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        `${item.roleRef.kind}/${item.roleRef.name}`,
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return { ok: true, output: formatTable(["NAME", "ROLE", "AGE"], rows) };
  }

  #getNamespaces(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeNamespace>("Namespace", command.name, "")].filter(
          (item): item is KubeNamespace => item !== undefined,
        )
      : this.store.list<KubeNamespace>("Namespace");

    if (command.name !== undefined && items.length === 0) {
      return notFound("namespaces", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => [
        item.metadata.name,
        item.status.phase,
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

    return { ok: true, output: formatTable(["NAME", "STATUS", "AGE"], rows) };
  }

  #getHorizontalPodAutoscalers(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [
          this.store.get<KubeHorizontalPodAutoscaler>(
            "HorizontalPodAutoscaler",
            command.name,
            command.namespace,
          ),
        ].filter((item): item is KubeHorizontalPodAutoscaler => item !== undefined)
      : this.store.list<KubeHorizontalPodAutoscaler>(
          "HorizontalPodAutoscaler",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && items.length === 0) {
      return notFound("horizontalpodautoscalers.autoscaling", command.name);
    }

    const rows = [...items]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((item) => {
        const target = this.#hpaTarget(item);
        const utilization =
          target === undefined
            ? undefined
            : target.resource === "cpu"
              ? item.status.currentCPUUtilization
              : target.resource === "memory"
                ? item.status.currentMemoryUtilization
                : item.status.currentExternalMetric;
        return [
          command.allNamespaces
            ? `${item.metadata.namespace}/${item.metadata.name}`
            : item.metadata.name,
          `${item.spec.scaleTargetRef.kind}/${item.spec.scaleTargetRef.name}`,
          target === undefined
            ? "<none>"
            : `${target.resource}: ${
                utilization === undefined
                  ? "<unknown>"
                  : target.resource === "external"
                    ? String(utilization)
                    : `${utilization}%`
              }/${target.resource === "external" ? String(target.target) : `${target.target}%`}`,
          String(item.spec.minReplicas),
          String(item.spec.maxReplicas),
          String(item.status.currentReplicas),
          `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
        ];
      });

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return {
      ok: true,
      output: formatTable(
        ["NAME", "REFERENCE", "TARGETS", "MINPODS", "MAXPODS", "REPLICAS", "AGE"],
        rows,
      ),
    };
  }

  #getEvents(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const items = command.name
      ? [this.store.get<KubeEvent>("Event", command.name, command.namespace)].filter(
          (item): item is KubeEvent => item !== undefined,
        )
      : this.store.list<KubeEvent>("Event", command.allNamespaces ? undefined : command.namespace);

    if (command.name !== undefined && items.length === 0) {
      return notFound("events", command.name);
    }

    const rows = [...items]
      .filter((item) => this.clock.tick - item.metadata.creationTick <= 300)
      .sort((left, right) => right.metadata.creationTick - left.metadata.creationTick)
      .map((item) => [
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
        item.type,
        item.reason,
        `${item.involvedObject.kind}/${
          command.allNamespaces
            ? `${item.involvedObject.namespace ?? item.metadata.namespace}/`
            : ""
        }${item.involvedObject.name}`,
        item.message,
      ]);

    if (rows.length === 0) {
      return this.#noResources(command);
    }

    return {
      ok: true,
      output: formatTable(["LAST SEEN", "TYPE", "REASON", "OBJECT", "MESSAGE"], rows),
    };
  }

  #apply(command: Extract<ParsedCommand, { verb: "apply" }>): CommandResult {
    const source = command.path ?? command.file;
    if (source === undefined) {
      return { ok: false, output: "error: apply requires a file or directory" };
    }

    const sources = source
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
    const created: string[] = [];

    for (const current of sources) {
      const content = this.#readManifestSource(current);
      if (content === undefined) {
        return { ok: false, output: `error: unable to read ${current}` };
      }

      let parsed: unknown;
      try {
        const documents = parseAllDocuments(content).map((document) => document.toJS());
        parsed = documents.length === 1 ? documents[0] : documents;
      } catch (error) {
        return {
          ok: false,
          output: `error: failed to parse ${current}: ${error instanceof Error ? error.message : "invalid YAML"}`,
        };
      }

      const manifests = Array.isArray(parsed)
        ? parsed
        : typeof parsed === "object" && parsed !== null && "items" in parsed
          ? (parsed as { items: unknown[] }).items
          : [parsed];

      for (const manifest of manifests) {
        if (typeof manifest !== "object" || manifest === null) {
          continue;
        }
        const raw = manifest as Record<string, unknown>;
        const kind = raw.kind;
        const metadata = raw.metadata;
        if (typeof kind !== "string" || typeof metadata !== "object" || metadata === null) {
          continue;
        }
        const name = (metadata as Record<string, unknown>).name;
        if (typeof name !== "string" || name.length === 0) {
          continue;
        }

        normalizeManifestEnvFrom(raw);

        if (kind === "Deployment") {
          raw.status ??= {
            replicas: 0,
            readyReplicas: 0,
            updatedReplicas: 0,
            availableReplicas: 0,
          };
        } else if (kind === "Pod") {
          raw.status ??= { phase: "Pending" };
        } else if (kind === "PersistentVolumeClaim") {
          raw.status ??= { phase: "Pending" };
        } else if (kind === "PersistentVolume") {
          raw.status ??= { phase: "Available" };
        } else if (kind === "Namespace") {
          raw.status ??= { phase: "Active" };
        } else if (kind === "Service") {
          const spec = raw.spec as Record<string, unknown> | undefined;
          if (spec !== undefined) {
            spec.type ??= "ClusterIP";
            if (spec.clusterIP === undefined) {
              this.#serviceCounter += 1;
              spec.clusterIP = `10.96.${Math.floor((this.#serviceCounter - 1) / 254)}.${((this.#serviceCounter - 1) % 254) + 1}`;
            }
            if (spec.type === "NodePort" && Array.isArray(spec.ports)) {
              for (const port of spec.ports) {
                if (typeof port === "object" && port !== null) {
                  const servicePort = port as Record<string, unknown>;
                  servicePort.nodePort ??= this.#nextNodePort();
                }
              }
            }
          }
        } else if (kind === "Ingress") {
          const spec = raw.spec as Record<string, unknown> | undefined;
          if (spec !== undefined && Array.isArray(spec.rules)) {
            spec.rules = spec.rules.flatMap((rule) => {
              if (typeof rule !== "object" || rule === null) {
                return [];
              }
              const value = rule as Record<string, unknown>;
              const http = value.http as { paths?: Array<Record<string, unknown>> } | undefined;
              if (!Array.isArray(http?.paths)) {
                return [value];
              }
              return http.paths.flatMap((path) => {
                const backend = path.backend as
                  | { service?: { name?: string; port?: { number?: number } } }
                  | undefined;
                const service = backend?.service;
                if (
                  typeof path.path !== "string" ||
                  service?.name === undefined ||
                  service.port?.number === undefined
                ) {
                  return [];
                }
                return [
                  {
                    host: typeof value.host === "string" ? value.host : "",
                    path: path.path,
                    serviceName: service.name,
                    servicePort: service.port.number,
                  },
                ];
              });
            });
          }
        } else if (kind === "Secret") {
          const stringData = raw.stringData as Record<string, string> | undefined;
          if (stringData !== undefined) {
            raw.data = Object.fromEntries(
              Object.entries(stringData).map(([key, value]) => [key, encodeBase64(value)]),
            );
            delete raw.stringData;
          }
        }

        this.#seedObject(raw);
        created.push(`${kind.toLowerCase()}/${name} configured`);
      }
    }

    return {
      ok: created.length > 0,
      output:
        created.length > 0
          ? created.join("\n")
          : `error: no supported resources found in ${source}`,
    };
  }

  #readManifestSource(source: string): string | undefined {
    if (this.#files[source] !== undefined) {
      return this.#files[source];
    }
    const rendered = this.#renderKustomize(source);
    if (rendered !== undefined) {
      return rendered;
    }
    const prefix = `${source.replace(/\/$/, "")}/`;
    const nested = Object.entries(this.#files)
      .filter(([name]) => name.startsWith(prefix))
      .sort(([left], [right]) => left.localeCompare(right));
    if (nested.length === 0) {
      return undefined;
    }
    return nested.map(([, content]) => content).join("\n---\n");
  }

  #helm(command: Extract<ParsedCommand, { verb: "helm" }>): CommandResult {
    if (command.action === "install" || command.action === "upgrade") {
      const existing = this.store.get<KubeHelmRelease>(
        "HelmRelease",
        command.name ?? "",
        command.namespace,
      );
      if (command.action === "install" && existing !== undefined) {
        return { ok: false, output: "Error: release already exists" };
      }
      const revision = (existing?.history.at(-1)?.revision ?? 0) + 1;
      const chartName = (command.chart ?? "chart").split("/").pop() ?? "chart";
      const release: KubeHelmRelease = {
        apiVersion: "helm.sh/v3",
        kind: "HelmRelease",
        metadata: {
          name: command.name ?? chartName,
          namespace: command.namespace,
          labels: {},
          uid: this.#nextUid("release"),
          resourceVersion: 0,
          creationTick: this.clock.tick,
        },
        chartName,
        chartVersion: "0.1.0",
        status: "deployed",
        history: [
          ...(existing?.history ?? []).map((entry) => ({ ...entry, status: "superseded" })),
          {
            revision,
            status: "deployed",
            chart: `${chartName}-0.1.0`,
            description: `${command.action} complete`,
          },
        ],
      };
      this.store.upsert(release);
      if (command.chart !== undefined) {
        this.#apply({
          verb: "apply",
          file: command.chart,
          namespace: command.namespace,
        });
      }
      return { ok: true, output: `release "${release.metadata.name}" deployed` };
    }

    const releases = this.store
      .list<KubeHelmRelease>(
        "HelmRelease",
        command.action === "list" ? undefined : command.namespace,
      )
      .filter((release) => command.name === undefined || release.metadata.name === command.name);

    if (command.action === "list") {
      const rows = releases
        .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
        .map((release) => [
          release.metadata.name,
          String(release.history.at(-1)?.revision ?? 1),
          release.status,
          `${release.chartName}-${release.chartVersion}`,
          release.appVersion ?? "",
        ]);
      return {
        ok: true,
        output:
          rows.length === 0
            ? "NAME	REVISION	STATUS	CHART	APP VERSION"
            : formatTable(["NAME", "REVISION", "STATUS", "CHART", "APP VERSION"], rows),
      };
    }

    const release = releases[0];
    if (release === undefined) {
      return {
        ok: false,
        output: `Error: release: not found`,
      };
    }

    if (command.action === "history") {
      return {
        ok: true,
        output: formatTable(
          ["REVISION", "STATUS", "CHART", "DESCRIPTION"],
          release.history.map((entry) => [
            String(entry.revision),
            entry.status,
            entry.chart,
            entry.description,
          ]),
        ),
      };
    }

    if (command.action === "rollback") {
      const target = release.history.find((entry) => entry.revision === command.revision);
      if (target === undefined) {
        return { ok: false, output: `Error: revision ${command.revision ?? 0} not found` };
      }
      const revision = Math.max(...release.history.map((entry) => entry.revision)) + 1;
      this.store.upsert({
        ...release,
        status: "deployed",
        history: [
          ...release.history,
          {
            revision,
            status: "deployed",
            chart: target.chart,
            description: `rollback to ${target.revision}`,
          },
        ],
      });
      return { ok: true, output: `rollback to revision ${target.revision}` };
    }

    return {
      ok: true,
      output: [
        `NAME: ${release.metadata.name}`,
        `NAMESPACE: ${release.metadata.namespace}`,
        `STATUS: ${release.status}`,
        `CHART: ${release.chartName}-${release.chartVersion}`,
        `APP VERSION: ${release.appVersion ?? ""}`,
        `REVISION: ${release.history.at(-1)?.revision ?? 1}`,
      ].join("\n"),
    };
  }

  #argocd(command: Extract<ParsedCommand, { verb: "argocd" }>): CommandResult {
    const applications = this.store
      .list<KubeApplication>("Application")
      .filter(
        (application) => command.name === undefined || application.metadata.name === command.name,
      );

    if (command.action === "list") {
      const rows = applications
        .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
        .map((application) => [
          application.metadata.name,
          application.syncStatus,
          application.healthStatus,
          `${application.source.repoURL}/${application.source.path}`,
        ]);
      return {
        ok: true,
        output: formatTable(["NAME", "SYNC STATUS", "HEALTH", "SOURCE"], rows),
      };
    }

    if (command.action === "sync") {
      const application = applications[0];
      if (application === undefined) {
        return { ok: false, output: "Application not found" };
      }
      this.#apply({
        verb: "apply",
        file: application.source.path,
        namespace: application.destination.namespace,
      });
      const source = this.#readManifestSource(application.source.path);
      this.store.upsert({
        ...application,
        syncStatus: "Synced",
        healthStatus: "Healthy",
        ...(source === undefined ? {} : { lastAppliedHash: hashString(source).toString(36) }),
      });
      return { ok: true, output: `Sync successful for ${application.metadata.name}` };
    }

    const application = applications[0];
    if (application === undefined) {
      return { ok: false, output: "Application not found" };
    }

    return {
      ok: true,
      output: [
        `Name: ${application.metadata.name}`,
        `Sync Status: ${application.syncStatus}`,
        `Health: ${application.healthStatus}`,
        `Repo: ${application.source.repoURL}`,
        `Path: ${application.source.path}`,
        `Revision: ${application.source.revision ?? "HEAD"}`,
        `Destination: ${application.destination.namespace}`,
      ].join("\n"),
    };
  }

  #kustomize(command: Extract<ParsedCommand, { verb: "kustomize" }>): CommandResult {
    const output = this.#renderKustomize(command.path);
    if (output === undefined) {
      return { ok: false, output: `error: unable to read kustomization directory ${command.path}` };
    }
    return { ok: true, output };
  }

  #renderKustomize(source: string): string | undefined {
    const kustomizationPath = [`${source}/kustomization.yaml`, `${source}/kustomization.yml`].find(
      (path) => this.#files[path] !== undefined,
    );
    if (kustomizationPath === undefined) {
      return this.#files[source];
    }
    const parsed = parseAllDocuments(this.#files[kustomizationPath] ?? "")[0]?.toJS() as
      | Record<string, unknown>
      | undefined;
    if (parsed === undefined || !Array.isArray(parsed.resources)) {
      return this.#files[kustomizationPath];
    }
    const documents: Array<Record<string, unknown>> = [];
    for (const resource of parsed.resources) {
      if (typeof resource !== "string") {
        continue;
      }
      const content = this.#files[`${source}/${resource}`] ?? this.#files[resource];
      if (content === undefined) {
        continue;
      }
      for (const document of parseAllDocuments(content)) {
        const value = document.toJS();
        if (typeof value === "object" && value !== null) {
          documents.push(value as Record<string, unknown>);
        }
      }
    }
    const patchPaths = [
      ...(Array.isArray(parsed.patchesStrategicMerge) ? parsed.patchesStrategicMerge : []),
      ...(Array.isArray(parsed.patches)
        ? parsed.patches.flatMap((patch) =>
            typeof patch === "object" && patch !== null && "path" in patch
              ? [(patch as { path: unknown }).path]
              : [],
          )
        : []),
    ];
    for (const patchPath of patchPaths) {
      if (typeof patchPath !== "string") {
        continue;
      }
      const content = this.#files[`${source}/${patchPath}`] ?? this.#files[patchPath];
      if (content === undefined) {
        continue;
      }
      for (const document of parseAllDocuments(content)) {
        const patch = document.toJS() as Record<string, unknown> | undefined;
        if (patch === undefined) {
          continue;
        }
        const metadata = patch.metadata as Record<string, unknown> | undefined;
        const index = documents.findIndex((candidate) => {
          const candidateMetadata = candidate.metadata as Record<string, unknown> | undefined;
          return candidate.kind === patch.kind && candidateMetadata?.name === metadata?.name;
        });
        if (index !== -1) {
          documents[index] = mergeManifest(documents[index] ?? {}, patch);
        }
      }
    }
    return documents.map((document) => stringifyYaml(document).trimEnd()).join("\n---\n");
  }

  #logs(command: Extract<ParsedCommand, { verb: "logs" }>): CommandResult {
    const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
    if (pod === undefined) {
      return notFound("pods", command.name);
    }

    if (command.container !== undefined) {
      if (!pod.spec.containers.some((container) => container.name === command.container)) {
        return {
          ok: false,
          output: `error: container ${command.container} is not valid for pod ${command.name}`,
        };
      }
    } else if (pod.spec.containers.length > 1) {
      return {
        ok: false,
        output: `error: a container name must be specified for pod ${command.name}`,
      };
    }

    return { ok: true, output: (pod.logs ?? ["(no logs)"]).join("\n") };
  }

  #auth(command: Extract<ParsedCommand, { verb: "auth" }>): CommandResult {
    const match = /^system:serviceaccount:([^:]+):(.+)$/.exec(command.as ?? "");
    if (match === null) {
      return { ok: true, output: "no" };
    }
    const [, namespace, name] = match;
    if (namespace === undefined || name === undefined) {
      return { ok: true, output: "no" };
    }

    const allowed = [
      ...this.store.list<KubeRoleBinding>("RoleBinding", namespace),
      ...this.store.list<KubeRoleBinding>("ClusterRoleBinding"),
    ]
      .filter((binding) =>
        binding.subjects.some(
          (subject) =>
            subject.kind === "ServiceAccount" &&
            subject.name === name &&
            (subject.namespace ?? namespace) === namespace,
        ),
      )
      .some((binding) => {
        const role =
          binding.roleRef.kind === "ClusterRole"
            ? this.store.get<KubeRole>("ClusterRole", binding.roleRef.name, "")
            : this.store.get<KubeRole>("Role", binding.roleRef.name, namespace);
        return (
          role?.rules.some(
            (rule) =>
              (rule.verbs.includes(command.subjectVerb) || rule.verbs.includes("*")) &&
              (rule.resources.includes(command.subjectResource) || rule.resources.includes("*")),
          ) ?? false
        );
      });

    return { ok: true, output: allowed ? "yes" : "no" };
  }

  #getIngresses(command: Extract<ParsedCommand, { verb: "get" }>): CommandResult {
    const ingresses = command.name
      ? [this.store.get<KubeIngress>("Ingress", command.name, command.namespace)].filter(
          (ingress): ingress is KubeIngress => ingress !== undefined,
        )
      : this.store.list<KubeIngress>(
          "Ingress",
          command.allNamespaces ? undefined : command.namespace,
        );

    if (command.name !== undefined && ingresses.length === 0) {
      return notFound("ingresses.networking.k8s.io", command.name);
    }

    const selector = Object.entries(command.selector);
    const filtered = ingresses
      .filter((ingress) => selector.every(([key, value]) => ingress.metadata.labels[key] === value))
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name));

    if (filtered.length === 0) {
      const scope = command.allNamespaces
        ? "No resources found."
        : `No resources found in ${command.namespace} namespace.`;
      return { ok: true, output: scope };
    }

    const headers = ["NAME", "CLASS", "HOSTS", "ADDRESS", "PORTS", "AGE"];
    if (command.showLabels) {
      headers.push("LABELS");
    }

    const rows = filtered.map((ingress) => {
      const name = command.allNamespaces
        ? `${ingress.metadata.namespace}/${ingress.metadata.name}`
        : ingress.metadata.name;
      const hosts = ingress.spec.rules.map((rule) => rule.host).join(",");
      const ports = ingress.spec.rules.map((rule) => rule.servicePort).join(",");
      const row = [
        name,
        ingress.spec.ingressClassName ?? "<none>",
        hosts,
        "<none>",
        ports,
        `${Math.max(0, this.clock.tick - ingress.metadata.creationTick)}s`,
      ];
      if (command.showLabels) {
        row.push(formatLabels(ingress.metadata.labels));
      }
      return row;
    });

    return { ok: true, output: formatTable(headers, rows) };
  }

  #delete(command: Extract<ParsedCommand, { verb: "delete" }>): CommandResult {
    const tick = this.clock.tick;

    if (command.resource === "deployments") {
      const deployment = this.store.get<KubeDeployment>(
        "Deployment",
        command.name,
        command.namespace,
      );
      if (deployment === undefined) {
        return notFound("deployments.apps", command.name);
      }

      for (const replicaSet of this.#replicaSetsFor(deployment)) {
        for (const pod of this.#replicaSetPods(replicaSet)) {
          this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
          this.events.emit({ type: "pod.deleted", tick, pod });
        }
        this.store.delete("ReplicaSet", replicaSet.metadata.name, replicaSet.metadata.namespace);
      }
      this.store.delete("Deployment", deployment.metadata.name, deployment.metadata.namespace);

      return { ok: true, output: `deployment.apps "${command.name}" deleted` };
    }

    if (command.resource === "services") {
      const service = this.store.get<KubeService>("Service", command.name, command.namespace);
      if (service === undefined) {
        return notFound("services", command.name);
      }

      this.store.delete("Service", service.metadata.name, service.metadata.namespace);
      return { ok: true, output: `service "${command.name}" deleted` };
    }

    if (command.resource === "ingresses") {
      const ingress = this.store.get<KubeIngress>("Ingress", command.name, command.namespace);
      if (ingress === undefined) {
        return notFound("ingresses.networking.k8s.io", command.name);
      }

      this.store.delete("Ingress", ingress.metadata.name, ingress.metadata.namespace);
      return { ok: true, output: `ingress.networking.k8s.io "${command.name}" deleted` };
    }

    if (command.resource === "configmaps") {
      const configMap = this.store.get<KubeConfigMap>("ConfigMap", command.name, command.namespace);
      if (configMap === undefined) {
        return notFound("configmaps", command.name);
      }
      this.store.delete("ConfigMap", configMap.metadata.name, configMap.metadata.namespace);
      return { ok: true, output: `configmap "${command.name}" deleted` };
    }

    if (command.resource === "secrets") {
      const secret = this.store.get<KubeSecret>("Secret", command.name, command.namespace);
      if (secret === undefined) {
        return notFound("secrets", command.name);
      }
      this.store.delete("Secret", secret.metadata.name, secret.metadata.namespace);
      return { ok: true, output: `secret "${command.name}" deleted` };
    }

    if (command.resource === "persistentvolumeclaims") {
      const claim = this.store.get<KubePersistentVolumeClaim>(
        "PersistentVolumeClaim",
        command.name,
        command.namespace,
      );
      if (claim === undefined) {
        return notFound("persistentvolumeclaims", command.name);
      }
      const volume =
        claim.spec.volumeName === undefined
          ? this.store
              .list<KubePersistentVolume>("PersistentVolume")
              .find(
                (candidate) =>
                  candidate.spec.claimRef?.namespace === claim.metadata.namespace &&
                  candidate.spec.claimRef.name === claim.metadata.name,
              )
          : this.store.get<KubePersistentVolume>("PersistentVolume", claim.spec.volumeName, "");
      this.store.delete("PersistentVolumeClaim", claim.metadata.name, claim.metadata.namespace);
      if (volume !== undefined) {
        const storageClass =
          volume.spec.storageClassName === undefined
            ? undefined
            : this.store.get<KubeStorageClass>("StorageClass", volume.spec.storageClassName, "");
        const reclaimPolicy = volume.spec.reclaimPolicy ?? storageClass?.reclaimPolicy ?? "Retain";
        if (reclaimPolicy === "Delete") {
          this.store.delete("PersistentVolume", volume.metadata.name, "");
        } else {
          this.store.upsert({ ...volume, status: { phase: "Released" } });
        }
      }
      return { ok: true, output: `persistentvolumeclaim "${command.name}" deleted` };
    }

    if (command.resource === "persistentvolumes") {
      const volume = this.store.get<KubePersistentVolume>("PersistentVolume", command.name, "");
      if (volume === undefined) {
        return notFound("persistentvolumes", command.name);
      }
      this.store.delete("PersistentVolume", volume.metadata.name, "");
      return { ok: true, output: `persistentvolume "${command.name}" deleted` };
    }

    const workloadKinds: Record<string, { kind: string; label: string; suffix: string }> = {
      daemonsets: { kind: "DaemonSet", label: "daemonset", suffix: "apps" },
      statefulsets: { kind: "StatefulSet", label: "statefulset", suffix: "apps" },
      jobs: { kind: "Job", label: "job-name", suffix: "batch" },
    };
    const workload = workloadKinds[command.resource];
    if (workload !== undefined) {
      const object = this.store.get<KubeObject>(workload.kind, command.name, command.namespace);
      if (object === undefined) {
        return notFound(`${command.resource}.${workload.suffix}`, command.name);
      }
      for (const pod of this.store
        .list<Pod>("Pod", command.namespace)
        .filter((candidate) => candidate.metadata.labels[workload.label] === command.name)) {
        this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
      }
      this.store.delete(workload.kind, command.name, command.namespace);
      return {
        ok: true,
        output: `${command.resource}.${workload.suffix} "${command.name}" deleted`,
      };
    }

    if (command.resource === "cronjobs") {
      const cronJob = this.store.get<KubeCronJob>("CronJob", command.name, command.namespace);
      if (cronJob === undefined) {
        return notFound("cronjobs.batch", command.name);
      }
      for (const job of this.store
        .list<KubeJob>("Job", command.namespace)
        .filter((candidate) => candidate.metadata.labels.cronjob === command.name)) {
        for (const pod of this.store
          .list<Pod>("Pod", command.namespace)
          .filter((candidate) => candidate.metadata.labels["job-name"] === job.metadata.name)) {
          this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
        }
        this.store.delete("Job", job.metadata.name, job.metadata.namespace);
      }
      this.store.delete("CronJob", command.name, command.namespace);
      return { ok: true, output: `cronjobs.batch "${command.name}" deleted` };
    }

    if (command.resource !== "pods") {
      return notSimulated("deleting", command.resource);
    }

    const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
    if (pod === undefined) {
      return notFound("pods", command.name);
    }

    this.store.delete("Pod", command.name, command.namespace);
    this.events.emit({ type: "pod.deleted", tick, pod });

    return { ok: true, output: `pod "${command.name}" deleted` };
  }

  #describe(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
    if (command.resource === "nodes") {
      return this.#describeNode(command);
    }

    const genericKinds: Record<string, string> = {
      storageclasses: "StorageClass",
      persistentvolumes: "PersistentVolume",
      persistentvolumeclaims: "PersistentVolumeClaim",
      networkpolicies: "NetworkPolicy",
      resourcequotas: "ResourceQuota",
      limitranges: "LimitRange",
      poddisruptionbudgets: "PodDisruptionBudget",
      serviceaccounts: "ServiceAccount",
      roles: "Role",
      rolebindings: "RoleBinding",
      clusterroles: "ClusterRole",
      clusterrolebindings: "ClusterRoleBinding",
      namespaces: "Namespace",
      horizontalpodautoscalers: "HorizontalPodAutoscaler",
      events: "Event",
    };
    const genericKind = genericKinds[command.resource];
    if (genericKind !== undefined) {
      return this.#describeGeneric(command, genericKind);
    }

    if (command.resource === "deployments") {
      return this.#describeDeployment(command);
    }

    if (command.resource === "services") {
      return this.#describeService(command);
    }

    if (command.resource === "ingresses") {
      return this.#describeIngress(command);
    }

    if (command.resource !== "pods") {
      const customKind = this.#customKind(command.resource);
      if (this.store.get(customKind, command.name, command.namespace) !== undefined) {
        return this.#describeGeneric(command, customKind);
      }
      return notSimulated("describing", command.resource);
    }

    const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
    if (pod === undefined) {
      return notFound("pods", command.name);
    }

    const labels =
      Object.entries(pod.metadata.labels)
        .map(([key, value]) => `${key}=${value}`)
        .join(",") || "<none>";

    const lines = [
      `Name:         ${pod.metadata.name}`,
      `Namespace:    ${pod.metadata.namespace}`,
      `Node:         ${pod.spec.nodeName ?? "<none>"}`,
      `Status:       ${pod.status.phase}`,
      `Labels:       ${labels}`,
      "Containers:",
      ...pod.spec.containers.map((container) => {
        const containerStatus = pod.status.containerStatuses?.find(
          (status) => status.name === container.name,
        );
        return `  ${container.name}:\n    Image: ${container.image}${
          containerStatus === undefined
            ? ""
            : `\n    Ready: ${containerStatus.ready}\n    Restart Count: ${containerStatus.restartCount}${
                containerStatus.reason === undefined
                  ? ""
                  : `\n    State Reason: ${containerStatus.reason}`
              }`
        }`;
      }),
    ];

    if (pod.status.podIP !== undefined) {
      lines.push(`IP:           ${pod.status.podIP}`);
    }

    const securityContext = pod.spec.securityContext;
    if (securityContext !== undefined) {
      lines.push(
        `Security:     runAsNonRoot=${securityContext.runAsNonRoot ?? "<unset>"}${
          securityContext.runAsUser === undefined ? "" : ` runAsUser=${securityContext.runAsUser}`
        }${
          securityContext.seccompProfile === undefined
            ? ""
            : ` seccompProfile=${securityContext.seccompProfile.type}`
        }`,
      );
    }

    if (pod.spec.volumes !== undefined && pod.spec.volumes.length > 0) {
      lines.push("Volumes:");
      for (const volume of pod.spec.volumes) {
        const source =
          volume.persistentVolumeClaim === undefined
            ? volume.configMap !== undefined
              ? `ConfigMap/${volume.configMap.name}`
              : volume.secret !== undefined
                ? `Secret/${volume.secret.secretName}`
                : "<none>"
            : `PVC/${volume.persistentVolumeClaim.claimName}`;
        lines.push(`  ${volume.name}: ${source}`);
      }
    }

    for (const container of pod.spec.containers) {
      const containerSecurity = container.securityContext;
      if (containerSecurity !== undefined) {
        lines.push(
          `Container Security (${container.name}): allowPrivilegeEscalation=${containerSecurity.allowPrivilegeEscalation ?? "<unset>"} readOnlyRootFilesystem=${containerSecurity.readOnlyRootFilesystem ?? "<unset>"}${
            containerSecurity.capabilities?.drop === undefined
              ? ""
              : ` drop=${containerSecurity.capabilities.drop.join(",")}`
          }`,
        );
      }
    }

    if (pod.status.conditions !== undefined) {
      lines.push("Conditions:");
      for (const condition of pod.status.conditions) {
        lines.push(
          `  ${condition.type}: ${condition.status}${condition.reason === undefined ? "" : ` (${condition.reason})`}${condition.message === undefined ? "" : ` - ${condition.message}`}`,
        );
      }
    }

    if (pod.status.message !== undefined) {
      lines.push("", `Message:      ${pod.status.message}`);
    }

    return { ok: true, output: lines.join("\n") };
  }

  #describeNode(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
    const node = this.store.get<KubeNode>("Node", command.name, "");
    if (node === undefined) {
      return notFound("nodes", command.name);
    }

    const pods = this.store
      .list<Pod>("Pod")
      .filter((pod) => pod.spec.nodeName === node.metadata.name);
    return {
      ok: true,
      output: [
        `Name:               ${node.metadata.name}`,
        `Labels:             ${formatLabels(node.metadata.labels)}`,
        `Taints:             ${
          node.spec?.taints === undefined || node.spec.taints.length === 0
            ? "<none>"
            : node.spec.taints
                .map((taint) =>
                  taint.value === undefined
                    ? `${taint.key}:${taint.effect}`
                    : `${taint.key}=${taint.value}:${taint.effect}`,
                )
                .join(", ")
        }`,
        `Allocatable:        cpu=${node.status.allocatable.cpu}, memory=${node.status.allocatable.memory}`,
        `Non-terminated Pods: ${pods.length}`,
        ...pods.map((pod) => `  ${pod.metadata.namespace}/${pod.metadata.name}`),
      ].join("\n"),
    };
  }

  #describeGeneric(
    command: Extract<ParsedCommand, { verb: "describe" }>,
    kind: string,
  ): CommandResult {
    const clusterScoped =
      kind === "Namespace" ||
      kind === "PersistentVolume" ||
      kind === "StorageClass" ||
      kind === "ClusterRole" ||
      kind === "ClusterRoleBinding";
    const object = this.store.get<KubeObject>(
      kind,
      command.name,
      clusterScoped ? "" : command.namespace,
    );
    if (object === undefined) {
      return notFound(command.resource, command.name);
    }

    const { metadata: _metadata, ...rest } = object as unknown as Record<string, unknown>;
    return {
      ok: true,
      output: [
        `Name:       ${object.metadata.name}`,
        `Namespace:  ${object.metadata.namespace || "<none>"}`,
        `Labels:     ${formatLabels(object.metadata.labels)}`,
        JSON.stringify(rest, null, 2),
      ].join("\n"),
    };
  }

  #describeDeployment(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
    const deployment = this.store.get<KubeDeployment>(
      "Deployment",
      command.name,
      command.namespace,
    );
    if (deployment === undefined) {
      return notFound("deployments.apps", command.name);
    }

    const containerLines = deployment.spec.template.containers.flatMap((container) => {
      const lines = [`  ${container.name}:`, `    Image: ${container.image}`];
      for (const source of container.envFrom ?? []) {
        lines.push(`    EnvFrom: ${source.kind}/${source.name}`);
      }
      for (const variable of container.env ?? []) {
        if (variable.source === undefined) {
          lines.push(`    ${variable.name}: ${variable.value}`);
        }
      }
      return lines;
    });

    return {
      ok: true,
      output: [
        `Name:                   ${deployment.metadata.name}`,
        `Namespace:              ${deployment.metadata.namespace}`,
        `Labels:                 ${formatLabels(deployment.metadata.labels)}`,
        `Selector:               ${formatLabels(deployment.spec.template.labels)}`,
        `Replicas:               ${deployment.spec.replicas} desired | ${deployment.status.updatedReplicas} updated | ${deployment.status.availableReplicas} available`,
        "StrategyType:           RollingUpdate",
        "Containers:",
        ...containerLines,
      ].join("\n"),
    };
  }

  #describeService(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
    const service = this.store.get<KubeService>("Service", command.name, command.namespace);
    if (service === undefined) {
      return notFound("services", command.name);
    }

    const pods = this.#servicePods(service);
    const endpoints = pods
      .map((pod) => `${pod.status.podIP ?? "<none>"}:${service.spec.ports[0]?.targetPort ?? 80}`)
      .join(",");

    return {
      ok: true,
      output: [
        `Name:              ${service.metadata.name}`,
        `Namespace:         ${service.metadata.namespace}`,
        `Labels:            ${formatLabels(service.metadata.labels)}`,
        `Selector:          ${formatLabels(service.spec.selector)}`,
        `Type:              ${service.spec.type}`,
        `IP:                ${service.spec.clusterIP}`,
        `Port:              ${service.spec.ports.map((port) => `${port.port}/${port.targetPort}`).join(", ")}`,
        `Endpoints:         ${endpoints.length > 0 ? endpoints : "<none>"}`,
        `Session Affinity:  None`,
      ].join("\n"),
    };
  }

  #describeIngress(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
    const ingress = this.store.get<KubeIngress>("Ingress", command.name, command.namespace);
    if (ingress === undefined) {
      return notFound("ingresses.networking.k8s.io", command.name);
    }

    return {
      ok: true,
      output: [
        `Name:             ${ingress.metadata.name}`,
        `Namespace:        ${ingress.metadata.namespace}`,
        `Labels:           ${formatLabels(ingress.metadata.labels)}`,
        `Ingress Class:    ${ingress.spec.ingressClassName ?? "<none>"}`,
        "Rules:",
        ...ingress.spec.rules.map(
          (rule) =>
            `  Host: ${rule.host}\n  Path: ${rule.path}\n  Backend: ${rule.serviceName}:${rule.servicePort}`,
        ),
      ].join("\n"),
    };
  }

  #reconcile(): void {
    const readyNodes = this.store.list<KubeNode>("Node").filter((node) => node.status.ready);
    const tick = this.clock.tick;

    this.#reconcileWidgets();
    this.#reconcileApplications();
    this.#reconcileAutoscalers();
    this.#reconcileCronJobs();
    this.#reconcileJobs();
    this.#reconcileDaemonSets();
    this.#reconcileStatefulSets();
    this.#reconcileDeployments();
    this.#reconcileReplicaSets();
    this.#reconcileStorage();

    for (const original of this.store.list<Pod>("Pod")) {
      let pod = original;
      if (pod.status.phase !== "Pending") {
        continue;
      }

      pod = this.#applyLimitRangeDefaults(pod);
      const securityError = this.#podSecurityViolation(pod);
      if (securityError !== undefined) {
        this.store.upsert({
          ...pod,
          status: { ...pod.status, phase: "Pending", message: securityError },
        });
        continue;
      }
      const quotaError = this.#quotaError(pod);
      if (quotaError !== undefined) {
        this.store.upsert({
          ...pod,
          status: { ...pod.status, phase: "Pending", message: quotaError },
        });
        continue;
      }

      if (pod.spec.nodeName === undefined) {
        const eligible = readyNodes
          .filter((candidate) => this.#podFitsNode(candidate, pod))
          .sort((left, right) => {
            const leftCount = this.store
              .list<Pod>("Pod")
              .filter((candidate) => candidate.spec.nodeName === left.metadata.name).length;
            const rightCount = this.store
              .list<Pod>("Pod")
              .filter((candidate) => candidate.spec.nodeName === right.metadata.name).length;
            return leftCount - rightCount;
          });
        const readyNode = eligible[0];

        if (readyNode === undefined) {
          const unavailable: Pod = {
            ...pod,
            status: {
              phase: "Pending",
              message:
                readyNodes.length === 0
                  ? "0 nodes are available"
                  : `${readyNodes.length} nodes are available, but none match the Pod's selector, affinity, or tolerations`,
            },
          };
          this.store.upsert(unavailable);
          continue;
        }

        this.#ipCounter += 1;
        const scheduled: Pod = {
          ...pod,
          spec: { ...pod.spec, nodeName: readyNode.metadata.name },
          status: {
            phase: "Pending",
            message: `Scheduled on ${readyNode.metadata.name}`,
            podIP: `10.244.0.${this.#ipCounter}`,
          },
        };

        const stored = this.store.upsert(scheduled);

        this.events.emit({ type: "pod.scheduled", tick, pod: stored });
        continue;
      }

      if (
        pod.spec.initContainers !== undefined &&
        pod.spec.initContainers.length > 0 &&
        pod.status.initialized !== true
      ) {
        this.store.upsert({
          ...pod,
          status: {
            ...pod.status,
            phase: "Pending",
            message: `Init:0/${pod.spec.initContainers.length}`,
            initialized: true,
          },
        });
        continue;
      }

      const running: Pod = {
        ...pod,
        status: {
          ...pod.status,
          phase: "Running",
          ...(pod.status.podIP === undefined ? {} : { podIP: pod.status.podIP }),
          containerStatuses:
            pod.status.containerStatuses ??
            pod.spec.containers.map((container) => ({
              name: container.name,
              ready: container.readinessProbe === undefined,
              restartCount: 0,
              state: "running",
            })),
          ...(pod.status.conditions !== undefined ||
          !pod.spec.containers.some((container) => container.readinessProbe !== undefined)
            ? {}
            : {
                conditions: [
                  {
                    type: "Ready",
                    status: "False",
                    reason: "ContainersNotReady",
                    message: "containers with unready status",
                  },
                ],
              }),
        },
      };

      const stored = this.store.upsert(running);

      this.events.emit({ type: "pod.running", tick, pod: stored });
    }

    for (const pod of this.store.list<Pod>("Pod")) {
      if (pod.status.phase === "Running") {
        this.#reconcilePodHealth(pod);
      }
    }

    this.#updateDeploymentStatuses();
    this.#reconcilePodDisruptionBudgets();
    this.#reconcileResourceQuotas();
  }

  #reconcilePodHealth(pod: Pod): void {
    const hasProbes = pod.spec.containers.some(
      (container) =>
        container.readinessProbe !== undefined ||
        container.livenessProbe !== undefined ||
        container.startupProbe !== undefined,
    );
    if (!hasProbes) {
      return;
    }

    const tick = this.clock.tick;
    if (pod.status.backoffUntil !== undefined && tick < pod.status.backoffUntil) {
      return;
    }

    const statuses = this.#containerStatusesFor(pod);
    const probeState: Record<string, ProbeState> = { ...(pod.status.probeState ?? {}) };
    const conditions = [...(pod.status.conditions ?? [])];
    let reason = pod.status.reason;
    let backoffUntil = pod.status.backoffUntil;
    let changed = false;

    if (backoffUntil !== undefined) {
      backoffUntil = undefined;
      reason = undefined;
      changed = true;
    }

    let restartHappened = false;
    let crashLoop = false;

    for (const container of pod.spec.containers) {
      const containerStatus = statuses.find((status) => status.name === container.name);
      if (containerStatus === undefined) {
        continue;
      }

      if (container.startupProbe !== undefined) {
        const result = this.#checkProbe("startup", container, pod, probeState);
        if (
          result !== undefined &&
          !result.ok &&
          result.failures >= (container.startupProbe.failureThreshold ?? 3)
        ) {
          containerStatus.ready = false;
          containerStatus.reason = "StartupProbeFailed";
          this.#setReadyCondition(
            conditions,
            false,
            "StartupProbeFailed",
            `Startup probe failed: ${result.detail}`,
          );
          if (result.failures === (container.startupProbe.failureThreshold ?? 3)) {
            this.#recordProbeEvent(pod, "Unhealthy", `Startup probe failed: ${result.detail}`);
          }
          changed = true;
          continue;
        }
        if ((probeState[`${container.name}:startup`]?.successes ?? 0) === 0) {
          continue;
        }
        if (result?.ok && container.readinessProbe === undefined && !containerStatus.ready) {
          containerStatus.ready = true;
          delete containerStatus.reason;
          changed = true;
        }
      }

      if (container.readinessProbe !== undefined) {
        const result = this.#checkProbe("readiness", container, pod, probeState);
        if (result !== undefined) {
          if (result.ok) {
            if (!containerStatus.ready) {
              containerStatus.ready = true;
              changed = true;
            }
            delete containerStatus.reason;
          } else if (result.failures >= (container.readinessProbe.failureThreshold ?? 3)) {
            if (containerStatus.reason !== "ContainersNotReady") {
              this.#recordProbeEvent(pod, "Unhealthy", `Readiness probe failed: ${result.detail}`);
            }
            containerStatus.ready = false;
            containerStatus.reason = "ContainersNotReady";
            this.#setReadyCondition(
              conditions,
              false,
              "ContainersNotReady",
              `Readiness probe failed: ${result.detail}`,
            );
            changed = true;
          }
        }
      }

      if (container.livenessProbe !== undefined) {
        const result = this.#checkProbe("liveness", container, pod, probeState);
        if (
          result !== undefined &&
          !result.ok &&
          result.failures >= (container.livenessProbe.failureThreshold ?? 3)
        ) {
          containerStatus.restartCount += 1;
          containerStatus.ready = false;
          containerStatus.reason =
            containerStatus.restartCount >= 3 ? "CrashLoopBackOff" : "ContainerRestarting";
          containerStatus.state = "running";
          restartHappened = true;
          changed = true;
          probeState[`${container.name}:readiness`] = { lastTick: tick, failures: 0, successes: 0 };
          probeState[`${container.name}:liveness`] = { lastTick: tick, failures: 0, successes: 0 };
          this.#recordProbeEvent(pod, "Unhealthy", `Liveness probe failed: ${result.detail}`);

          if (containerStatus.restartCount >= 3) {
            const delay = Math.min(30, 2 ** (containerStatus.restartCount - 3));
            crashLoop = true;
            reason = "CrashLoopBackOff";
            backoffUntil = tick + delay;
            this.#recordProbeEvent(
              pod,
              "BackOff",
              `Back-off ${delay}s restarting failed container ${container.name}`,
            );
          }
        } else if (result?.ok && containerStatus.reason === "ContainerRestarting") {
          delete containerStatus.reason;
          if (container.readinessProbe === undefined || containerStatus.ready) {
            containerStatus.ready = true;
          }
          changed = true;
        }
      }
    }

    const allReady = statuses.every((status) => status.ready);
    if (crashLoop) {
      this.#setReadyCondition(
        conditions,
        false,
        "CrashLoopBackOff",
        pod.status.message ?? "back-off restarting failed container",
      );
    } else if (restartHappened) {
      this.#setReadyCondition(conditions, allReady, allReady ? "Ready" : "ContainerRestarting");
    } else if (allReady) {
      const current = conditions.find((condition) => condition.type === "Ready");
      if (current?.status !== "True") {
        this.#setReadyCondition(conditions, true, "Ready");
        changed = true;
      }
    }

    if (!crashLoop) {
      reason = undefined;
    }

    if (!changed && pod.status.probeState !== undefined) {
      return;
    }

    this.store.upsert({
      ...pod,
      status: {
        ...pod.status,
        conditions,
        containerStatuses: statuses,
        probeState,
        ...(reason === undefined ? { reason: undefined } : { reason }),
        ...(backoffUntil === undefined ? { backoffUntil: undefined } : { backoffUntil }),
      },
    });
  }

  #checkProbe(
    kind: "readiness" | "liveness" | "startup",
    container: Pod["spec"]["containers"][number],
    pod: Pod,
    probeState: Record<string, ProbeState>,
  ): { ok: boolean; detail: string; failures: number; successes: number } | undefined {
    const probe =
      kind === "readiness"
        ? container.readinessProbe
        : kind === "liveness"
          ? container.livenessProbe
          : container.startupProbe;
    if (probe === undefined) {
      return undefined;
    }

    const tick = this.clock.tick;
    const initialDelay = probe.initialDelaySeconds ?? 0;
    if (tick - pod.metadata.creationTick < initialDelay) {
      return undefined;
    }

    const key = `${container.name}:${kind}`;
    const previous = probeState[key];
    const period = probe.periodSeconds ?? 10;
    if (previous !== undefined && tick - previous.lastTick < period) {
      return undefined;
    }

    const evaluated = this.#evaluateProbe(kind, container);
    const failures = evaluated.ok ? 0 : (previous?.failures ?? 0) + 1;
    const successes = evaluated.ok ? (previous?.successes ?? 0) + 1 : 0;
    probeState[key] = { lastTick: tick, failures, successes };
    return { ...evaluated, failures, successes };
  }

  #evaluateProbe(
    kind: "readiness" | "liveness" | "startup",
    container: Pod["spec"]["containers"][number],
  ): { ok: boolean; detail: string } {
    const probe =
      kind === "readiness"
        ? container.readinessProbe
        : kind === "liveness"
          ? container.livenessProbe
          : container.startupProbe;
    if (probe?.httpGet !== undefined) {
      const status = container.simulator?.probeStatus?.[kind] ?? 200;
      return {
        ok: status >= 200 && status < 400,
        detail: `GET ${probe.httpGet.path ?? "/"} :${probe.httpGet.port} -> ${status}`,
      };
    }
    if (probe?.exec !== undefined) {
      const command = probe.exec.command.join(" ");
      const failed = /(^|\s)(false|exit 1)(\s|$)/.test(command);
      return {
        ok: !failed,
        detail: `exec [${probe.exec.command.join(", ")}]`,
      };
    }
    if (probe?.grpc !== undefined) {
      const status = container.simulator?.probeStatus?.[kind] ?? 200;
      return {
        ok: status < 400,
        detail: `gRPC :${probe.grpc.port} -> ${status}`,
      };
    }
    if (probe?.tcpSocket !== undefined) {
      const status = container.simulator?.probeStatus?.[kind] ?? 200;
      return {
        ok: status < 400,
        detail: `TCP :${probe.tcpSocket.port} -> ${status}`,
      };
    }
    return { ok: true, detail: "no handler" };
  }

  #containerStatusesFor(pod: Pod): ContainerStatus[] {
    return pod.spec.containers.map((container) => {
      const existing = pod.status.containerStatuses?.find(
        (status) => status.name === container.name,
      );
      return (
        existing ?? {
          name: container.name,
          ready: container.readinessProbe === undefined,
          restartCount: 0,
          state: "running",
        }
      );
    });
  }

  #setReadyCondition(
    conditions: NonNullable<Pod["status"]["conditions"]>,
    ready: boolean,
    reason?: string,
    message?: string,
  ): void {
    const existing = conditions.find((condition) => condition.type === "Ready");
    const next = {
      type: "Ready",
      status: ready ? ("True" as const) : ("False" as const),
      ...(reason === undefined ? {} : { reason }),
      ...(message === undefined ? {} : { message }),
    };
    if (existing === undefined) {
      conditions.push(next);
    } else {
      Object.assign(existing, next);
    }
  }

  #recordProbeEvent(pod: Pod, reason: string, message: string): void {
    const name = `${pod.metadata.name}.${reason.toLowerCase()}-${this.#nextUid("event")}`;
    this.store.upsert<KubeEvent>({
      apiVersion: "v1",
      kind: "Event",
      metadata: {
        name,
        namespace: pod.metadata.namespace,
        labels: {},
        uid: this.#nextUid("event"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      type: "Warning",
      reason,
      message,
      involvedObject: {
        kind: "Pod",
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
      },
    });
  }

  #reconcileCronJobs(): void {
    const tick = this.clock.tick;
    for (const cronJob of this.store.list<KubeCronJob>("CronJob")) {
      const lastSchedule = cronJob.status.lastScheduleTick ?? cronJob.metadata.creationTick;
      if (tick - lastSchedule < this.#cronIntervalTicks(cronJob.spec.schedule)) {
        continue;
      }
      const jobName = `${cronJob.metadata.name}-${tick}`;
      if (this.store.get<KubeJob>("Job", jobName, cronJob.metadata.namespace) === undefined) {
        this.store.upsert<KubeJob>({
          apiVersion: "batch/v1",
          kind: "Job",
          metadata: {
            name: jobName,
            namespace: cronJob.metadata.namespace,
            labels: { ...cronJob.metadata.labels, cronjob: cronJob.metadata.name },
            uid: this.#nextUid("job"),
            resourceVersion: 0,
            creationTick: tick,
          },
          spec: {
            ...cronJob.spec.jobTemplate.spec,
            template: {
              ...cronJob.spec.jobTemplate.spec.template,
              containers: cronJob.spec.jobTemplate.spec.template.containers.map((container) => ({
                ...container,
              })),
              ...(cronJob.spec.jobTemplate.spec.template.initContainers === undefined
                ? {}
                : {
                    initContainers: cronJob.spec.jobTemplate.spec.template.initContainers.map(
                      (container) => ({
                        ...container,
                      }),
                    ),
                  }),
            },
          },
          status: { active: 0, succeeded: 0, failed: 0, startTick: tick },
        });
      }
      this.store.upsert({
        ...cronJob,
        status: { ...cronJob.status, lastScheduleTick: tick },
      });
    }
  }

  #cronIntervalTicks(schedule: string): number {
    const every = /^@every\s+(\d+)s$/.exec(schedule);
    if (every !== null) {
      return Math.max(1, Number(every[1]));
    }
    if (schedule === "@hourly") {
      return 3600;
    }
    const stepped = /^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/.exec(schedule);
    if (stepped !== null) {
      return Math.max(1, Number(stepped[1])) * 60;
    }
    return 60;
  }

  #reconcileJobs(): void {
    const tick = this.clock.tick;
    for (const job of this.store.list<KubeJob>("Job")) {
      const pods = this.store
        .list<Pod>("Pod", job.metadata.namespace)
        .filter((pod) => pod.metadata.labels["job-name"] === job.metadata.name);

      for (const pod of pods) {
        if (pod.status.phase === "Running" && tick - pod.metadata.creationTick >= 2) {
          this.store.upsert({
            ...pod,
            status: { ...pod.status, phase: "Succeeded" },
          });
        }
      }

      const currentPods = this.store
        .list<Pod>("Pod", job.metadata.namespace)
        .filter((pod) => pod.metadata.labels["job-name"] === job.metadata.name);
      const succeeded = currentPods.filter((pod) => pod.status.phase === "Succeeded").length;
      const active = currentPods.filter(
        (pod) => pod.status.phase === "Pending" || pod.status.phase === "Running",
      ).length;

      if (succeeded < job.spec.completions && active < job.spec.parallelism) {
        const createCount = Math.min(
          job.spec.parallelism - active,
          job.spec.completions - succeeded - active,
        );
        for (let index = 0; index < createCount; index += 1) {
          this.#createWorkloadPod(
            `${job.metadata.name}-${this.#nextUid("pod")}`,
            job.metadata.namespace,
            job.spec.template,
            { ...job.metadata.labels, "job-name": job.metadata.name, job: job.metadata.name },
          );
        }
      }

      this.store.upsert({
        ...job,
        status: {
          ...job.status,
          active,
          succeeded,
          startTick: job.status.startTick ?? tick,
          ...(succeeded >= job.spec.completions
            ? { completionTick: job.status.completionTick ?? tick }
            : {}),
        },
      });
    }
  }

  #reconcileDaemonSets(): void {
    const readyNodes = this.store.list<KubeNode>("Node").filter((node) => node.status.ready);
    for (const daemonSet of this.store.list<KubeDaemonSet>("DaemonSet")) {
      const pods = this.store
        .list<Pod>("Pod", daemonSet.metadata.namespace)
        .filter((pod) => pod.metadata.labels.daemonset === daemonSet.metadata.name);
      const nodeNames = new Set(readyNodes.map((node) => node.metadata.name));

      for (const node of readyNodes) {
        const podName = `${daemonSet.metadata.name}-${node.metadata.name}`;
        if (!pods.some((pod) => pod.metadata.name === podName)) {
          this.#createWorkloadPod(
            podName,
            daemonSet.metadata.namespace,
            daemonSet.spec.template,
            {
              ...daemonSet.metadata.labels,
              daemonset: daemonSet.metadata.name,
            },
            node.metadata.name,
          );
        }
      }
      for (const pod of pods) {
        if (pod.spec.nodeName === undefined || !nodeNames.has(pod.spec.nodeName)) {
          this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
        }
      }

      const current = this.store
        .list<Pod>("Pod", daemonSet.metadata.namespace)
        .filter((pod) => pod.metadata.labels.daemonset === daemonSet.metadata.name);
      this.store.upsert({
        ...daemonSet,
        status: {
          desiredNumberScheduled: readyNodes.length,
          currentNumberScheduled: current.length,
          numberReady: current.filter(isPodReady).length,
        },
      });
    }
  }

  #reconcileStatefulSets(): void {
    for (const statefulSet of this.store.list<KubeStatefulSet>("StatefulSet")) {
      const pods = this.store
        .list<Pod>("Pod", statefulSet.metadata.namespace)
        .filter((pod) => pod.metadata.labels.statefulset === statefulSet.metadata.name);

      for (let index = 0; index < statefulSet.spec.replicas; index += 1) {
        const podName = `${statefulSet.metadata.name}-${index}`;
        if (!pods.some((pod) => pod.metadata.name === podName)) {
          this.#createWorkloadPod(
            podName,
            statefulSet.metadata.namespace,
            statefulSet.spec.template,
            {
              ...statefulSet.metadata.labels,
              statefulset: statefulSet.metadata.name,
              "apps.kubernetes.io/pod-index": String(index),
            },
          );
        }
      }
      for (const pod of pods) {
        const index = Number(pod.metadata.labels["apps.kubernetes.io/pod-index"]);
        if (Number.isNaN(index) || index >= statefulSet.spec.replicas) {
          this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
        }
      }

      const current = this.store
        .list<Pod>("Pod", statefulSet.metadata.namespace)
        .filter((pod) => pod.metadata.labels.statefulset === statefulSet.metadata.name);
      this.store.upsert({
        ...statefulSet,
        status: {
          replicas: current.length,
          readyReplicas: current.filter(isPodReady).length,
        },
      });
    }
  }

  #createWorkloadPod(
    name: string,
    namespace: string,
    template: PodTemplate,
    labels: Record<string, string>,
    nodeName?: string,
  ): void {
    const pod: Pod = {
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name,
        namespace,
        labels: { ...template.labels, ...labels },
        uid: this.#nextUid("pod"),
        resourceVersion: 0,
        creationTick: this.clock.tick,
      },
      spec: {
        ...(nodeName === undefined ? {} : { nodeName }),
        containers: template.containers.map((container) => ({ ...container })),
        ...(template.initContainers === undefined
          ? {}
          : { initContainers: template.initContainers.map((container) => ({ ...container })) }),
        ...(template.affinity === undefined ? {} : { affinity: template.affinity }),
        ...(template.topologySpreadConstraints === undefined
          ? {}
          : { topologySpreadConstraints: template.topologySpreadConstraints }),
        ...(template.nodeSelector === undefined ? {} : { nodeSelector: template.nodeSelector }),
        ...(template.tolerations === undefined ? {} : { tolerations: template.tolerations }),
      },
      status: { phase: "Pending" },
    };
    const stored = this.store.upsert(pod);
    this.events.emit({ type: "pod.created", tick: this.clock.tick, pod: stored });
  }

  #reconcileWidgets(): void {
    for (const widget of this.store.list<KubeWidget>("Widget")) {
      const childName = `${widget.metadata.name}-config`;
      const child = this.store.get<KubeConfigMap>(
        "ConfigMap",
        childName,
        widget.metadata.namespace,
      );
      const data = { size: String(widget.spec.size), color: widget.spec.color };
      if (child === undefined) {
        this.store.upsert<KubeConfigMap>({
          apiVersion: "v1",
          kind: "ConfigMap",
          metadata: {
            name: childName,
            namespace: widget.metadata.namespace,
            labels: { "app.kubernetes.io/managed-by": "widget-operator" },
            uid: this.#nextUid("configmap"),
            resourceVersion: 0,
            creationTick: this.clock.tick,
          },
          data,
        });
      } else if (child.data.size !== data.size || child.data.color !== data.color) {
        this.store.upsert({ ...child, data });
      }
      if (widget.status.phase !== "Ready") {
        this.store.upsert({ ...widget, status: { phase: "Ready" } });
      }
    }
  }

  #reconcileApplications(): void {
    for (const application of this.store.list<KubeApplication>("Application")) {
      const source = this.#readManifestSource(application.source.path);
      if (source === undefined || application.lastAppliedHash === undefined) {
        continue;
      }
      if (hashString(source).toString(36) !== application.lastAppliedHash) {
        this.store.upsert({
          ...application,
          syncStatus: "OutOfSync",
          healthStatus: "Progressing",
        });
      }
    }
  }

  #reconcileAutoscalers(): void {
    for (const autoscaler of this.store.list<KubeHorizontalPodAutoscaler>(
      "HorizontalPodAutoscaler",
    )) {
      const deployment = this.store.get<KubeDeployment>(
        "Deployment",
        autoscaler.spec.scaleTargetRef.name,
        autoscaler.metadata.namespace,
      );
      if (deployment === undefined) {
        continue;
      }

      const actualReplicas = deployment.spec.replicas;
      const target = this.#hpaTarget(autoscaler);
      let utilization =
        target === undefined
          ? undefined
          : target.resource === "cpu"
            ? autoscaler.status.currentCPUUtilization
            : target.resource === "memory"
              ? autoscaler.status.currentMemoryUtilization
              : autoscaler.status.currentExternalMetric;

      if (target !== undefined) {
        if (utilization === undefined && target.resource !== "external") {
          utilization = this.#averageUtilization(deployment, target.resource);
        } else if (
          utilization !== undefined &&
          autoscaler.status.currentReplicas > 0 &&
          autoscaler.status.currentReplicas !== actualReplicas
        ) {
          utilization = Math.round(
            (utilization * autoscaler.status.currentReplicas) / actualReplicas,
          );
        }
      }

      const withinTolerance =
        target !== undefined &&
        utilization !== undefined &&
        Math.abs(utilization - target.target) <= target.target * 0.1;
      let desired =
        target === undefined || utilization === undefined
          ? Math.min(
              autoscaler.spec.maxReplicas,
              Math.max(autoscaler.spec.minReplicas, autoscaler.status.desiredReplicas),
            )
          : Math.min(
              autoscaler.spec.maxReplicas,
              Math.max(
                autoscaler.spec.minReplicas,
                withinTolerance
                  ? actualReplicas
                  : Math.ceil((actualReplicas * utilization) / target.target),
              ),
            );

      const stabilization = autoscaler.spec.behavior?.scaleDown?.stabilizationWindowSeconds ?? 0;
      if (
        desired < actualReplicas &&
        stabilization > 0 &&
        this.clock.tick - (autoscaler.status.lastScaleTick ?? autoscaler.metadata.creationTick) <
          stabilization
      ) {
        desired = actualReplicas;
      }

      const scaled = desired !== actualReplicas;
      this.store.upsert({
        ...autoscaler,
        status: {
          currentReplicas: actualReplicas,
          desiredReplicas: desired,
          ...(utilization === undefined
            ? {}
            : target?.resource === "memory"
              ? { currentMemoryUtilization: utilization }
              : target?.resource === "external"
                ? { currentExternalMetric: utilization }
                : { currentCPUUtilization: utilization }),
          ...(scaled ? { lastScaleTick: this.clock.tick } : {}),
        },
      });

      if (deployment.spec.replicas === desired) {
        continue;
      }
      this.store.upsert({
        ...deployment,
        spec: { ...deployment.spec, replicas: desired },
        status: {
          replicas: 0,
          readyReplicas: 0,
          updatedReplicas: 0,
          availableReplicas: 0,
        },
      });
    }
  }

  #hpaTarget(
    autoscaler: KubeHorizontalPodAutoscaler,
  ): { resource: "cpu" | "memory" | "external"; target: number } | undefined {
    for (const metric of autoscaler.spec.metrics ?? []) {
      if (metric.type === "Resource") {
        if (
          (metric.resource.name === "cpu" || metric.resource.name === "memory") &&
          metric.resource.target.type === "Utilization" &&
          (metric.resource.target.averageUtilization ?? 0) > 0
        ) {
          return {
            resource: metric.resource.name,
            target: metric.resource.target.averageUtilization ?? 0,
          };
        }
      } else if (metric.type === "External") {
        const target = Number(metric.target.averageValue);
        if (!Number.isNaN(target) && target > 0) {
          return { resource: "external", target };
        }
      }
    }
    return undefined;
  }

  #averageUtilization(deployment: KubeDeployment, resource: "cpu" | "memory"): number | undefined {
    let totalUsage = 0;
    let totalRequest = 0;

    for (const pod of this.#deploymentPods(deployment)) {
      const usage =
        resource === "cpu" ? pod.status.usage?.cpuMillicores : pod.status.usage?.memoryBytes;
      const request = pod.spec.containers.reduce((sum, container) => {
        const value =
          resource === "cpu"
            ? container.resources?.requests?.cpu
            : container.resources?.requests?.memory;
        return (
          sum +
          (value === undefined
            ? 0
            : resource === "cpu"
              ? parseCpuMillis(value)
              : parseMemoryBytes(value))
        );
      }, 0);
      if (usage === undefined || request <= 0) {
        continue;
      }
      totalUsage += usage;
      totalRequest += request;
    }

    return totalRequest === 0 ? undefined : Math.round((totalUsage / totalRequest) * 100);
  }

  #reconcileResourceQuotas(): void {
    for (const quota of this.store.list<KubeResourceQuota>("ResourceQuota")) {
      const pods = this.store
        .list<Pod>("Pod", quota.metadata.namespace)
        .filter((pod) => pod.status.phase !== "Succeeded");
      const used: Record<string, string> = {
        pods: String(pods.length),
        "requests.cpu": `${pods.reduce(
          (sum, pod) =>
            sum +
            pod.spec.containers.reduce((containerSum, container) => {
              const cpu = container.resources?.requests?.cpu;
              return containerSum + (cpu === undefined ? 0 : parseCpuMillis(cpu));
            }, 0),
          0,
        )}m`,
        "requests.memory": `${pods.reduce(
          (sum, pod) =>
            sum +
            pod.spec.containers.reduce((containerSum, container) => {
              const memory = container.resources?.requests?.memory;
              return containerSum + (memory === undefined ? 0 : parseMemoryBytes(memory));
            }, 0),
          0,
        )}`,
      };
      this.store.upsert({
        ...quota,
        status: { ...quota.status, used },
      });
    }
  }

  #reconcileStorage(): void {
    for (const claim of this.store.list<KubePersistentVolumeClaim>("PersistentVolumeClaim")) {
      if (claim.status.phase !== "Pending") {
        continue;
      }
      const request = claim.spec.resources.requests.storage;
      const accessModes = claim.spec.accessModes;
      const volume = this.store
        .list<KubePersistentVolume>("PersistentVolume")
        .find(
          (candidate) =>
            candidate.status.phase === "Available" &&
            candidate.spec.capacity.storage === request &&
            candidate.spec.accessModes.some((mode) => accessModes.includes(mode)) &&
            (claim.spec.storageClassName === undefined ||
              candidate.spec.storageClassName === claim.spec.storageClassName),
        );

      if (volume !== undefined) {
        this.store.upsert({
          ...volume,
          spec: {
            ...volume.spec,
            claimRef: { namespace: claim.metadata.namespace, name: claim.metadata.name },
          },
          status: { phase: "Bound" },
        });
        this.store.upsert({
          ...claim,
          spec: { ...claim.spec, volumeName: volume.metadata.name },
          status: { phase: "Bound", capacity: volume.spec.capacity.storage },
        });
        continue;
      }

      const storageClass =
        claim.spec.storageClassName === undefined
          ? undefined
          : this.store.get<KubeStorageClass>("StorageClass", claim.spec.storageClassName, "");
      if (
        storageClass === undefined ||
        storageClass.provisioner === "kubernetes.io/no-provisioner"
      ) {
        continue;
      }
      if (storageClass.volumeBindingMode === "WaitForFirstConsumer" && !this.#claimInUse(claim)) {
        continue;
      }

      const volumeName = `pvc-${claim.metadata.uid.toLowerCase()}`;
      this.store.upsert<KubePersistentVolume>({
        apiVersion: "v1",
        kind: "PersistentVolume",
        metadata: {
          name: volumeName,
          namespace: "",
          labels: {},
          uid: this.#nextUid("pv"),
          resourceVersion: 0,
          creationTick: this.clock.tick,
        },
        spec: {
          capacity: { storage: request },
          accessModes,
          ...(claim.spec.storageClassName === undefined
            ? {}
            : { storageClassName: claim.spec.storageClassName }),
          claimRef: { namespace: claim.metadata.namespace, name: claim.metadata.name },
        },
        status: { phase: "Bound" },
      });
      this.store.upsert({
        ...claim,
        spec: { ...claim.spec, volumeName },
        status: { phase: "Bound", capacity: request },
      });
    }
  }

  #reconcileDeployments(): void {
    const tick = this.clock.tick;

    for (const deployment of this.store.list<KubeDeployment>("Deployment")) {
      const replicaSets = this.#replicaSetsFor(deployment);
      const hash = templateHash(deployment.spec.template);
      let current = replicaSets.find(
        (replicaSet) => replicaSet.metadata.labels["pod-template-hash"] === hash,
      );

      if (current === undefined) {
        const revision =
          Math.max(0, ...replicaSets.map((replicaSet) => replicaSet.spec.revision)) + 1;
        current = this.store.upsert<KubeReplicaSet>({
          apiVersion: "apps/v1",
          kind: "ReplicaSet",
          metadata: {
            name: `${deployment.metadata.name}-${hash}`,
            namespace: deployment.metadata.namespace,
            labels: {
              app: deployment.spec.template.labels.app ?? deployment.metadata.name,
              deployment: deployment.metadata.name,
              "pod-template-hash": hash,
            },
            uid: this.#nextUid("replicaset"),
            resourceVersion: 0,
            creationTick: tick,
          },
          spec: {
            replicas: 0,
            revision,
            template: deployment.spec.template,
          },
          status: { replicas: 0, readyReplicas: 0 },
        });
      }

      const oldReplicaSets = replicaSets.filter(
        (replicaSet) =>
          replicaSet.metadata.name !== current.metadata.name && replicaSet.spec.replicas > 0,
      );
      const rolling = oldReplicaSets.length > 0 && deployment.spec.replicas > 0;
      const recreate = deployment.spec.strategy?.type === "Recreate";
      const maxSurge = resolveStrategyCount(
        deployment.spec.strategy?.rollingUpdate?.maxSurge,
        deployment.spec.replicas,
        1,
      );
      const maxUnavailable = resolveStrategyCount(
        deployment.spec.strategy?.rollingUpdate?.maxUnavailable,
        deployment.spec.replicas,
        0,
      );
      const currentReady = this.#replicaSetPods(current).filter(isPodReady).length;
      const currentReplicas = rolling
        ? recreate
          ? deployment.spec.replicas
          : Math.min(deployment.spec.replicas + maxSurge, Math.max(1, currentReady + 1))
        : deployment.spec.replicas;

      this.store.upsert({
        ...current,
        spec: {
          ...current.spec,
          replicas: currentReplicas,
          template: deployment.spec.template,
        },
      });

      let oldBudget = rolling
        ? recreate
          ? 0
          : Math.max(
              0,
              Math.min(
                deployment.spec.replicas + maxSurge - currentReplicas,
                deployment.spec.replicas - maxUnavailable - currentReady,
              ),
            )
        : 0;
      for (const replicaSet of replicaSets) {
        if (
          replicaSet.metadata.name === current.metadata.name ||
          replicaSet.metadata.namespace !== current.metadata.namespace
        ) {
          continue;
        }
        const replicas = Math.min(replicaSet.spec.replicas, oldBudget);
        oldBudget -= replicas;
        if (replicaSet.spec.replicas !== replicas) {
          this.store.upsert({ ...replicaSet, spec: { ...replicaSet.spec, replicas } });
        }
      }
    }
  }

  #reconcileReplicaSets(): void {
    const tick = this.clock.tick;

    for (const replicaSet of this.store.list<KubeReplicaSet>("ReplicaSet")) {
      const pods = this.#replicaSetPods(replicaSet);

      if (pods.length < replicaSet.spec.replicas) {
        for (let index = pods.length; index < replicaSet.spec.replicas; index += 1) {
          const pod: Pod = {
            apiVersion: "v1",
            kind: "Pod",
            metadata: {
              name: `${replicaSet.metadata.name}-${this.#nextUid("pod")}`,
              namespace: replicaSet.metadata.namespace,
              labels: { ...replicaSet.spec.template.labels, ...replicaSet.metadata.labels },
              uid: this.#nextUid("pod"),
              resourceVersion: 0,
              creationTick: tick,
            },
            spec: {
              containers: replicaSet.spec.template.containers.map((container) => ({
                ...container,
              })),
              ...(replicaSet.spec.template.initContainers === undefined
                ? {}
                : {
                    initContainers: replicaSet.spec.template.initContainers.map((container) => ({
                      ...container,
                    })),
                  }),
              ...(replicaSet.spec.template.affinity === undefined
                ? {}
                : { affinity: replicaSet.spec.template.affinity }),
              ...(replicaSet.spec.template.topologySpreadConstraints === undefined
                ? {}
                : {
                    topologySpreadConstraints: replicaSet.spec.template.topologySpreadConstraints,
                  }),
              ...(replicaSet.spec.template.nodeSelector === undefined
                ? {}
                : { nodeSelector: replicaSet.spec.template.nodeSelector }),
              ...(replicaSet.spec.template.tolerations === undefined
                ? {}
                : { tolerations: replicaSet.spec.template.tolerations }),
            },
            status: { phase: "Pending" },
          };
          const stored = this.store.upsert(pod);
          this.events.emit({ type: "pod.created", tick, pod: stored });
        }
      }

      for (const pod of pods.slice(replicaSet.spec.replicas)) {
        this.store.delete("Pod", pod.metadata.name, pod.metadata.namespace);
        this.events.emit({ type: "pod.deleted", tick, pod });
      }

      const currentPods = this.#replicaSetPods(replicaSet);
      this.store.upsert({
        ...replicaSet,
        status: {
          replicas: currentPods.length,
          readyReplicas: currentPods.filter(isPodReady).length,
        },
      });
    }
  }

  #updateDeploymentStatuses(): void {
    for (const deployment of this.store.list<KubeDeployment>("Deployment")) {
      const pods = this.#deploymentPods(deployment);
      this.store.upsert({
        ...deployment,
        status: {
          replicas: pods.length,
          readyReplicas: pods.filter(isPodReady).length,
          updatedReplicas: pods.length,
          availableReplicas: pods.filter(isPodReady).length,
        },
      });
    }
  }

  #replicaSetsFor(deployment: KubeDeployment): KubeReplicaSet[] {
    return this.store
      .list<KubeReplicaSet>("ReplicaSet", deployment.metadata.namespace)
      .filter((replicaSet) => replicaSet.metadata.labels.deployment === deployment.metadata.name);
  }

  #currentReplicaSet(deployment: KubeDeployment): KubeReplicaSet | undefined {
    const hash = templateHash(deployment.spec.template);
    return this.#replicaSetsFor(deployment).find(
      (replicaSet) => replicaSet.metadata.labels["pod-template-hash"] === hash,
    );
  }

  #deploymentPods(deployment: KubeDeployment): Pod[] {
    const hash = templateHash(deployment.spec.template);
    return this.store
      .list<Pod>("Pod", deployment.metadata.namespace)
      .filter(
        (pod) =>
          pod.metadata.labels.deployment === deployment.metadata.name &&
          pod.metadata.labels["pod-template-hash"] === hash,
      );
  }

  #replicaSetPods(replicaSet: KubeReplicaSet): Pod[] {
    return this.store
      .list<Pod>("Pod", replicaSet.metadata.namespace)
      .filter(
        (pod) =>
          pod.metadata.labels.deployment === replicaSet.metadata.labels.deployment &&
          pod.metadata.labels["pod-template-hash"] ===
            replicaSet.metadata.labels["pod-template-hash"],
      );
  }

  #ingressAllowed(target: Pod, source: Pod, port: number): boolean {
    const ingressPolicies = this.#policiesFor(target).filter((policy) =>
      this.#policyType(policy, "Ingress"),
    );
    const ingressAllowed =
      ingressPolicies.length === 0 ||
      ingressPolicies.some((policy) =>
        (policy.spec.ingress ?? []).some((rule) => {
          if (!this.#policyPortMatches(rule.ports, port)) {
            return false;
          }
          return (
            rule.from === undefined ||
            rule.from.some((peer) => this.#peerMatches(peer, source, target.metadata.namespace))
          );
        }),
      );
    if (!ingressAllowed) {
      return false;
    }

    const egressPolicies = this.#policiesFor(source).filter((policy) =>
      this.#policyType(policy, "Egress"),
    );
    return (
      egressPolicies.length === 0 ||
      egressPolicies.some((policy) =>
        (policy.spec.egress ?? []).some((rule) => {
          if (!this.#policyPortMatches(rule.ports, port)) {
            return false;
          }
          return (
            rule.to === undefined ||
            rule.to.some((peer) => this.#peerMatches(peer, target, source.metadata.namespace))
          );
        }),
      )
    );
  }

  #policyPortMatches(ports: NetworkPolicyPort[] | undefined, port: number): boolean {
    if (ports === undefined) {
      return true;
    }
    if (ports.length === 0) {
      return false;
    }
    return ports.some((entry) => entry.port === undefined || Number(entry.port) === port);
  }

  #applyLimitRangeDefaults(pod: Pod): Pod {
    const limitRanges = this.store.list<KubeLimitRange>("LimitRange", pod.metadata.namespace);
    if (limitRanges.length === 0) {
      return pod;
    }
    const defaults = limitRanges.flatMap((range) =>
      range.spec.limits
        .filter((limit) => limit.type === "Container")
        .map((limit) => limit.defaultRequest),
    );
    const cpu = defaults.find((request) => request?.cpu !== undefined)?.cpu;
    const memory = defaults.find((request) => request?.memory !== undefined)?.memory;
    let changed = false;
    const containers = pod.spec.containers.map((container) => {
      const requests = container.resources?.requests;
      if (requests?.cpu !== undefined && requests.memory !== undefined) {
        return container;
      }
      changed = true;
      return {
        ...container,
        resources: {
          ...container.resources,
          requests: {
            ...(requests?.cpu === undefined && cpu !== undefined ? { cpu } : {}),
            ...(requests?.memory === undefined && memory !== undefined ? { memory } : {}),
            ...requests,
          },
        },
      };
    });
    if (!changed) {
      return pod;
    }
    const updated = { ...pod, spec: { ...pod.spec, containers } };
    this.store.upsert(updated);
    return updated;
  }

  #podSecurityViolation(pod: Pod): string | undefined {
    const namespace = this.store.get<KubeNamespace>("Namespace", pod.metadata.namespace, "");
    const level = namespace?.metadata.labels["pod-security.kubernetes.io/enforce"];
    if (level === "restricted") {
      if (pod.spec.securityContext?.runAsNonRoot !== true) {
        return 'violates PodSecurity "restricted": runAsNonRoot=true is required';
      }
      for (const container of pod.spec.containers) {
        if (container.securityContext?.allowPrivilegeEscalation !== false) {
          return `violates PodSecurity "restricted": container ${container.name} must disable privilege escalation`;
        }
      }
    }
    return undefined;
  }

  #quotaError(pod: Pod): string | undefined {
    const pods = this.store
      .list<Pod>("Pod", pod.metadata.namespace)
      .filter((candidate) => candidate.status.phase !== "Succeeded");
    for (const quota of this.store.list<KubeResourceQuota>(
      "ResourceQuota",
      pod.metadata.namespace,
    )) {
      const hardPods = Number(quota.spec.hard.pods);
      if (!Number.isNaN(hardPods) && pods.length > hardPods) {
        return `exceeded quota: ${quota.metadata.name}, requested: pods=${pods.length}, used: ${hardPods}`;
      }
      const hardCpu = quota.spec.hard["requests.cpu"];
      if (hardCpu !== undefined) {
        const usedCpu = pods.reduce(
          (sum, candidate) =>
            sum +
            candidate.spec.containers.reduce((containerSum, container) => {
              const cpu = container.resources?.requests?.cpu;
              return containerSum + (cpu === undefined ? 0 : parseCpuMillis(cpu));
            }, 0),
          0,
        );
        if (usedCpu > parseCpuMillis(hardCpu)) {
          return `exceeded quota: ${quota.metadata.name}, requested: requests.cpu=${usedCpu}m`;
        }
      }
      const hardMemory = quota.spec.hard["requests.memory"];
      if (hardMemory !== undefined) {
        const usedMemory = pods.reduce(
          (sum, candidate) =>
            sum +
            candidate.spec.containers.reduce((containerSum, container) => {
              const memory = container.resources?.requests?.memory;
              return containerSum + (memory === undefined ? 0 : parseMemoryBytes(memory));
            }, 0),
          0,
        );
        if (usedMemory > parseMemoryBytes(hardMemory)) {
          return `exceeded quota: ${quota.metadata.name}, requested: requests.memory=${usedMemory}`;
        }
      }
    }
    return undefined;
  }

  #podFitsNode(node: KubeNode, pod: Pod): boolean {
    if (!nodeMatchesPod(node, pod)) {
      return false;
    }

    const nodeTerms =
      pod.spec.affinity?.nodeAffinity?.requiredDuringSchedulingIgnoredDuringExecution
        ?.nodeSelectorTerms;
    if (nodeTerms !== undefined) {
      const matches = nodeTerms.some((term) =>
        (term.matchExpressions ?? []).every((expression) =>
          this.#nodeExpressionMatches(node, expression),
        ),
      );
      if (!matches) {
        return false;
      }
    }

    const placed = this.store
      .list<Pod>("Pod")
      .filter(
        (candidate) =>
          candidate.metadata.name !== pod.metadata.name &&
          candidate.spec.nodeName !== undefined &&
          candidate.metadata.namespace === pod.metadata.namespace,
      );
    const nodeByName = new Map(
      this.store.list<KubeNode>("Node").map((candidate) => [candidate.metadata.name, candidate]),
    );
    const matchesTerm = (term: { labelSelector?: Record<string, string>; topologyKey: string }) =>
      placed.some((candidate) => {
        if (!matchesLabels(candidate.metadata.labels, term.labelSelector ?? {})) {
          return false;
        }
        const candidateNode = nodeByName.get(candidate.spec.nodeName ?? "");
        return (
          candidateNode !== undefined &&
          candidateNode.metadata.labels[term.topologyKey] === node.metadata.labels[term.topologyKey]
        );
      });

    for (const term of pod.spec.affinity?.podAffinity
      ?.requiredDuringSchedulingIgnoredDuringExecution ?? []) {
      if (!matchesTerm(term)) {
        return false;
      }
    }
    for (const term of pod.spec.affinity?.podAntiAffinity
      ?.requiredDuringSchedulingIgnoredDuringExecution ?? []) {
      if (matchesTerm(term)) {
        return false;
      }
    }

    for (const constraint of pod.spec.topologySpreadConstraints ?? []) {
      if (constraint.whenUnsatisfiable !== "DoNotSchedule") {
        continue;
      }
      const counts = new Map<string, number>();
      for (const candidate of placed) {
        if (!matchesLabels(candidate.metadata.labels, constraint.labelSelector ?? {})) {
          continue;
        }
        const candidateNode = nodeByName.get(candidate.spec.nodeName ?? "");
        const value = candidateNode?.metadata.labels[constraint.topologyKey] ?? "";
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      const candidateValue = node.metadata.labels[constraint.topologyKey] ?? "";
      const candidateCount = counts.get(candidateValue) ?? 0;
      const allCounts = [...counts.values()];
      const min = allCounts.length === 0 ? 0 : Math.min(...allCounts);
      if (candidateCount >= min + constraint.maxSkew) {
        return false;
      }
    }

    return true;
  }

  #nodeExpressionMatches(node: KubeNode, expression: NodeSelectorRequirement): boolean {
    const value = node.metadata.labels[expression.key];
    if (expression.operator === "Exists") {
      return value !== undefined;
    }
    if (expression.operator === "DoesNotExist") {
      return value === undefined;
    }
    const values = expression.values ?? [];
    return expression.operator === "In"
      ? value !== undefined && values.includes(value)
      : value !== undefined && !values.includes(value);
  }

  #reconcilePodDisruptionBudgets(): void {
    for (const budget of this.store.list<KubePodDisruptionBudget>("PodDisruptionBudget")) {
      const pods = this.store
        .list<Pod>("Pod", budget.metadata.namespace)
        .filter((pod) => matchesLabels(pod.metadata.labels, budget.spec.selector));
      const currentHealthy = pods.filter(isPodReady).length;
      const minAvailable =
        typeof budget.spec.minAvailable === "string" && budget.spec.minAvailable.endsWith("%")
          ? Math.ceil((pods.length * Number(budget.spec.minAvailable.slice(0, -1))) / 100)
          : Number(budget.spec.minAvailable ?? 0);
      const maxUnavailable =
        typeof budget.spec.maxUnavailable === "string" && budget.spec.maxUnavailable.endsWith("%")
          ? Math.floor((pods.length * Number(budget.spec.maxUnavailable.slice(0, -1))) / 100)
          : Number(budget.spec.maxUnavailable ?? 0);
      const desiredHealthy =
        budget.spec.minAvailable !== undefined
          ? minAvailable
          : Math.max(0, pods.length - maxUnavailable);
      this.store.upsert({
        ...budget,
        status: {
          currentHealthy,
          desiredHealthy,
          disruptionsAllowed: Math.max(0, currentHealthy - desiredHealthy),
        },
      });
    }
  }

  #policiesFor(pod: Pod): KubeNetworkPolicy[] {
    return this.store
      .list<KubeNetworkPolicy>("NetworkPolicy", pod.metadata.namespace)
      .filter(
        (policy) =>
          Object.keys(policy.spec.podSelector).length === 0 ||
          matchesLabels(pod.metadata.labels, policy.spec.podSelector),
      );
  }

  #policyType(policy: KubeNetworkPolicy, type: "Ingress" | "Egress"): boolean {
    if (policy.spec.policyTypes !== undefined) {
      return policy.spec.policyTypes.includes(type);
    }
    return type === "Ingress"
      ? policy.spec.ingress !== undefined
      : policy.spec.egress !== undefined;
  }

  #peerMatches(peer: NetworkPolicyPeer, pod: Pod, namespace: string): boolean {
    if (
      peer.podSelector !== undefined &&
      (peer.podSelector === null ||
        !matchesLabels(pod.metadata.labels, peer.podSelector) ||
        pod.metadata.namespace !== namespace)
    ) {
      return false;
    }
    if (peer.namespaceSelector !== undefined) {
      const podNamespace = this.store.get<KubeNamespace>("Namespace", pod.metadata.namespace, "");
      if (
        podNamespace === undefined
          ? Object.keys(peer.namespaceSelector).length > 0
          : !matchesLabels(podNamespace.metadata.labels, peer.namespaceSelector)
      ) {
        return false;
      }
    }
    if (peer.ipBlock !== undefined) {
      if (pod.status.podIP === undefined || !ipInCidr(pod.status.podIP, peer.ipBlock.cidr)) {
        return false;
      }
      if (peer.ipBlock.except?.some((cidr) => ipInCidr(pod.status.podIP ?? "", cidr)) === true) {
        return false;
      }
    }
    return true;
  }

  #claimInUse(claim: KubePersistentVolumeClaim): boolean {
    return this.store
      .list<Pod>("Pod", claim.metadata.namespace)
      .some((pod) =>
        (pod.spec.volumes ?? []).some(
          (volume) => volume.persistentVolumeClaim?.claimName === claim.metadata.name,
        ),
      );
  }

  #servicePods(service: KubeService): Pod[] {
    if (Object.keys(service.spec.selector).length === 0) {
      return [];
    }

    return this.store
      .list<Pod>("Pod", service.metadata.namespace)
      .filter(
        (pod) => isPodReady(pod) && matchesLabels(pod.metadata.labels, service.spec.selector),
      );
  }

  #customKind(resource: string): string {
    const base = resource.split(".")[0] ?? resource;
    const singular = base.endsWith("s") ? base.slice(0, -1) : base;
    return `${singular.charAt(0).toUpperCase()}${singular.slice(1)}`;
  }

  #nextNodePort(): number {
    this.#nodePortCounter += 1;
    return this.#nodePortCounter;
  }

  #nextUid(prefix: string): string {
    this.#uid += 1;
    return `${prefix}-${this.#uid.toString(36)}`;
  }
}
