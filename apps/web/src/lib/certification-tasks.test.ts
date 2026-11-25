import { certificationExams } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type Pod,
  type Scenario,
  SimEngine,
} from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { evaluateChecks } from "./checks";

function context(engine: SimEngine) {
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

function findTask(trackId: string, taskId: string) {
  return certificationExams
    .find((exam) => exam.id === trackId)
    ?.taskPool.find((task) => task.id === taskId);
}

describe("incident certification tasks", () => {
  it("can be repaired with the provided CKA manifest", () => {
    const task = findTask("cka", "cka-incident-service");
    expect(task).toBeDefined();
    if (task === undefined) {
      return;
    }
    const engine = new SimEngine({ intervalMs: 1000 });
    engine.seed(task.scenario as Scenario);
    expect(engine.execute("kubectl apply -f fix.yaml").ok).toBe(true);
    engine.step();
    engine.step();
    engine.execute("kubectl get endpoints web");
    engine.execute("kubectl exec client -- curl http://web");
    expect(evaluateChecks(task.checks, context(engine)).every((check) => check.pass)).toBe(true);
  });

  it("allows the hardened CKS Deployment into a restricted namespace", () => {
    const task = findTask("cks", "cks-admission-control");
    expect(task).toBeDefined();
    if (task === undefined) {
      return;
    }
    const engine = new SimEngine({ intervalMs: 1000 });
    engine.seed(task.scenario as Scenario);
    expect(engine.execute("kubectl apply -f fix.yaml").ok).toBe(true);
    engine.step();
    engine.step();
    engine.execute("kubectl get namespace restricted");
    engine.execute("kubectl get deployment web -n restricted");
    engine.execute("kubectl get pods -n restricted");
    expect(evaluateChecks(task.checks, context(engine)).every((check) => check.pass)).toBe(true);
  });

  it("can be repaired with the provided CKAD manifest", () => {
    const task = findTask("ckad", "ckad-incident-config");
    expect(task).toBeDefined();
    if (task === undefined) {
      return;
    }
    const engine = new SimEngine({ intervalMs: 1000 });
    engine.seed(task.scenario as Scenario);
    expect(engine.execute("kubectl apply -f fix.yaml").ok).toBe(true);
    expect(evaluateChecks(task.checks, context(engine)).every((check) => check.pass)).toBe(true);
  });
});
