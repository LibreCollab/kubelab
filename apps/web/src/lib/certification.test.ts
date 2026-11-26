import { certificationExams } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import { gradeExam, nextReviewSchedule, type ReviewCard } from "./certification";

const kcna = certificationExams.find((exam) => exam.id === "kcna");

describe("certification exams", () => {
  it("matches real exam formats for every track", () => {
    expect(certificationExams).toHaveLength(5);
    for (const exam of certificationExams) {
      expect(exam.questions).toHaveLength(exam.questionCount);
      expect(new Set(exam.questions.map((question) => question.id)).size).toBe(exam.questionCount);
      expect(exam.questions.every((question) => question.answer < question.options.length)).toBe(
        true,
      );
      expect(exam.tasks).toHaveLength(exam.taskCount);
      expect(exam.taskPool.length).toBeGreaterThanOrEqual(exam.taskCount);
      expect(exam.tasks.every((task) => task.checks.every((check) => check.type !== "quiz"))).toBe(
        true,
      );
      if (exam.format === "knowledge") {
        expect(exam.questionCount).toBe(60);
        expect(exam.durationMinutes).toBe(90);
        expect(exam.taskCount).toBe(0);
      } else {
        expect(exam.questionCount).toBe(0);
        expect(exam.durationMinutes).toBe(120);
        expect(exam.taskCount).toBe(15);
      }
    }
  });

  it("advances review intervals across correct answers", () => {
    const base: ReviewCard = {
      id: "card",
      trackId: "kcna",
      questionId: "q",
      dueAt: 0,
      intervalDays: 0,
      lapses: 0,
      reps: 0,
    };
    let card = base;
    const intervals: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const schedule = nextReviewSchedule(card, true, 0);
      intervals.push(schedule.intervalDays);
      card = { ...card, ...schedule };
    }
    expect(intervals).toEqual([3, 7, 14, 30, 30]);
    expect(nextReviewSchedule(card, false, 1)).toMatchObject({
      intervalDays: 1,
      lapses: 1,
      reps: 0,
    });
  });

  it("grades passing and weak-unit results", () => {
    expect(kcna).toBeDefined();
    if (kcna === undefined) {
      return;
    }

    const correct = Object.fromEntries(
      kcna.questions.map((question) => [question.id, question.answer]),
    );
    const passed = gradeExam(kcna, correct);
    expect(passed.percent).toBe(100);
    expect(passed.passed).toBe(true);
    expect(passed.weakUnits).toEqual([]);

    const failed = gradeExam(kcna, {});
    expect(failed.score).toBe(0);
    expect(failed.passed).toBe(false);
    expect(failed.incorrect).toHaveLength(60);
    expect(failed.weakUnits.length).toBeGreaterThan(0);
  });
});
