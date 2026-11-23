import type { LessonCheck } from "@kubelab/content";
import { filterPods, type Pod } from "@kubelab/sim";

export interface CheckResult {
  label: string;
  pass: boolean;
}

export function evaluateCheck(check: LessonCheck, pods: Pod[]): CheckResult {
  const matches = filterPods(pods, {
    namespace: check.namespace,
    ...(check.name === undefined ? {} : { name: check.name }),
    labels: check.labels,
    ...(check.phase === undefined ? {} : { phase: check.phase }),
  });

  return {
    label: check.label,
    pass: matches.length > 0,
  };
}

export function evaluateChecks(checks: LessonCheck[], pods: Pod[]): CheckResult[] {
  return checks.map((check) => evaluateCheck(check, pods));
}
