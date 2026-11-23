import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  completedCount,
  computeStreak,
  dateKey,
  type LessonProgress,
  type ProgressMap,
  totalXp,
} from "./progress";
import { progressDb } from "./progress-db";

interface ProgressContextValue {
  rows: ProgressMap;
  activityDates: string[];
  loading: boolean;
  xp: number;
  streak: number;
  completed: number;
  lastLessonId: string | undefined;
  startLesson: (lessonId: string) => Promise<void>;
  saveAnswers: (lessonId: string, answers: Record<string, number>) => Promise<void>;
  completeLesson: (lessonId: string, xp: number) => Promise<void>;
  reset: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

function readActivityDates(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function ProgressProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<ProgressMap>({});
  const [activityDates, setActivityDates] = useState<string[]>([]);
  const [lastLessonId, setLastLessonId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [lessonRows, activityMeta, lastMeta] = await Promise.all([
      progressDb.lessons.toArray(),
      progressDb.meta.get("activityDates"),
      progressDb.meta.get("lastLessonId"),
    ]);

    const nextRows: ProgressMap = {};
    for (const row of lessonRows) {
      nextRows[row.lessonId] = row;
    }

    setRows(nextRows);
    setActivityDates(readActivityDates(activityMeta?.value));
    setLastLessonId(typeof lastMeta?.value === "string" ? lastMeta.value : undefined);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startLesson = useCallback(
    async (lessonId: string) => {
      await progressDb.transaction("rw", progressDb.lessons, progressDb.meta, async () => {
        const existing = await progressDb.lessons.get(lessonId);
        if (existing?.status !== "completed") {
          const row: LessonProgress = {
            lessonId,
            status: "in_progress",
            answers: existing?.answers ?? {},
            xp: existing?.xp ?? 0,
            updatedAt: Date.now(),
          };
          await progressDb.lessons.put(row);
        }
        await progressDb.meta.put({ key: "lastLessonId", value: lessonId });
      });
      await refresh();
    },
    [refresh],
  );

  const saveAnswers = useCallback(
    async (lessonId: string, answers: Record<string, number>) => {
      await progressDb.transaction("rw", progressDb.lessons, async () => {
        const existing = await progressDb.lessons.get(lessonId);
        const row: LessonProgress = {
          lessonId,
          status: existing?.status ?? "in_progress",
          answers,
          xp: existing?.xp ?? 0,
          ...(existing?.completedAt === undefined ? {} : { completedAt: existing.completedAt }),
          updatedAt: Date.now(),
        };
        await progressDb.lessons.put(row);
      });
      await refresh();
    },
    [refresh],
  );

  const completeLesson = useCallback(
    async (lessonId: string, xp: number) => {
      await progressDb.transaction("rw", progressDb.lessons, progressDb.meta, async () => {
        const existing = await progressDb.lessons.get(lessonId);
        if (existing?.status === "completed") {
          return;
        }

        const now = Date.now();
        const row: LessonProgress = {
          lessonId,
          status: "completed",
          answers: existing?.answers ?? {},
          xp,
          completedAt: now,
          updatedAt: now,
        };
        await progressDb.lessons.put(row);

        const activityMeta = await progressDb.meta.get("activityDates");
        const dates = readActivityDates(activityMeta?.value);
        const today = dateKey();
        if (!dates.includes(today)) {
          dates.push(today);
        }

        await progressDb.meta.bulkPut([
          { key: "activityDates", value: dates },
          { key: "lastLessonId", value: lessonId },
        ]);
      });
      await refresh();
    },
    [refresh],
  );

  const reset = useCallback(async () => {
    await progressDb.transaction("rw", progressDb.lessons, progressDb.meta, async () => {
      await progressDb.lessons.clear();
      await progressDb.meta.clear();
    });
    await refresh();
  }, [refresh]);

  const value = useMemo<ProgressContextValue>(
    () => ({
      rows,
      activityDates,
      loading,
      xp: totalXp(rows),
      streak: computeStreak(activityDates),
      completed: completedCount(rows),
      lastLessonId,
      startLesson,
      saveAnswers,
      completeLesson,
      reset,
    }),
    [rows, activityDates, loading, lastLessonId, startLesson, saveAnswers, completeLesson, reset],
  );

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (context === null) {
    throw new Error("useProgress must be used inside ProgressProvider");
  }
  return context;
}
