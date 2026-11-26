import { parse } from "yaml";

import { certificationDomains } from "./certification-roadmaps";
import { certificationTaskSeeds } from "./certification-tasks";
import {
  type CertificationTrackDefinition,
  certificationTrackDefinitions,
  type UnitDefinition,
  unitDefinitions,
} from "./curriculum";
import { type KnowledgeQuestion, knowledgeByTrack } from "./knowledge-questions";
import { quizExplanations } from "./quiz-explanations";
import { type Lesson, type LessonCheck, type LessonSpec, lessonSpecSchema } from "./schema";

interface Unit extends UnitDefinition {
  lessons: Lesson[];
}

interface CertificationTrack extends CertificationTrackDefinition {
  lessons: Lesson[];
}

const specSources = import.meta.glob("../lessons/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const theorySources = import.meta.glob("../lessons/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function fileId(path: string, extension: string): string {
  const name = path.split("/").pop() ?? path;
  return name.slice(0, -extension.length);
}

const theoryById = new Map(
  Object.entries(theorySources).map(([path, markdown]) => [fileId(path, ".md"), markdown]),
);

export const lessons: Lesson[] = Object.entries(specSources)
  .map(([path, spec]) => {
    const parsed = lessonSpecSchema.parse(parse(spec) as unknown);
    const id = fileId(path, ".yaml");

    if (parsed.id !== id) {
      throw new Error(`Lesson file ${path} must match its id "${parsed.id}"`);
    }
    if (parsed.theory !== `./${parsed.id}.md`) {
      throw new Error(`Lesson "${parsed.id}" must point theory at ./${parsed.id}.md`);
    }

    const theoryMarkdown = theoryById.get(parsed.id);
    if (theoryMarkdown === undefined) {
      throw new Error(`Lesson "${parsed.id}" is missing ./${parsed.id}.md`);
    }

    const checks = parsed.checks.map((check) =>
      check.type === "quiz" && check.explanation === undefined
        ? {
            ...check,
            ...(quizExplanations[`${parsed.id}:${check.id}`] === undefined
              ? {}
              : { explanation: quizExplanations[`${parsed.id}:${check.id}`] }),
          }
        : check,
    );

    return { ...parsed, checks, theoryMarkdown };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const unitById = new Map(unitDefinitions.map((unit) => [unit.id, unit]));

for (const lesson of lessons) {
  if (!unitById.has(lesson.unit)) {
    throw new Error(`Lesson "${lesson.id}" references unknown unit "${lesson.unit}"`);
  }

  const labels = lesson.checks.map((check) => check.label);
  if (new Set(labels).size !== labels.length) {
    throw new Error(`Lesson "${lesson.id}" has duplicate check labels`);
  }

  const quizIds = lesson.checks.flatMap((check) => (check.type === "quiz" ? [check.id] : []));
  if (new Set(quizIds).size !== quizIds.length) {
    throw new Error(`Lesson "${lesson.id}" has duplicate quiz ids`);
  }
}

export const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

export const units: Unit[] = unitDefinitions.map((unit) => ({
  ...unit,
  lessons: lessons
    .filter((lesson) => lesson.unit === unit.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
}));

export const curriculumLessons: Lesson[] = units.flatMap((unit) => unit.lessons);

export const certificationTracks: CertificationTrack[] = certificationTrackDefinitions.map(
  (track) => ({
    ...track,
    lessons: track.lessonIds.flatMap((id) => {
      const lesson = lessonsById.get(id);
      if (lesson === undefined) {
        throw new Error(`Certification track "${track.id}" references unknown lesson "${id}"`);
      }
      return [lesson];
    }),
  }),
);

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  lessonId: string;
  lessonTitle: string;
  unit: string;
  label: string;
  explanation?: string;
  domainId?: string;
}

export interface ExamTask {
  id: string;
  title: string;
  instruction: string;
  lessonId: string;
  unit: string;
  scenario: LessonSpec["scenario"];
  checks: LessonCheck[];
}

export interface CertificationExam {
  id: string;
  name: string;
  description: string;
  format: "knowledge" | "hands-on";
  questionCount: number;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
  labs: Array<{ lessonId: string; lessonTitle: string }>;
  taskCount: number;
  taskPool: ExamTask[];
  tasks: ExamTask[];
}

function normalizeTaskCheck(raw: Record<string, unknown>): LessonCheck {
  if (raw.type === "pod" || raw.type === "deployment") {
    return {
      ...raw,
      namespace: raw.namespace ?? "default",
      labels: raw.labels ?? {},
    } as LessonCheck;
  }
  if (raw.type === "configmap") {
    return { ...raw, namespace: raw.namespace ?? "default", data: raw.data ?? {} } as LessonCheck;
  }
  if (raw.type === "secret") {
    return { ...raw, namespace: raw.namespace ?? "default", keys: raw.keys ?? [] } as LessonCheck;
  }
  if (
    raw.type === "env" ||
    raw.type === "service" ||
    raw.type === "dns" ||
    raw.type === "ingress" ||
    raw.type === "command"
  ) {
    return { ...raw, namespace: raw.namespace ?? "default" } as LessonCheck;
  }
  return raw as LessonCheck;
}

const labTaskPools: Record<string, string[]> = {
  cka: ["cka"],
  ckad: ["ckad"],
  cks: ["cks"],
};

const taskCounts: Record<string, number> = { kcna: 0, kcsa: 0, cka: 15, ckad: 15, cks: 15 };
const knowledgeQuestionCounts: Record<string, number> = { kcna: 60, kcsa: 60 };
const passingScores: Record<string, number> = { kcna: 75, kcsa: 75, cka: 66, ckad: 66, cks: 67 };
const durationMinutes: Record<string, number> = {
  kcna: 90,
  kcsa: 90,
  cka: 120,
  ckad: 120,
  cks: 120,
};

function questionSortKey(trackId: string, questionId: string): number {
  let hash = 2166136261;
  for (const value of `${trackId}:${questionId}`) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function allocateQuestions(weights: number[], count: number): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const exact = weights.map((weight) => (weight / total) * count);
  const counts = exact.map((value) => Math.floor(value));
  let remaining = count - counts.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (const entry of order) {
    if (remaining === 0) {
      break;
    }
    counts[entry.index] = (counts[entry.index] ?? 0) + 1;
    remaining -= 1;
  }
  return counts;
}

function toExamQuestion(question: KnowledgeQuestion): ExamQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options,
    answer: question.answer,
    lessonId: question.lessonId,
    lessonTitle: question.lessonTitle,
    unit: question.unit,
    label: question.label,
    explanation: question.explanation,
    domainId: question.domainId,
  };
}

function selectKnowledgeQuestions(trackId: string, count: number): ExamQuestion[] {
  const domains = certificationDomains.filter((domain) => domain.trackId === trackId);
  const bank = knowledgeByTrack[trackId as keyof typeof knowledgeByTrack];
  if (bank === undefined || domains.length === 0) {
    return [];
  }
  const quotas = allocateQuestions(
    domains.map((domain) => domain.weight),
    count,
  );
  return domains.flatMap((domain, index) => {
    const quota = quotas[index] ?? 0;
    const sorted = bank
      .filter((question) => question.domainId === domain.id)
      .sort(
        (left, right) => questionSortKey(trackId, left.id) - questionSortKey(trackId, right.id),
      );
    const buckets = [0, 1, 2, 3].map((answer) =>
      sorted.filter((question) => question.answer === answer),
    );
    const selected: KnowledgeQuestion[] = [];
    let remaining = quota;
    while (remaining > 0) {
      for (const bucket of buckets) {
        const next = bucket.shift();
        if (next !== undefined && remaining > 0) {
          selected.push(next);
          remaining -= 1;
        }
      }
    }
    return selected
      .sort((left, right) => questionSortKey(trackId, left.id) - questionSortKey(trackId, right.id))
      .map(toExamQuestion);
  });
}

export const certificationExams: CertificationExam[] = certificationTracks.map((track) => {
  const questionCount = knowledgeQuestionCounts[track.id] ?? 0;
  const questions = questionCount === 0 ? [] : selectKnowledgeQuestions(track.id, questionCount);
  const taskPool: ExamTask[] = (labTaskPools[track.id] ?? [])
    .flatMap((poolTrack) => certificationTaskSeeds[poolTrack] ?? [])
    .map((seed) => ({
      id: seed.id,
      title: seed.title,
      instruction: seed.instruction,
      lessonId: "certification",
      unit: seed.unit,
      scenario: seed.scenario,
      checks: seed.checks.map(normalizeTaskCheck),
    }));
  const taskCount = taskCounts[track.id] ?? 0;

  return {
    id: track.id,
    name: track.name,
    description: track.description,
    format: track.format,
    questionCount,
    durationMinutes: durationMinutes[track.id] ?? 15,
    passingScore: passingScores[track.id] ?? 70,
    questions,
    labs: [...new Map(questions.map((question) => [question.lessonId, question])).values()]
      .slice(0, 4)
      .map((question) => ({
        lessonId: question.lessonId,
        lessonTitle: question.lessonTitle,
      })),
    taskCount,
    taskPool,
    tasks: taskPool.slice(0, taskCount),
  };
});

export const examQuestionsById = new Map(
  [...knowledgeByTrack.kcna, ...knowledgeByTrack.kcsa].map(
    (question) => [question.id, toExamQuestion(question)] as const,
  ),
);

export function getCertificationExam(id: string): CertificationExam | undefined {
  return certificationExams.find((exam) => exam.id === id);
}

export type { CertificationDomain } from "./certification-roadmaps";
export { certificationDomains } from "./certification-roadmaps";
export type { Lesson, LessonCheck, LessonSpec } from "./schema";
export { lessonSpecSchema } from "./schema";
