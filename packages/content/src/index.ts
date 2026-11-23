import { parse } from "yaml";

import pods101Theory from "../lessons/pods-101.md?raw";
import pods101Spec from "../lessons/pods-101.yaml?raw";
import { type Lesson, lessonSpecSchema } from "./schema";

const sources = [{ spec: pods101Spec, theory: pods101Theory }];

export const lessons: Lesson[] = sources.map(({ spec, theory }) => {
  const parsed = lessonSpecSchema.parse(parse(spec) as unknown);
  return { ...parsed, theoryMarkdown: theory };
});

for (const lesson of lessons) {
  if (lesson.theory !== `./${lesson.id}.md`) {
    throw new Error(`Lesson "${lesson.id}" must point theory at ./${lesson.id}.md`);
  }

  const labels = lesson.checks.map((check) => check.label);
  if (new Set(labels).size !== labels.length) {
    throw new Error(`Lesson "${lesson.id}" has duplicate check labels`);
  }
}

export const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

export type { Lesson, LessonCheck, LessonSpec } from "./schema";
export { lessonSpecSchema } from "./schema";
