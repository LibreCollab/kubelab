import { certificationExams } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import { gradeExam } from "./certification";

const cka = certificationExams.find((exam) => exam.id === "cka");

describe("certification exams", () => {
  it("builds a ten-question exam for every track", () => {
    expect(certificationExams).toHaveLength(5);
    for (const exam of certificationExams) {
      expect(exam.questions).toHaveLength(10);
      expect(new Set(exam.questions.map((question) => question.id)).size).toBe(10);
      expect(exam.questions.every((question) => question.answer < question.options.length)).toBe(
        true,
      );
      expect(exam.tasks).toHaveLength(3);
      expect(exam.tasks.every((task) => task.checks.every((check) => check.type !== "quiz"))).toBe(
        true,
      );
    }
  });

  it("grades passing and weak-unit results", () => {
    expect(cka).toBeDefined();
    if (cka === undefined) {
      return;
    }

    const correct = Object.fromEntries(
      cka.questions.map((question) => [question.id, question.answer]),
    );
    const passed = gradeExam(cka, correct);
    expect(passed.percent).toBe(100);
    expect(passed.passed).toBe(true);
    expect(passed.weakUnits).toEqual([]);

    const failed = gradeExam(cka, {});
    expect(failed.score).toBe(0);
    expect(failed.passed).toBe(false);
    expect(failed.incorrect).toHaveLength(10);
    expect(failed.weakUnits.length).toBeGreaterThan(0);
  });
});
