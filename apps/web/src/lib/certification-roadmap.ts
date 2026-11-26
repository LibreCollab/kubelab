import {
  type CertificationDomain,
  certificationDomains,
  type ExamQuestion,
  getCertificationExam,
} from "@kubelab/content";

import type { ExamAttempt, LabExamAttempt } from "./certification";
import type { ProgressMap } from "./progress";
import { progressDb } from "./progress-db";

export type ReadinessBand = "Not ready" | "Almost ready" | "Ready to book";

export interface DomainReadiness {
  domain: CertificationDomain;
  completedLessons: number;
  totalLessons: number;
  coverage: number;
  evidence?: number;
  score: number;
  weak: boolean;
  strong: boolean;
  nextLessonId?: string;
}

export interface ReadinessNextAction {
  type: "lesson" | "exam";
  label: string;
  lessonId?: string;
  trackId?: string;
}

export interface CertificationReadiness {
  trackId: string;
  score: number;
  band: ReadinessBand;
  confidence: "None" | "Low" | "Medium" | "High";
  evidenceAttempts: number;
  scoreChange?: number;
  domains: DomainReadiness[];
  nextAction?: ReadinessNextAction;
}

export interface ReadinessSnapshot {
  id?: number;
  trackId: string;
  dateKey: string;
  score: number;
  createdAt: number;
}

export function readinessBand(score: number): ReadinessBand {
  if (score >= 85) {
    return "Ready to book";
  }
  return score >= 65 ? "Almost ready" : "Not ready";
}

function knowledgeEvidence(
  domain: CertificationDomain,
  attempts: ExamAttempt[],
  questions: Map<string, ExamQuestion>,
): number | undefined {
  let correct = 0;
  let total = 0;
  for (const attempt of attempts) {
    const questionIds = attempt.questionIds ?? Object.keys(attempt.answers);
    for (const questionId of questionIds) {
      const question = questions.get(questionId);
      if (question === undefined) {
        continue;
      }
      const matchesDomain =
        question.domainId === undefined
          ? domain.questionUnits.includes(question.unit)
          : question.domainId === domain.id;
      if (!matchesDomain) {
        continue;
      }
      total += 1;
      if (attempt.answers[questionId] === question.answer) {
        correct += 1;
      }
    }
  }
  return total === 0 ? undefined : correct / total;
}

function labEvidence(domain: CertificationDomain, attempts: LabExamAttempt[]): number | undefined {
  let passed = 0;
  let total = 0;
  for (const attempt of attempts) {
    for (const task of attempt.taskResults) {
      if (!domain.taskIds.includes(task.taskId)) {
        continue;
      }
      passed += task.passedChecks;
      total += task.totalChecks;
    }
  }
  return total === 0 ? undefined : passed / total;
}

export function calculateReadiness(
  trackId: string,
  progress: ProgressMap,
  knowledgeAttempts: ExamAttempt[],
  labAttempts: LabExamAttempt[],
  domains: CertificationDomain[] = certificationDomains.filter(
    (domain) => domain.trackId === trackId,
  ),
): CertificationReadiness {
  const exam = getCertificationExam(trackId);
  const format = exam?.format ?? "knowledge";
  const questions = new Map(
    (exam?.questionPool.length === 0 ? exam.questions : (exam?.questionPool ?? [])).map(
      (question) => [question.id, question] as const,
    ),
  );
  const recentKnowledge = knowledgeAttempts
    .filter((attempt) => attempt.trackId === trackId)
    .sort((left, right) => right.completedAt - left.completedAt)
    .slice(0, 3);
  const recentLabs = labAttempts
    .filter((attempt) => attempt.trackId === trackId)
    .sort((left, right) => right.completedAt - left.completedAt)
    .slice(0, 3);

  const domainReadiness = domains.map((domain) => {
    const completedLessons = domain.lessonIds.filter(
      (lessonId) => progress[lessonId]?.status === "completed",
    ).length;
    const coverage = domain.lessonIds.length === 0 ? 0 : completedLessons / domain.lessonIds.length;
    const evidence =
      format === "hands-on"
        ? labEvidence(domain, recentLabs)
        : knowledgeEvidence(domain, recentKnowledge, questions);
    const score = Math.round(coverage * 45 + (evidence ?? 0) * 55);
    const nextLessonId = domain.lessonIds.find(
      (lessonId) => progress[lessonId]?.status !== "completed",
    );

    return {
      domain,
      completedLessons,
      totalLessons: domain.lessonIds.length,
      coverage,
      ...(evidence === undefined ? {} : { evidence }),
      score,
      weak: score < 65,
      strong: score >= 85,
      ...(nextLessonId === undefined ? {} : { nextLessonId }),
    } satisfies DomainReadiness;
  });

  const evidenceAttempts = format === "hands-on" ? recentLabs.length : recentKnowledge.length;
  const confidence =
    evidenceAttempts === 0
      ? "None"
      : evidenceAttempts === 1
        ? "Low"
        : evidenceAttempts === 2
          ? "Medium"
          : "High";
  const percentages =
    format === "hands-on"
      ? recentLabs.map((attempt) => attempt.percent)
      : recentKnowledge.map((attempt) =>
          attempt.total === 0 ? 0 : Math.round((attempt.score / attempt.total) * 100),
        );
  const scoreChange =
    percentages.length < 2 ? undefined : (percentages[0] ?? 0) - (percentages[1] ?? 0);

  const totalWeight = domains.reduce((sum, domain) => sum + domain.weight, 0);
  const score =
    totalWeight === 0
      ? 0
      : Math.round(
          domainReadiness.reduce((sum, item) => sum + item.score * item.domain.weight, 0) /
            totalWeight,
        );
  const weakCandidate = [...domainReadiness]
    .filter((item) => item.weak)
    .sort((left, right) => right.domain.weight - left.domain.weight);
  const incomplete = [...domainReadiness]
    .filter((item) => item.nextLessonId !== undefined)
    .sort((left, right) => right.domain.weight - left.domain.weight);
  const focus = weakCandidate[0] ?? incomplete[0];
  let nextAction: ReadinessNextAction | undefined;
  if (focus?.nextLessonId !== undefined) {
    nextAction = {
      type: "lesson",
      label: `Continue ${focus.domain.title}`,
      lessonId: focus.nextLessonId,
    };
  } else if (exam !== undefined) {
    nextAction = {
      type: "exam",
      label: format === "hands-on" ? "Start hands-on exam" : "Start knowledge exam",
      trackId,
    };
  }

  return {
    trackId,
    score,
    band: readinessBand(score),
    confidence,
    evidenceAttempts,
    ...(scoreChange === undefined ? {} : { scoreChange }),
    domains: domainReadiness,
    ...(nextAction === undefined ? {} : { nextAction }),
  };
}

export async function saveReadinessSnapshot(
  trackId: string,
  dateKey: string,
  score: number,
): Promise<void> {
  const existing = await progressDb.readinessSnapshots
    .where("[trackId+dateKey]")
    .equals([trackId, dateKey])
    .first();
  if (existing?.id !== undefined) {
    await progressDb.readinessSnapshots.update(existing.id, { score, createdAt: Date.now() });
    return;
  }
  await progressDb.readinessSnapshots.add({
    trackId,
    dateKey,
    score,
    createdAt: Date.now(),
  });
}

export async function latestReadinessSnapshots(
  trackId: string,
  limit = 5,
): Promise<ReadinessSnapshot[]> {
  return progressDb.readinessSnapshots
    .where("trackId")
    .equals(trackId)
    .reverse()
    .sortBy("createdAt")
    .then((rows) => rows.slice(-limit));
}
