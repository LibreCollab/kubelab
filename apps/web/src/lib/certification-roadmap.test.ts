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
    const target = exam.questions.find((question) => question.domainId === "kcna-fundamentals");
    expect(target).toBeDefined();
    if (target === undefined) {
      return;
    }
    const answers = { [target.id]: target.answer };
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
      [
        domain({
          id: "kcna-fundamentals",
          trackId: "kcna",
          lessonIds: ["containers-101"],
          questionUnits: ["containers"],
        }),
      ],
    );

    expect(readiness.score).toBe(100);
    expect(readiness.band).toBe("Ready to book");
    expect(readiness.domains[0]?.strong).toBe(true);
  });

  it("counts unanswered questions as incorrect evidence", () => {
    const exam = getCertificationExam("kcna");
    expect(exam).toBeDefined();
    if (exam === undefined) {
      return;
    }
    const questions = exam.questions.filter(
      (question) => question.domainId === "kcna-fundamentals",
    );
    expect(questions.length).toBeGreaterThanOrEqual(2);
    const first = questions[0];
    const second = questions[1];
    if (first === undefined || second === undefined) {
      return;
    }
    const attempt: ExamAttempt = {
      trackId: "kcna",
      score: 1,
      total: 2,
      passed: false,
      completedAt: 10,
      answers: { [first.id]: first.answer },
      questionIds: [first.id, second.id],
      weakUnits: [],
    };
    const readiness = calculateReadiness(
      "kcna",
      {},
      [attempt],
      [],
      [
        domain({
          id: "kcna-fundamentals",
          trackId: "kcna",
          lessonIds: [],
        }),
      ],
    );

    expect(readiness.domains[0]?.evidence).toBe(0.5);
  });

  it("counts questions from the full rotated bank", () => {
    const exam = getCertificationExam("kcna");
    expect(exam).toBeDefined();
    if (exam === undefined) {
      return;
    }
    const visibleIds = new Set(exam.questions.map((question) => question.id));
    const question = exam.questionPool.find(
      (candidate) => candidate.domainId === "kcna-fundamentals" && !visibleIds.has(candidate.id),
    );
    expect(question).toBeDefined();
    if (question === undefined) {
      return;
    }
    const attempt: ExamAttempt = {
      trackId: "kcna",
      score: 1,
      total: 1,
      passed: false,
      completedAt: 10,
      answers: { [question.id]: question.answer },
      questionIds: [question.id],
      weakUnits: [],
    };
    const readiness = calculateReadiness(
      "kcna",
      {},
      [attempt],
      [],
      [
        domain({
          id: "kcna-fundamentals",
          trackId: "kcna",
          lessonIds: [],
        }),
      ],
    );

    expect(readiness.domains[0]?.evidence).toBe(1);
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

  it("reports confidence and score change from recent attempts", () => {
    const attempt = (completedAt: number, score: number): ExamAttempt => ({
      trackId: "test",
      score,
      total: 10,
      passed: score >= 7,
      completedAt,
      answers: {},
      weakUnits: [],
    });
    const readiness = calculateReadiness(
      "test",
      {},
      [attempt(2, 8), attempt(1, 6)],
      [],
      [domain({ lessonIds: [] })],
    );

    expect(readiness.confidence).toBe("Medium");
    expect(readiness.evidenceAttempts).toBe(2);
    expect(readiness.scoreChange).toBe(20);
  });

  it("marks domains without proof as weak", () => {
    const readiness = calculateReadiness("test", {}, [], [], [domain({ lessonIds: ["a"] })]);
    expect(readiness.domains[0]?.weak).toBe(true);
    expect(readiness.domains[0]?.evidence).toBeUndefined();
  });
});
