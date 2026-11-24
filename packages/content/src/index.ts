import { parse } from "yaml";

import {
  type CertificationTrackDefinition,
  certificationTrackDefinitions,
  type UnitDefinition,
  unitDefinitions,
} from "./curriculum";
import { type Lesson, lessonSpecSchema } from "./schema";

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

    return { ...parsed, theoryMarkdown };
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
}

export interface CertificationExam {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
  labs: Array<{ lessonId: string; lessonTitle: string }>;
}

const examUnits: Record<string, string[]> = {
  kcna: [
    "containers",
    "architecture",
    "workloads",
    "services",
    "config",
    "storage",
    "scheduling",
    "networking",
    "security",
    "observability",
  ],
  kcsa: ["architecture", "services", "config", "networking", "security", "observability"],
  cka: [
    "architecture",
    "workloads",
    "services",
    "config",
    "storage",
    "scheduling",
    "networking",
    "observability",
  ],
  ckad: ["workloads", "services", "config", "storage", "scheduling", "observability"],
  cks: ["config", "services", "networking", "security", "observability"],
};

const examPool = lessons
  .filter((lesson) => lesson.unit !== "certification")
  .flatMap((lesson) =>
    lesson.checks.flatMap((check) =>
      check.type === "quiz"
        ? [
            {
              id: `${lesson.id}:${check.id}`,
              prompt: check.question,
              options: check.options,
              answer: check.answer,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              unit: lesson.unit,
              label: check.label,
            } satisfies ExamQuestion,
          ]
        : [],
    ),
  );

export const certificationExams: CertificationExam[] = certificationTracks.map((track) => {
  const allowedUnits = new Set(examUnits[track.id] ?? []);
  const questions = examPool
    .filter((question) => allowedUnits.has(question.unit))
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 10);

  return {
    id: track.id,
    name: track.name,
    description: track.description,
    durationMinutes: 15,
    passingScore: 70,
    questions,
    labs: [...new Map(questions.map((question) => [question.lessonId, question])).values()]
      .slice(0, 4)
      .map((question) => ({
        lessonId: question.lessonId,
        lessonTitle: question.lessonTitle,
      })),
  };
});

export const examQuestionsById = new Map(
  certificationExams.flatMap((exam) =>
    exam.questions.map((question) => [question.id, question] as const),
  ),
);

export function getCertificationExam(id: string): CertificationExam | undefined {
  return certificationExams.find((exam) => exam.id === id);
}

export type { Lesson, LessonCheck, LessonSpec } from "./schema";
export { lessonSpecSchema } from "./schema";
