import { certificationDomains, certificationExams, getCertificationExam } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type ParsedCommand,
  type Pod,
  SimEngine,
} from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { type CheckContext, evaluateChecks } from "./checks";

function namespaceFlag(namespace: string): string {
  return namespace === "default" ? "" : ` -n ${namespace}`;
}

function execTarget(engine: SimEngine, namespace: string, command: string): string {
  if (command === "nslookup" || command === "getent") {
    const service = engine.store.list<KubeService>("Service", namespace)[0];
    const query = service?.metadata.name ?? "web";
    return command === "getent" ? `getent hosts ${query}` : `nslookup ${query}`;
  }
  const ingress = engine.store.list<KubeIngress>("Ingress", namespace)[0];
  const rule = ingress?.spec.rules[0];
  if (ingress !== undefined && rule !== undefined) {
    const secure = ingress.spec.tls?.some((tls) => tls.hosts.includes(rule.host)) === true;
    const scheme = secure ? "https" : "http";
    return `curl -H "Host: ${rule.host}" ${scheme}://${rule.host}/`;
  }
  const service = engine.store.list<KubeService>("Service", namespace)[0];
  return `curl ${`http://${service?.metadata.name ?? "web"}`}`;
}

function solutionCommand(
  check: Extract<CheckContext["commands"][number], { verb: string }>,
  engine: SimEngine,
  raw: Record<string, unknown>,
): string | undefined {
  const resource = String(raw.resource ?? "");
  const name = String(raw.name ?? "");
  const namespace = typeof raw.namespace === "string" ? raw.namespace : "default";
  const ns = namespaceFlag(namespace);

  if (check.verb === "get") {
    return `kubectl get ${resource}${name === "" ? "" : ` ${name}`}${ns}`;
  }
  if (check.verb === "describe") {
    return `kubectl describe ${resource}${name === "" ? "" : ` ${name}`}${ns}`;
  }
  if (check.verb === "logs") {
    const container = typeof raw.container === "string" ? ` -c ${raw.container}` : "";
    return `kubectl logs ${name}${container}${ns}`;
  }
  if (check.verb === "exec") {
    return `kubectl exec ${name}${ns} -- ${execTarget(engine, namespace, String(raw.command ?? ""))}`;
  }
  if (check.verb === "auth") {
    return `kubectl auth can-i ${String(raw.subjectVerb)} ${String(raw.subjectResource)} --as=${String(raw.as)}`;
  }
  if (check.verb === "rollout") {
    return `kubectl rollout ${String(raw.action)} ${resource}/${name}${ns}`;
  }
  if (check.verb === "scale") {
    return `kubectl scale ${resource} ${name} --replicas=${String(raw.replicas)}${ns}`;
  }
  if (check.verb === "set") {
    return `kubectl set image ${resource}/${name} ${String(raw.container)}=${String(raw.image)}${ns}`;
  }
  return undefined;
}

function context(engine: SimEngine): CheckContext {
  return {
    pods: engine.store.list<Pod>("Pod"),
    deployments: engine.store.list<KubeDeployment>("Deployment"),
    services: engine.store.list<KubeService>("Service"),
    ingresses: engine.store.list<KubeIngress>("Ingress"),
    configMaps: engine.store.list<KubeConfigMap>("ConfigMap"),
    secrets: engine.store.list<KubeSecret>("Secret"),
    commands: engine.commands,
  };
}

function settle(engine: SimEngine): void {
  for (let tick = 0; tick < 10; tick += 1) {
    engine.step();
  }
}

describe("certification task pools", () => {
  for (const track of ["cka", "ckad", "cks"] as const) {
    it(`${track} uses only its own tasks`, () => {
      const exam = getCertificationExam(track);
      expect(exam).toBeDefined();
      if (exam === undefined) {
        return;
      }

      expect(exam.taskPool).toHaveLength(30);
      expect(exam.taskPool.length).toBeGreaterThan(exam.taskCount);
      const capstones = exam.taskPool.filter((task) => task.id.includes("capstone"));
      expect(capstones).toHaveLength(5);
      expect(capstones.every((task) => task.checks.length >= 4)).toBe(true);
      expect(exam.taskPool.every((task) => task.id.startsWith(`${track}-`))).toBe(true);
      expect(new Set(exam.taskPool.map((task) => task.id)).size).toBe(exam.taskPool.length);
      const mapped = new Set(
        certificationDomains
          .filter((domain) => domain.trackId === track)
          .flatMap((domain) => domain.taskIds),
      );
      expect(exam.taskPool.every((task) => mapped.has(task.id))).toBe(true);
    });
  }
});

describe("certification task solutions", () => {
  for (const exam of certificationExams) {
    for (const task of exam.taskPool) {
      it(`${task.id} completes with its manifests and checks`, () => {
        const engine = new SimEngine({ intervalMs: 1_000 });
        engine.seed({
          nodes: task.scenario.nodes.map((node) => ({
            name: node.name,
            ...(node.cpu === undefined ? {} : { cpu: node.cpu }),
            ...(node.memory === undefined ? {} : { memory: node.memory }),
            ...(node.labels === undefined ? {} : { labels: node.labels }),
            ...(node.taints === undefined
              ? {}
              : {
                  taints: node.taints.map((taint) => ({
                    key: taint.key,
                    effect: taint.effect,
                    ...(taint.value === undefined ? {} : { value: taint.value }),
                  })),
                }),
          })),
          objects: task.scenario.objects,
          files: task.scenario.files,
        });
        expect(
          evaluateChecks(task.checks, context(engine)).filter((result) => result.pass),
          task.id,
        ).toEqual([]);

        for (const file of Object.keys(task.scenario.files)) {
          expect(engine.execute(`kubectl apply -f ${file}`).ok, file).toBe(true);
        }
        settle(engine);

        for (const check of task.checks) {
          if (check.type !== "deployment") {
            continue;
          }
          if (check.replicas !== undefined) {
            engine.execute(
              `kubectl scale deployment ${check.name} --replicas=${check.replicas}${namespaceFlag(check.namespace)}`,
            );
          }
          if (check.image !== undefined) {
            engine.execute(
              `kubectl set image deployment/${check.name} ${check.name}=${check.image}${namespaceFlag(check.namespace)}`,
            );
          }
        }
        settle(engine);

        for (const check of task.checks) {
          if (check.type !== "command") {
            continue;
          }
          const command = solutionCommand(
            check as Extract<ParsedCommand, { verb: string }>,
            engine,
            check as unknown as Record<string, unknown>,
          );
          if (command !== undefined) {
            const result = engine.execute(command);
            expect(result.ok, `${task.id}: ${command}`).toBe(true);
          }
          settle(engine);
        }
        settle(engine);

        const pending = evaluateChecks(task.checks, context(engine)).filter(
          (result) => !result.pass,
        );
        expect(
          pending.map((result) => result.label),
          task.id,
        ).toEqual([]);
      });
    }
  }
});
