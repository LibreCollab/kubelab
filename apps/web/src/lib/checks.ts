import type { LessonCheck } from "@kubelab/content";
import { filterPods, type ParsedCommand, type Pod } from "@kubelab/sim";

export interface CheckContext {
  pods: Pod[];
  commands: readonly ParsedCommand[];
}

export interface CheckResult {
  label: string;
  pass: boolean;
}

export function evaluateCheck(check: LessonCheck, context: CheckContext): CheckResult {
  if (check.type === "pod") {
    const matches = filterPods(context.pods, {
      namespace: check.namespace,
      ...(check.name === undefined ? {} : { name: check.name }),
      ...(check.image === undefined ? {} : { image: check.image }),
      labels: check.labels,
      ...(check.phase === undefined ? {} : { phase: check.phase }),
    });

    return {
      label: check.label,
      pass: matches.length > 0,
    };
  }

  return {
    label: check.label,
    pass: context.commands.some((command) => matchesCommand(check, command)),
  };
}

export function evaluateChecks(checks: LessonCheck[], context: CheckContext): CheckResult[] {
  return checks.map((check) => evaluateCheck(check, context));
}

function matchesCommand(
  check: Extract<LessonCheck, { type: "command" }>,
  command: ParsedCommand,
): boolean {
  if (command.verb !== check.verb) {
    return false;
  }

  if ("namespace" in command && command.namespace !== check.namespace) {
    return false;
  }

  if (check.resource !== undefined) {
    if (!("resource" in command) || command.resource !== check.resource) {
      return false;
    }
  }

  if (check.name !== undefined) {
    if (!("name" in command) || command.name !== check.name) {
      return false;
    }
  }

  return true;
}
