import type { LessonCheck } from "@kubelab/content";
import {
  filterPods,
  type KubeDeployment,
  type KubeService,
  type ParsedCommand,
  type Pod,
} from "@kubelab/sim";

export interface CheckContext {
  pods: Pod[];
  commands: readonly ParsedCommand[];
  deployments?: KubeDeployment[];
  services?: KubeService[];
  answers?: Record<string, number>;
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

  if (check.type === "deployment") {
    const matches = (context.deployments ?? []).filter((deployment) => {
      if (
        deployment.metadata.namespace !== check.namespace ||
        deployment.metadata.name !== check.name
      ) {
        return false;
      }

      if (check.replicas !== undefined && deployment.spec.replicas !== check.replicas) {
        return false;
      }

      if (check.ready === true && deployment.status.readyReplicas < deployment.spec.replicas) {
        return false;
      }

      if (
        check.image !== undefined &&
        !deployment.spec.template.containers.some((container) => container.image === check.image)
      ) {
        return false;
      }

      return Object.entries(check.labels).every(
        ([key, value]) => deployment.metadata.labels[key] === value,
      );
    });

    return {
      label: check.label,
      pass: matches.length > 0,
    };
  }

  if (check.type === "service") {
    const matches = (context.services ?? []).filter((service) => {
      if (service.metadata.namespace !== check.namespace || service.metadata.name !== check.name) {
        return false;
      }

      if (check.serviceType !== undefined && service.spec.type !== check.serviceType) {
        return false;
      }

      return (
        check.port === undefined || service.spec.ports.some((port) => port.port === check.port)
      );
    });

    return {
      label: check.label,
      pass: matches.length > 0,
    };
  }

  if (check.type === "quiz") {
    return {
      label: check.label,
      pass: context.answers?.[check.id] === check.answer,
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

  if (check.action !== undefined) {
    if (!("action" in command) || command.action !== check.action) {
      return false;
    }
  }

  if (check.replicas !== undefined) {
    if (!("replicas" in command) || command.replicas !== check.replicas) {
      return false;
    }
  }

  if (check.image !== undefined) {
    if (!("image" in command) || command.image !== check.image) {
      return false;
    }
  }

  if (check.container !== undefined) {
    if (!("container" in command) || command.container !== check.container) {
      return false;
    }
  }

  return true;
}
