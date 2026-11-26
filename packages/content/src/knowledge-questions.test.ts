import { describe, expect, it } from "vitest";

import {
  certificationDomains,
  certificationExams,
  examQuestionsForRun,
  lessonsById,
} from "./index";
import { knowledgeByTrack } from "./knowledge-questions";

describe("knowledge question banks", () => {
  for (const track of ["kcna", "kcsa"] as const) {
    const bank = knowledgeByTrack[track];

    it(`${track} has 100 validated questions`, () => {
      expect(bank).toHaveLength(100);
      expect(new Set(bank.map((question) => question.id)).size).toBe(100);
      expect(new Set(bank.map((question) => question.prompt)).size).toBe(100);

      for (const question of bank) {
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options).size).toBe(4);
        expect(question.answer).toBeGreaterThanOrEqual(0);
        expect(question.answer).toBeLessThan(4);
        expect(question.explanation.length).toBeGreaterThan(20);
        expect(lessonsById.has(question.lessonId)).toBe(true);
      }
    });

    it(`${track} matches domain quotas and answer balance`, () => {
      const domains = certificationDomains.filter((domain) => domain.trackId === track);
      for (const domain of domains) {
        expect(
          bank.filter((question) => question.domainId === domain.id),
          domain.id,
        ).toHaveLength(domain.weight);
      }

      const answers = [0, 1, 2, 3].map(
        (answer) => bank.filter((question) => question.answer === answer).length,
      );
      expect(Math.max(...answers) - Math.min(...answers)).toBeLessThanOrEqual(4);
    });

    it(`${track} exam draws 60 questions with weighted domains`, () => {
      const exam = certificationExams.find((candidate) => candidate.id === track);
      expect(exam).toBeDefined();
      if (exam === undefined) {
        return;
      }

      expect(exam.questionPool).toHaveLength(100);
      expect(exam.questions).toHaveLength(60);
      expect(exam.questions.every((question) => question.explanation !== undefined)).toBe(true);
      expect(new Set(exam.questions.map((question) => question.id)).size).toBe(60);
      const domainCounts = certificationDomains
        .filter((domain) => domain.trackId === track)
        .map((domain) => ({
          domain,
          count: exam.questions.filter((question) => question.domainId === domain.id).length,
        }));
      for (const { domain, count } of domainCounts) {
        expect(Math.abs(count - (domain.weight / 100) * 60), domain.id).toBeLessThanOrEqual(1);
      }
      const answers = [0, 1, 2, 3].map(
        (answer) => exam.questions.filter((question) => question.answer === answer).length,
      );
      expect(Math.max(...answers) - Math.min(...answers)).toBeLessThanOrEqual(6);
    });

    it(`${track} rotates questions between runs`, () => {
      const exam = certificationExams.find((candidate) => candidate.id === track);
      expect(exam).toBeDefined();
      if (exam === undefined) {
        return;
      }

      const first = examQuestionsForRun(exam, 0);
      const second = examQuestionsForRun(exam, 1);
      expect(first).toHaveLength(60);
      expect(second).toHaveLength(60);
      expect(first.map((question) => question.id)).not.toEqual(
        second.map((question) => question.id),
      );
      for (const questions of [first, second]) {
        const domainCounts = certificationDomains
          .filter((domain) => domain.trackId === track)
          .map((domain) => questions.filter((question) => question.domainId === domain.id).length);
        expect(domainCounts.reduce((sum, count) => sum + count, 0)).toBe(60);
        const answers = [0, 1, 2, 3].map(
          (answer) => questions.filter((question) => question.answer === answer).length,
        );
        expect(Math.max(...answers) - Math.min(...answers)).toBeLessThanOrEqual(6);
      }
    });
  }
});
