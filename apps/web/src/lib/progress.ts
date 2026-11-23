import type { Lesson } from "@kubelab/content";

export type LessonStatus = "in_progress" | "completed";

export interface LessonProgress {
  lessonId: string;
  status: LessonStatus;
  answers: Record<string, number>;
  xp: number;
  completedAt?: number;
  updatedAt: number;
}

export type ProgressMap = Record<string, LessonProgress>;

export interface LessonAccess {
  completed: boolean;
  current: boolean;
  locked: boolean;
  unlocked: boolean;
}

export function buildLessonAccess(
  lessons: Lesson[],
  progress: ProgressMap,
): Record<string, LessonAccess> {
  const access: Record<string, LessonAccess> = {};
  let currentAssigned = false;

  lessons.forEach((lesson, index) => {
    const completed = progress[lesson.id]?.status === "completed";
    const previous = index > 0 ? lessons[index - 1] : undefined;
    const previousCompleted =
      previous === undefined || progress[previous.id]?.status === "completed";
    const prereqsCompleted =
      lesson.prereqs.length > 0 &&
      lesson.prereqs.every((id) => progress[id]?.status === "completed");
    const unlocked = completed || previousCompleted || prereqsCompleted;
    const current = !completed && unlocked && !currentAssigned;

    if (current) {
      currentAssigned = true;
    }

    access[lesson.id] = {
      completed,
      current,
      unlocked,
      locked: !completed && !unlocked,
    };
  });

  return access;
}

export function completedCount(progress: ProgressMap): number {
  return Object.values(progress).filter((row) => row.status === "completed").length;
}

export function totalXp(progress: ProgressMap): number {
  return Object.values(progress)
    .filter((row) => row.status === "completed")
    .reduce((sum, row) => sum + row.xp, 0);
}

export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function computeStreak(activityDates: string[], today = new Date()): number {
  const dates = new Set(activityDates);
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (!dates.has(dateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!dates.has(dateKey(cursor))) {
      return 0;
    }
  }

  let streak = 0;
  while (dates.has(dateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export function currentLessonId(lessons: Lesson[], progress: ProgressMap): string | undefined {
  const access = buildLessonAccess(lessons, progress);
  return lessons.find((lesson) => access[lesson.id]?.current)?.id;
}

export function nextLessonId(lessonId: string, lessons: Lesson[]): string | undefined {
  const index = lessons.findIndex((lesson) => lesson.id === lessonId);
  return index === -1 ? undefined : lessons[index + 1]?.id;
}
