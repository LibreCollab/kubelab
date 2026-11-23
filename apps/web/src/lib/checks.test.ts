import { getLesson, type LessonCheck } from "@kubelab/content";
import { type ParsedCommand, type Pod, type PodPhase, parseKubectl } from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { type CheckContext, evaluateCheck, evaluateChecks } from "./checks";

type PodCheck = Extract<LessonCheck, { type: "pod" }>;

function makePod(
  overrides: {
    name?: string;
    namespace?: string;
    image?: string;
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
      containers: [{ name: "web", image: overrides.image ?? "nginx" }],
    },
    status: {
      phase: overrides.phase ?? "Running",
    },
  };
}

function makeCheck(overrides: Partial<PodCheck> = {}): PodCheck {
  return {
    type: "pod",
    label: "web is ready",
    namespace: "default",
    name: "web",
    labels: {},
    ...overrides,
  };
}

function command(input: string): ParsedCommand {
  const parsed = parseKubectl(input);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  return parsed;
}

function context(pods: Pod[] = [], commands: ParsedCommand[] = []): CheckContext {
  return { pods, commands };
}

describe("lesson checks", () => {
  it("passes when the pod matches name, namespace, labels, and phase", () => {
    const result = evaluateCheck(
      makeCheck({ labels: { app: "web" }, phase: "Running" }),
      context([makePod()]),
    );
    expect(result.pass).toBe(true);
  });

  it("fails on a missing label", () => {
    expect(evaluateCheck(makeCheck({ labels: { app: "api" } }), context([makePod()])).pass).toBe(
      false,
    );
  });

  it("fails on the wrong phase", () => {
    expect(
      evaluateCheck(makeCheck({ phase: "Running" }), context([makePod({ phase: "Pending" })])).pass,
    ).toBe(false);
  });

  it("fails on a namespace mismatch", () => {
    expect(evaluateCheck(makeCheck({ namespace: "other" }), context([makePod()])).pass).toBe(false);
  });

  it("passes a command check for the executed command", () => {
    const check: LessonCheck = {
      type: "command",
      label: "Run kubectl get pods",
      verb: "get",
      resource: "pods",
      namespace: "default",
    };

    expect(evaluateCheck(check, context([], [command("kubectl get pods")])).pass).toBe(true);
    expect(evaluateCheck(check, context([], [command("kubectl get nodes")])).pass).toBe(false);
  });

  it("requires the correct quiz answer", () => {
    const lesson = getLesson("containers-101");
    const quizCheck = lesson?.checks.find((check) => check.type === "quiz");
    expect(quizCheck).toBeDefined();
    if (quizCheck === undefined || quizCheck.type !== "quiz") {
      return;
    }

    expect(evaluateCheck(quizCheck, { pods: [], commands: [], answers: {} }).pass).toBe(false);
    expect(
      evaluateCheck(quizCheck, {
        pods: [],
        commands: [],
        answers: { [quizCheck.id]: quizCheck.answer },
      }).pass,
    ).toBe(true);
  });

  it("uses the real lesson checks against a mistyped label", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const results = evaluateChecks(
      lesson.checks,
      context([makePod({ labels: { run: "web", app: "webb" } })]),
    );

    expect(results.map((result) => result.pass)).toEqual([true, false, true, true, false]);
  });

  it("fails the real image check for a different image", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const results = evaluateChecks(
      lesson.checks,
      context([makePod({ image: "httpd", labels: { run: "web", app: "web" } })]),
    );

    expect(results.map((result) => result.pass)).toEqual([true, true, false, true, false]);
  });

  it("requires the verification command for a complete lesson", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const pods = [makePod({ labels: { run: "web", app: "web" } })];
    const withoutCommand = evaluateChecks(lesson.checks, context(pods));
    expect(withoutCommand.every((result) => result.pass)).toBe(false);

    const withCommand = evaluateChecks(lesson.checks, context(pods, [command("kubectl get pods")]));
    expect(withCommand.every((result) => result.pass)).toBe(true);
  });
});
