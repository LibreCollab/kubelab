import type { LessonCheck } from "@kubelab/content";
import type { Pod, PodPhase } from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { evaluateCheck } from "./checks";

function makePod(
  overrides: {
    name?: string;
    namespace?: string;
    labels?: Record<string, string>;
    phase?: PodPhase;
  } = {},
): Pod {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: overrides.name ?? "web",
      namespace: overrides.namespace ?? "default",
      labels: overrides.labels ?? { app: "web" },
      uid: "pod-1",
      resourceVersion: 1,
      creationTick: 0,
    },
    spec: {
      containers: [{ name: "web", image: "nginx" }],
    },
    status: {
      phase: overrides.phase ?? "Running",
    },
  };
}

function check(overrides: Partial<LessonCheck> = {}): LessonCheck {
  return {
    type: "pod",
    label: "web is ready",
    namespace: "default",
    name: "web",
    labels: {},
    ...overrides,
  };
}

describe("lesson checks", () => {
  it("passes when the pod matches name, namespace, labels, and phase", () => {
    const result = evaluateCheck(check({ labels: { app: "web" }, phase: "Running" }), [makePod()]);
    expect(result.pass).toBe(true);
  });

  it("fails on a missing label", () => {
    expect(evaluateCheck(check({ labels: { app: "api" } }), [makePod()]).pass).toBe(false);
  });

  it("fails on the wrong phase", () => {
    expect(evaluateCheck(check({ phase: "Running" }), [makePod({ phase: "Pending" })]).pass).toBe(
      false,
    );
  });

  it("fails on a namespace mismatch", () => {
    expect(evaluateCheck(check({ namespace: "other" }), [makePod()]).pass).toBe(false);
  });
});
