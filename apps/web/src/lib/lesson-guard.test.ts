import { getLesson } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import { guardLessonCommand } from "./lesson-guard";

const checks = getLesson("pods-101")?.checks ?? [];

describe("lesson guard", () => {
  it("allows the expected run command", () => {
    expect(guardLessonCommand("kubectl run web --image=nginx --labels=app=web", checks).ok).toBe(
      true,
    );
  });

  it("allows extra labels", () => {
    const result = guardLessonCommand(
      "kubectl run web --image=nginx --labels=app=web,tier=frontend",
      checks,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong label", () => {
    const result = guardLessonCommand("kubectl run web --image=nginx --labels=app=kur", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("label app=web (got app=kur)");
    }
  });

  it("rejects a wrong image", () => {
    const result = guardLessonCommand("kubectl run web --image=httpd --labels=app=web", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("image nginx (got httpd)");
    }
  });

  it("rejects a wrong pod name", () => {
    const result = guardLessonCommand("kubectl run webb --image=nginx --labels=app=web", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('pod name "web" (got "webb")');
    }
  });

  it("does not guard non-run commands", () => {
    expect(guardLessonCommand("kubectl get pods", checks).ok).toBe(true);
  });
});
