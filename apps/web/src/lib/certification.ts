import type { CertificationExam, ExamQuestion } from "@kubelab/content";

import { progressDb } from "./progress-db";

export interface ExamAttempt {
  id?: number;
  trackId: string;
  score: number;
  total: number;
  passed: boolean;
  completedAt: number;
  answers: Record<string, number>;
  questionIds?: string[];
  weakUnits: string[];
}

export interface LabTaskResult {
  taskId: string;
  title: string;
  unit: string;
  passed: boolean;
  passedChecks: number;
  totalChecks: number;
}

export interface LabExamAttempt {
  id?: number;
  trackId: string;
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  completedAt: number;
  taskResults: LabTaskResult[];
}

export interface ReviewCard {
  id: string;
  trackId: string;
  questionId: string;
  dueAt: number;
  intervalDays: number;
  lapses: number;
}

export interface ExamResult {
  score: number;
  total: number;
  percent: number;
  passed: boolean;
  weakUnits: string[];
  incorrect: ExamQuestion[];
}

const DAY = 24 * 60 * 60 * 1000;
const INTERVALS = [1, 3, 7, 14, 30];

export function gradeExam(exam: CertificationExam, answers: Record<string, number>): ExamResult {
  const incorrect = exam.questions.filter((question) => answers[question.id] !== question.answer);
  const score = exam.questions.length - incorrect.length;
  const percent =
    exam.questions.length === 0 ? 0 : Math.round((score / exam.questions.length) * 100);
  const weakUnits = [...new Set(incorrect.map((question) => question.unit))];

  return {
    score,
    total: exam.questions.length,
    percent,
    passed: percent >= exam.passingScore,
    weakUnits,
    incorrect,
  };
}

export async function saveExamAttempt(
  exam: CertificationExam,
  answers: Record<string, number>,
  result: ExamResult,
): Promise<number> {
  const attempt: ExamAttempt = {
    trackId: exam.id,
    score: result.score,
    total: result.total,
    passed: result.passed,
    completedAt: Date.now(),
    answers,
    questionIds: exam.questions.map((question) => question.id),
    weakUnits: result.weakUnits,
  };
  const existingCards = await progressDb.reviewCards.bulkGet(
    exam.questions.map((question) => question.id),
  );
  const cards: ReviewCard[] = [];
  const now = Date.now();

  exam.questions.forEach((question, index) => {
    const correct = answers[question.id] === question.answer;
    const card = existingCards[index];
    if (correct && card === undefined) {
      return;
    }
    const intervalDays = correct
      ? (INTERVALS[Math.min((card?.lapses ?? 0) + 1, INTERVALS.length - 1)] ?? 1)
      : 0;
    cards.push({
      id: question.id,
      trackId: exam.id,
      questionId: question.id,
      dueAt: now + intervalDays * DAY,
      intervalDays,
      lapses: correct ? (card?.lapses ?? 0) : (card?.lapses ?? 0) + 1,
    });
  });

  return progressDb.transaction("rw", progressDb.examAttempts, progressDb.reviewCards, async () => {
    const id = await progressDb.examAttempts.add(attempt);
    if (cards.length > 0) {
      await progressDb.reviewCards.bulkPut(cards);
    }
    return id;
  });
}

export async function dueReviewCards(now = Date.now()): Promise<ReviewCard[]> {
  return progressDb.reviewCards.where("dueAt").belowOrEqual(now).sortBy("dueAt");
}

export async function answerReviewCard(card: ReviewCard, correct: boolean): Promise<void> {
  const lapses = correct ? card.lapses : card.lapses + 1;
  const intervalDays = correct
    ? (INTERVALS[Math.min(card.lapses + 1, INTERVALS.length - 1)] ?? 1)
    : 1;
  await progressDb.reviewCards.put({
    ...card,
    dueAt: Date.now() + intervalDays * DAY,
    intervalDays,
    lapses,
  });
}

export async function saveLabExamAttempt(
  attempt: Omit<LabExamAttempt, "id" | "completedAt">,
): Promise<number> {
  return progressDb.labExamAttempts.add({
    ...attempt,
    completedAt: Date.now(),
  });
}

export async function latestLabExamAttempts(): Promise<LabExamAttempt[]> {
  return progressDb.labExamAttempts.orderBy("completedAt").reverse().limit(10).toArray();
}

export async function latestExamAttempts(): Promise<ExamAttempt[]> {
  return progressDb.examAttempts.orderBy("completedAt").reverse().limit(10).toArray();
}
