import { describe, expect, it } from "vitest";
import { parse } from "yaml";

import pods101Spec from "../lessons/pods-101.yaml?raw";
import { certificationExams, certificationTracks, getLesson, lessons, units } from "./index";
import { lessonSpecSchema } from "./schema";

describe("content", () => {
  it("loads the sample lesson with theory", () => {
    const lesson = getLesson("pods-101");
    expect(lesson?.title).toBe("Your first Pod");
    expect(lesson?.theoryMarkdown).toContain("A Pod is the smallest deployable unit");
  });

  it("validates the raw YAML spec", () => {
    expect(() => lessonSpecSchema.parse(parse(pods101Spec) as unknown)).not.toThrow();
  });

  it("has unique lesson ids", () => {
    const ids = new Set(lessons.map((lesson) => lesson.id));
    expect(ids.size).toBe(lessons.length);
  });

  it("has unique check labels per lesson", () => {
    for (const lesson of lessons) {
      const labels = lesson.checks.map((check) => check.label);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("covers every core unit and certification track", () => {
    const coreUnits = units.filter((unit) => unit.number <= 12);
    expect(coreUnits.every((unit) => unit.lessons.length > 0)).toBe(true);
    expect(certificationTracks.every((track) => track.lessons.length > 0)).toBe(true);
    expect(lessons.length).toBeGreaterThanOrEqual(40);
    for (const lesson of lessons) {
      for (const prereq of lesson.prereqs) {
        expect(prereq).not.toBe(lesson.id);
        expect(lessons.some((candidate) => candidate.id === prereq)).toBe(true);
      }
    }
    for (const track of certificationTracks) {
      const exam = certificationExams.find((candidate) => candidate.id === track.id);
      expect(exam).toBeDefined();
      if (exam === undefined) {
        continue;
      }
      expect(exam.taskPool.length).toBeGreaterThan(exam.taskCount);
      expect(new Set(exam.taskPool.map((task) => task.id)).size).toBe(exam.taskPool.length);
      expect(exam.taskPool.every((task) => task.lessonId === "certification")).toBe(true);
    }
    expect(
      lessons
        .filter((lesson) => lesson.unit !== "certification")
        .every((lesson) => lesson.checks.some((check) => check.type !== "quiz")),
    ).toBe(true);
  });
});
