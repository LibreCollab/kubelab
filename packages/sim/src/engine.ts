import { VirtualClock } from "./clock";
import { EventBus } from "./events";
import { type ParsedCommand, parseKubectl } from "./kubectl";
import { filterPods, type PodFilter } from "./selectors";
import { ClusterStore } from "./store";
import type { CommandResult, KubeNode, Pod, Scenario } from "./types";

export interface SimEngineOptions {
  intervalMs?: number;
}

const HELP = `kubectl controls the Kubelab simulated cluster.

Supported in this scaffold:
  kubectl get pods [-n namespace] [-A] [name]
  kubectl get nodes [name]
  kubectl run <name> --image=<image> [--labels=key=value]
  kubectl describe pod <name>
  kubectl delete pod <name>
  kubectl help

Coming next: apply, exec, logs, services, deployments.`;

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
  #uid = 0;

  constructor(options: SimEngineOptions = {}) {
    this.clock = new VirtualClock(options.intervalMs ?? 500);
    this.clock.onTick(() => {
      this.#reconcile();
    });
  }

  seed(scenario: Scenario): void {
    for (const node of scenario.nodes) {
      const kubeNode: KubeNode = {
        apiVersion: "v1",
        kind: "Node",
        metadata: {
          name: node.name,
          namespace: "",
          labels: { "kubernetes.io/hostname": node.name },
          uid: this.#nextUid("node"),
          resourceVersion: 0,
          creationTick: this.clock.tick,
        },
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

    switch (parsed.verb) {
      case "help":
        return { ok: true, output: HELP };
      case "get":
        return this.#get(parsed);
      case "run":
        return this.#run(parsed);
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
      headers.push("NODE");
    }

    const rows = [...pods]
      .sort((left, right) => left.metadata.name.localeCompare(right.metadata.name))
      .map((pod) => {
        const ready = pod.status.phase === "Running" ? 1 : 0;
        const age = `${Math.max(0, this.clock.tick - pod.metadata.creationTick)}s`;
        const name = command.allNamespaces
          ? `${pod.metadata.namespace}/${pod.metadata.name}`
          : pod.metadata.name;
        const row = [name, `${ready}/${pod.spec.containers.length}`, pod.status.phase, "0", age];
        if (wide) {
          row.push(pod.spec.nodeName ?? "<none>");
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
      ? [this.store.get<KubeNode>("Node", command.name)].filter(
          (node): node is KubeNode => node !== undefined,
        )
      : this.store.list<KubeNode>("Node");

    if (command.name !== undefined && nodes.length === 0) {
      return notFound("nodes", command.name);
    }

    const rows = nodes.map((node) => [
      node.metadata.name,
      node.status.ready ? "Ready" : "NotReady",
      "<none>",
      "1d",
      "v1.37.0",
    ]);

    return {
      ok: true,
      output: formatTable(["NAME", "STATUS", "ROLES", "AGE", "VERSION"], rows),
    };
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

  #delete(command: Extract<ParsedCommand, { verb: "delete" }>): CommandResult {
    if (command.resource !== "pods") {
      return notSimulated("deleting", command.resource);
    }

    const pod = this.store.get<Pod>("Pod", command.name, command.namespace);
    if (pod === undefined) {
      return notFound("pods", command.name);
    }

    const tick = this.clock.tick;
    this.store.delete("Pod", command.name, command.namespace);
    this.events.emit({ type: "pod.deleted", tick, pod });

    return { ok: true, output: `pod "${command.name}" deleted` };
  }

  #describe(command: Extract<ParsedCommand, { verb: "describe" }>): CommandResult {
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

    if (pod.status.message !== undefined) {
      lines.push("", `Message:      ${pod.status.message}`);
    }

    return { ok: true, output: lines.join("\n") };
  }

  #reconcile(): void {
    const readyNode = this.store.list<KubeNode>("Node").find((node) => node.status.ready);
    const tick = this.clock.tick;

    for (const pod of this.store.list<Pod>("Pod")) {
      if (pod.status.phase !== "Pending") {
        continue;
      }

      if (pod.spec.nodeName === undefined) {
        if (readyNode === undefined) {
          const unavailable: Pod = {
            ...pod,
            status: { phase: "Pending", message: "0/1 nodes are available" },
          };
          this.store.upsert(unavailable);
          continue;
        }

        const scheduled: Pod = {
          ...pod,
          spec: { ...pod.spec, nodeName: readyNode.metadata.name },
          status: { phase: "Pending", message: `Scheduled on ${readyNode.metadata.name}` },
        };

        const stored = this.store.upsert(scheduled);

        this.events.emit({ type: "pod.scheduled", tick, pod: stored });
        continue;
      }

      const running: Pod = {
        ...pod,
        status: { phase: "Running" },
      };

      const stored = this.store.upsert(running);

      this.events.emit({ type: "pod.running", tick, pod: stored });
    }
  }

  #nextUid(prefix: string): string {
    this.#uid += 1;
    return `${prefix}-${this.#uid.toString(36)}`;
  }
}
