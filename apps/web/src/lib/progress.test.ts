import { curriculumLessons } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import {
  buildLessonAccess,
  completedCount,
  computeStreak,
  currentLessonId,
  dateKey,
  type LessonProgress,
  nextLessonId,
  type ProgressMap,
  totalXp,
} from "./progress";

function row(lessonId: string, overrides: Partial<LessonProgress> = {}): LessonProgress {
  return {
    lessonId,
    status: "completed",
    answers: {},
    xp: 10,
    updatedAt: 0,
    ...overrides,
  };
}

describe("progress", () => {
  it("unlocks only the first lesson initially", () => {
    const access = buildLessonAccess(curriculumLessons, {});
    expect(access[curriculumLessons[0]?.id ?? ""]?.current).toBe(true);
    expect(access[curriculumLessons[1]?.id ?? ""]?.locked).toBe(true);
  });

  it("unlocks the next lesson after completion", () => {
    const first = curriculumLessons[0];
    const second = curriculumLessons[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) {
      return;
    }

    const progress: ProgressMap = { [first.id]: row(first.id) };
    const access = buildLessonAccess(curriculumLessons, progress);

    expect(access[first.id]?.completed).toBe(true);
    expect(access[second.id]?.current).toBe(true);
    expect(currentLessonId(curriculumLessons, progress)).toBe(second.id);
  });

  it("counts completed lessons and XP", () => {
    const progress: ProgressMap = {
      a: row("a", { xp: 20 }),
      b: row("b", { status: "in_progress", xp: 0 }),
    };

    expect(completedCount(progress)).toBe(1);
    expect(totalXp(progress)).toBe(20);
  });

  it("computes a streak ending today or yesterday", () => {
    const today = new Date(2026, 10, 23);
    expect(computeStreak(["2026-11-23", "2026-11-22", "2026-11-21"], today)).toBe(3);
    expect(computeStreak(["2026-11-22", "2026-11-21"], today)).toBe(2);
    expect(computeStreak(["2026-11-20"], today)).toBe(0);
    expect(computeStreak([], today)).toBe(0);
  });

  it("uses local date keys", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("finds the next lesson in curriculum order", () => {
    const first = curriculumLessons[0];
    const second = curriculumLessons[1];
    expect(first && second).toBeTruthy();
    if (!first || !second) {
      return;
    }
    expect(nextLessonId(first.id, curriculumLessons)).toBe(second.id);
    expect(nextLessonId(curriculumLessons.at(-1)?.id ?? "", curriculumLessons)).toBeUndefined();
  });
});
