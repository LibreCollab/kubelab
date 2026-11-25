import { type CertificationDomain, getCertificationExam } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import type { ExamAttempt } from "./certification";
import { calculateReadiness } from "./certification-roadmap";
import type { ProgressMap } from "./progress";

const domain = (overrides: Partial<CertificationDomain>): CertificationDomain => ({
  id: "test-domain",
  trackId: "test",
  title: "Test domain",
  weight: 100,
  lessonIds: [],
  taskIds: [],
  questionUnits: [],
  ...overrides,
});

describe("certification readiness", () => {
  it("does not mark a track ready with coverage but no evidence", () => {
    const progress: ProgressMap = {
      a: { lessonId: "a", status: "completed", answers: {}, xp: 10, updatedAt: 1 },
    };
    const readiness = calculateReadiness("test", progress, [], [], [domain({ lessonIds: ["a"] })]);

    expect(readiness.score).toBe(45);
    expect(readiness.band).toBe("Not ready");
  });

  it("combines coverage and recent knowledge evidence", () => {
    const exam = getCertificationExam("kcna");
    expect(exam).toBeDefined();
    if (exam === undefined) {
      return;
    }
    const answers = Object.fromEntries(
      exam.questions
        .filter((question) => question.unit === "containers")
        .map((question) => [question.id, question.answer]),
    );
    const attempt: ExamAttempt = {
      trackId: "kcna",
      score: 1,
      total: 1,
      passed: true,
      completedAt: 10,
      answers,
      weakUnits: [],
    };
    const progress: ProgressMap = {
      "containers-101": {
        lessonId: "containers-101",
        status: "completed",
        answers: {},
        xp: 10,
        updatedAt: 1,
      },
    };
    const readiness = calculateReadiness(
      "kcna",
      progress,
      [attempt],
      [],
      [domain({ trackId: "kcna", lessonIds: ["containers-101"], questionUnits: ["containers"] })],
    );

    expect(readiness.score).toBe(100);
    expect(readiness.band).toBe("Ready to book");
    expect(readiness.domains[0]?.strong).toBe(true);
  });

  it("weights domains by their official weight", () => {
    const readiness = calculateReadiness(
      "test",
      {},
      [],
      [],
      [
        domain({ id: "heavy", weight: 75, lessonIds: ["missing"] }),
        domain({ id: "light", weight: 25, lessonIds: [] }),
      ],
    );

    expect(readiness.score).toBe(0);
  });

  it("marks domains without proof as weak", () => {
    const readiness = calculateReadiness("test", {}, [], [], [domain({ lessonIds: ["a"] })]);
    expect(readiness.domains[0]?.weak).toBe(true);
    expect(readiness.domains[0]?.evidence).toBeUndefined();
  });
});
