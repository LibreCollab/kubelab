import Dexie, { type Table } from "dexie";

import type { ExamAttempt, ReviewCard } from "./certification";
import type { LessonProgress } from "./progress";

interface MetaRow {
  key: string;
  value: unknown;
}

class ProgressDatabase extends Dexie {
  lessons!: Table<LessonProgress, string>;
  meta!: Table<MetaRow, string>;
  examAttempts!: Table<ExamAttempt, number>;
  reviewCards!: Table<ReviewCard, string>;

  constructor() {
    super("kubelab-progress");
    this.version(1).stores({
      lessons: "lessonId, status",
      meta: "key",
    });
    this.version(2).stores({
      lessons: "lessonId, status",
      meta: "key",
      examAttempts: "++id, trackId, completedAt",
      reviewCards: "id, trackId, dueAt",
    });
  }
}

export const progressDb = new ProgressDatabase();
