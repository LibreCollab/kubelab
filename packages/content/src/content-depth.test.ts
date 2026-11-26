import { describe, expect, it } from "vitest";

import { lessons } from "./index";

describe("content depth", () => {
  const teachingLessons = lessons.filter((lesson) => lesson.unit !== "certification");

  it("has the expanded teaching set", () => {
    expect(teachingLessons.length).toBeGreaterThanOrEqual(54);
  });

  it("keeps every teaching lesson between 150 and 250 words", () => {
    for (const lesson of teachingLessons) {
      const words = lesson.theoryMarkdown.trim().split(/\s+/).length;
      expect(words, lesson.id).toBeGreaterThanOrEqual(150);
      expect(words, lesson.id).toBeLessThanOrEqual(250);
    }
  });
});
