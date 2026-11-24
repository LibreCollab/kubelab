import { VirtualClock } from "./clock";
import { resolveServiceDns } from "./dns";
import { EventBus } from "./events";
import { MAX_REPLICAS, type ParsedCommand, parseKubectl } from "./kubectl";
import { filterPods, isPodReady, matchesLabels, type PodFilter } from "./selectors";
import { ClusterStore } from "./store";
import type {
  CommandResult,
  KubeConfigMap,
  KubeDeployment,
  KubeEvent,
  KubeHorizontalPodAutoscaler,
  KubeIngress,
  KubeNamespace,
  KubeNetworkPolicy,
  KubeNode,
  KubeObject,
  KubePersistentVolume,
  KubePersistentVolumeClaim,
  KubeReplicaSet,
  KubeRole,
  KubeRoleBinding,
  KubeSecret,
  KubeService,
  KubeStorageClass,
  Pod,
  PodTemplate,
  Scenario,
} from "./types";

export interface SimEngineOptions {
  intervalMs?: number;
}

const HELP = `kubectl controls the Kubelab simulated cluster.

Supported in this scaffold:
  kubectl get pods|deployments|replicasets|services|endpoints|ingresses|configmaps|secrets
  kubectl get pv|pvc|storageclass|networkpolicy|serviceaccount|role|rolebinding|namespace|hpa|events
  kubectl get nodes [name]
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
  kubectl describe pod|deployment|service|ingress|node|pvc|networkpolicy|role|rolebinding|namespace|hpa <name>
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

export class SimEngine {
  readonly store = new ClusterStore();
  readonly clock: VirtualClock;
  readonly events = new EventBus();
  #commands: ParsedCommand[] = [];
  #uid = 0;
  #ipCounter = 0;
  #serviceCounter = 0;

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
      kind === "StorageClass";
    const namespace =
      typeof meta.namespace === "string" ? meta.namespace : clusterScoped ? "" : "default";
    const labels =
      typeof meta.labels === "object" && meta.labels !== null
        ? (meta.labels as Record<string, string>)
        : {};

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

  execute(input: string): CommandResult {
    const parsed = parseKubectl(input);

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
      case "exec":
        return this.#exec(parsed);
      case "logs":
        return this.#logs(parsed);
      case "auth":
        return this.#auth(parsed);
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
      return { ok: false, output: "error: -o yaml is not implemented in this scaffold yet" };
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

    if (command.resource === "serviceaccounts") {
      return this.#getSimple(command, "ServiceAccount", "serviceaccounts");
    }

    if (command.resource === "roles") {
      return this.#getRoles(command);
    }

    if (command.resource === "rolebindings") {
      return this.#getRoleBindings(command);
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

    return {
      ok: false,
      output: `error: the server doesn't have a resource type "${command.resource}" in this lesson`,
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
        const ready = isPodReady(pod) ? 1 : 0;
        const age = `${Math.max(0, this.clock.tick - pod.metadata.creationTick)}s`;
        const name = command.allNamespaces
          ? `${pod.metadata.namespace}/${pod.metadata.name}`
          : pod.metadata.name;
        const row = [name, `${ready}/${pod.spec.containers.length}`, pod.status.phase, "0", age];
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

      if (command.command === "getent") {
        return { ok: true, output: `${service.spec.clusterIP} ${target.canonical}` };
      }

      return {
        ok: true,
        output: [
          "Server:         10.96.0.10",
          "Address:        10.96.0.10:53",
          "",
          `Name:           ${target.canonical}`,
          `Address:        ${service.spec.clusterIP}`,
        ].join("\n"),
      };
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

      if (url !== undefined) {
        try {
          const parsed = new URL(url);
          host = host ?? parsed.hostname;
          path = parsed.pathname.length === 0 ? "/" : parsed.pathname;
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

      if (route === undefined) {
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
        ports: [{ port: command.port, targetPort: command.targetPort }],
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
      const ports = service.spec.ports.map((port) => `${port.port}/${port.targetPort}`).join(",");
      const row = [
        name,
        service.spec.type,
        service.spec.clusterIP,
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
  ): CommandResult {
    const objects = command.name
      ? [this.store.get<KubeObject>(kind, command.name, command.namespace)].filter(
          (object): object is KubeObject => object !== undefined,
        )
      : this.store.list<KubeObject>(kind, command.allNamespaces ? undefined : command.namespace);

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
      .map((item) => [
        command.allNamespaces
          ? `${item.metadata.namespace}/${item.metadata.name}`
          : item.metadata.name,
        `${item.spec.scaleTargetRef.kind}/${item.spec.scaleTargetRef.name}`,
        `${item.status.currentReplicas}/${item.spec.maxReplicas}`,
        String(item.spec.minReplicas),
        String(item.spec.maxReplicas),
        String(item.status.currentReplicas),
        `${Math.max(0, this.clock.tick - item.metadata.creationTick)}s`,
      ]);

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

  #logs(command: Extract<ParsedCommand, { verb: "logs" }>): CommandResult {
    if (command.follow) {
      return { ok: false, output: "error: --follow is not simulated yet" };
    }

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
      serviceaccounts: "ServiceAccount",
      roles: "Role",
      rolebindings: "RoleBinding",
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
      ...pod.spec.containers.map(
        (container) => `  ${container.name}:\n    Image: ${container.image}`,
      ),
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
      kind === "Namespace" || kind === "PersistentVolume" || kind === "StorageClass";
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

    this.#reconcileDeployments();
    this.#reconcileReplicaSets();

    for (const pod of this.store.list<Pod>("Pod")) {
      if (pod.status.phase !== "Pending") {
        continue;
      }

      if (pod.spec.nodeName === undefined) {
        const eligible = readyNodes
          .filter((candidate) => nodeMatchesPod(candidate, pod))
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
                  : `${readyNodes.length} nodes are available, but none match the Pod's selector or tolerations`,
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

      const running: Pod = {
        ...pod,
        status: {
          phase: "Running",
          ...(pod.status.podIP === undefined ? {} : { podIP: pod.status.podIP }),
        },
      };

      const stored = this.store.upsert(running);

      this.events.emit({ type: "pod.running", tick, pod: stored });
    }

    this.#updateDeploymentStatuses();
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

      this.store.upsert({
        ...current,
        spec: {
          ...current.spec,
          replicas: deployment.spec.replicas,
          template: deployment.spec.template,
        },
      });

      for (const replicaSet of replicaSets) {
        if (
          replicaSet.metadata.name !== current.metadata.name &&
          replicaSet.metadata.namespace === current.metadata.namespace &&
          replicaSet.spec.replicas !== 0
        ) {
          this.store.upsert({ ...replicaSet, spec: { ...replicaSet.spec, replicas: 0 } });
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

  #nextUid(prefix: string): string {
    this.#uid += 1;
    return `${prefix}-${this.#uid.toString(36)}`;
  }
}
