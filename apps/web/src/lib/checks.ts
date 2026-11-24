import type { LessonCheck } from "@kubelab/content";
import {
  filterPods,
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type ParsedCommand,
  type Pod,
  resolveServiceDns,
} from "@kubelab/sim";

export interface CheckContext {
  pods: Pod[];
  commands: readonly ParsedCommand[];
  deployments?: KubeDeployment[];
  services?: KubeService[];
  ingresses?: KubeIngress[];
  configMaps?: KubeConfigMap[];
  secrets?: KubeSecret[];
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

  if (check.type === "configmap") {
    const matches = (context.configMaps ?? []).filter(
      (configMap) =>
        configMap.metadata.namespace === check.namespace &&
        configMap.metadata.name === check.name &&
        Object.entries(check.data).every(([key, value]) => configMap.data[key] === value),
    );
    return { label: check.label, pass: matches.length > 0 };
  }

  if (check.type === "secret") {
    const matches = (context.secrets ?? []).filter(
      (secret) =>
        secret.metadata.namespace === check.namespace &&
        secret.metadata.name === check.name &&
        check.keys.every((key) => secret.data[key] !== undefined),
    );
    return { label: check.label, pass: matches.length > 0 };
  }

  if (check.type === "env") {
    const deployment = (context.deployments ?? []).find(
      (candidate) =>
        candidate.metadata.namespace === check.namespace &&
        candidate.metadata.name === check.deployment,
    );
    const matches = deployment?.spec.template.containers.some(
      (container) =>
        (container.env ?? []).some(
          (variable) => variable.name === check.name && variable.value === check.value,
        ) &&
        (check.sourceKind === undefined ||
          (container.envFrom ?? []).some(
            (source) =>
              source.kind === check.sourceKind &&
              (check.sourceName === undefined || source.name === check.sourceName),
          )),
    );
    return { label: check.label, pass: matches === true };
  }

  if (check.type === "dns") {
    const service = (context.services ?? []).find(
      (candidate) =>
        candidate.metadata.namespace === check.namespace && candidate.metadata.name === check.name,
    );
    const resolved = context.commands.some((command) => {
      if (
        command.verb !== "exec" ||
        command.namespace !== check.namespace ||
        (check.pod !== undefined && command.name !== check.pod)
      ) {
        return false;
      }
      if (command.command !== "nslookup" && command.command !== "getent") {
        return false;
      }
      let query: string | undefined;
      if (command.command === "getent") {
        if (command.args[0] !== "hosts" || command.args.length !== 2) {
          return false;
        }
        query = command.args[1];
      } else {
        if (command.args.length !== 1) {
          return false;
        }
        query = command.args[0];
      }
      if (query === undefined) {
        return false;
      }
      const target = resolveServiceDns(query, command.namespace);
      return target?.name === check.name && target.namespace === check.namespace;
    });

    return { label: check.label, pass: service !== undefined && resolved };
  }

  if (check.type === "ingress") {
    const matches = (context.ingresses ?? []).filter((ingress) => {
      if (ingress.metadata.namespace !== check.namespace || ingress.metadata.name !== check.name) {
        return false;
      }

      return ingress.spec.rules.some(
        (rule) =>
          (check.host === undefined || rule.host === check.host) &&
          (check.path === undefined || rule.path === check.path) &&
          (check.serviceName === undefined || rule.serviceName === check.serviceName) &&
          (check.servicePort === undefined || rule.servicePort === check.servicePort),
      );
    });

    return { label: check.label, pass: matches.length > 0 };
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

  if (check.command !== undefined) {
    if (!("command" in command) || command.command !== check.command) {
      return false;
    }
  }

  if (check.path !== undefined) {
    if (!("path" in command) || command.path !== check.path) {
      return false;
    }
  }

  if (check.file !== undefined) {
    if (!("file" in command) || command.file !== check.file) {
      return false;
    }
  }

  if (check.subjectVerb !== undefined) {
    if (!("subjectVerb" in command) || command.subjectVerb !== check.subjectVerb) {
      return false;
    }
  }

  if (check.subjectResource !== undefined) {
    if (!("subjectResource" in command) || command.subjectResource !== check.subjectResource) {
      return false;
    }
  }

  if (check.as !== undefined) {
    if (!("as" in command) || command.as !== check.as) {
      return false;
    }
  }

  return true;
}
