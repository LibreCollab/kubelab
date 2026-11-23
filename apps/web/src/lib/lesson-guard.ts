import type { LessonCheck } from "@kubelab/content";
import { parseKubectl } from "@kubelab/sim";

export type LessonGuardResult = { ok: true } | { ok: false; error: string };

/**
 * Guided lessons can validate a `kubectl run` against the lesson's pod checks
 * before mutating the simulated cluster. This keeps a valid-but-wrong command
 * from looking like success while still teaching real kubectl syntax.
 */
export function guardLessonCommand(input: string, checks: LessonCheck[]): LessonGuardResult {
  const parsed = parseKubectl(input);

  if ("error" in parsed || parsed.verb !== "run") {
    return { ok: true };
  }

  const podChecks = checks.filter((check) => check.type === "pod");
  if (podChecks.length === 0) {
    return { ok: true };
  }

  const applicable = podChecks.filter(
    (check) => check.name === undefined || check.name === parsed.name,
  );

  if (applicable.length === 0) {
    const names = [...new Set(podChecks.flatMap((check) => (check.name ? [check.name] : [])))];
    return {
      ok: false,
      error: `error: this lesson expects pod name ${names.map((name) => `"${name}"`).join(" or ")} (got "${parsed.name}")`,
    };
  }

  const labels: Record<string, string> = { run: parsed.name, ...parsed.labels };
  const problems = new Set<string>();

  for (const check of applicable) {
    if (check.namespace !== parsed.namespace) {
      problems.add(`namespace ${check.namespace} (got ${parsed.namespace})`);
      continue;
    }

    for (const [key, value] of Object.entries(check.labels)) {
      const actual = labels[key];
      if (actual !== value) {
        problems.add(
          `label ${key}=${value} (got ${actual === undefined ? "missing" : `${key}=${actual}`})`,
        );
      }
    }

    if (check.image !== undefined && check.image !== parsed.image) {
      problems.add(`image ${check.image} (got ${parsed.image})`);
    }
  }

  if (problems.size > 0) {
    return {
      ok: false,
      error: `error: lesson requirements not met: ${[...problems].join("; ")}`,
    };
  }

  return { ok: true };
}
