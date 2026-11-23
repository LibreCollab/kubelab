import Dexie, { type Table } from "dexie";

import type { LessonProgress } from "./progress";

interface MetaRow {
  key: string;
  value: unknown;
}

class ProgressDatabase extends Dexie {
  lessons!: Table<LessonProgress, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("kubelab-progress");
    this.version(1).stores({
      lessons: "lessonId, status",
      meta: "key",
    });
  }
}

export const progressDb = new ProgressDatabase();
