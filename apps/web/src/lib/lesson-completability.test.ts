import { curriculumLessons, type Lesson } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type Pod,
  SimEngine,
} from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { type CheckContext, evaluateChecks } from "./checks";

function seed(lesson: Lesson): SimEngine {
  const engine = new SimEngine({ intervalMs: 1_000 });
  engine.seed({
    nodes: lesson.scenario.nodes.map((node) => ({
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
    objects: lesson.scenario.objects,
    files: lesson.scenario.files,
  });
  return engine;
}

function context(engine: SimEngine, answers: Record<string, number>): CheckContext {
  return {
    pods: engine.store.list<Pod>("Pod"),
    deployments: engine.store.list<KubeDeployment>("Deployment"),
    services: engine.store.list<KubeService>("Service"),
    ingresses: engine.store.list<KubeIngress>("Ingress"),
    configMaps: engine.store.list<KubeConfigMap>("ConfigMap"),
    secrets: engine.store.list<KubeSecret>("Secret"),
    commands: engine.commands,
    answers,
  };
}

function answerKey(lesson: Lesson): Record<string, number> {
  return Object.fromEntries(
    lesson.checks.flatMap((check) => (check.type === "quiz" ? [[check.id, check.answer]] : [])),
  );
}

function documentedCommands(lesson: Lesson): string[] {
  return lesson.hints.flatMap((hint) => {
    const match = hint.match(/(?:kubectl|helm|argocd|kustomize)\b[\s\S]*/);
    if (match === null) {
      return [];
    }
    return [match[0].replace(/["'`]+$/, "").trim()];
  });
}

describe("lesson completability", () => {
  for (const lesson of curriculumLessons) {
    const interactive = lesson.checks.some((check) => check.type !== "quiz");

    it(`${lesson.id} does not complete before learner input`, () => {
      const engine = seed(lesson);
      const answers = interactive ? answerKey(lesson) : {};
      const results = evaluateChecks(lesson.checks, context(engine, answers));
      expect(results.filter((result) => !result.pass)).not.toHaveLength(0);
    });

    if (!interactive) {
      continue;
    }

    it(`${lesson.id} completes with its documented commands`, () => {
      const commands = documentedCommands(lesson);
      expect(commands.length).toBeGreaterThan(0);

      const engine = seed(lesson);
      for (const command of commands) {
        const result = engine.execute(command);
        expect(result.ok, `${lesson.id}: ${command}`).toBe(true);
        for (let tick = 0; tick < 10; tick += 1) {
          engine.step();
        }
      }

      const results = evaluateChecks(lesson.checks, context(engine, answerKey(lesson)));
      expect(results.filter((result) => !result.pass)).toEqual([]);
    });
  }
});
