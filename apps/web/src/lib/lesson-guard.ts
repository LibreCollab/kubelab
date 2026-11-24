import type { LessonCheck } from "@kubelab/content";
import { parseKubectl } from "@kubelab/sim";

export type LessonGuardResult = { ok: true } | { ok: false; error: string };

/**
 * Guided lessons validate `kubectl run` and workload commands against the
 * lesson's checks before mutating the simulated cluster. This keeps a
 * valid-but-wrong target, namespace, or Service shape from looking like success
 * while still teaching real kubectl syntax.
 */
export function guardLessonCommand(input: string, checks: LessonCheck[]): LessonGuardResult {
  const parsed = parseKubectl(input);

  if (
    "error" in parsed ||
    parsed.verb === "help" ||
    parsed.verb === "get" ||
    parsed.verb === "exec" ||
    parsed.verb === "logs" ||
    parsed.verb === "auth" ||
    parsed.verb === "helm" ||
    parsed.verb === "argocd" ||
    parsed.verb === "kustomize" ||
    parsed.verb === "apply"
  ) {
    return { ok: true };
  }

  if (parsed.verb !== "run") {
    if (parsed.verb === "create" && parsed.resource === "ingresses") {
      const ingressChecks = checks.filter(
        (check): check is Extract<LessonCheck, { type: "ingress" }> =>
          check.type === "ingress" && check.name === parsed.name,
      );

      if (ingressChecks.length > 0) {
        const namespaceMatches = ingressChecks.filter(
          (check) => check.namespace === parsed.namespace,
        );
        if (namespaceMatches.length === 0) {
          const namespaces = [...new Set(ingressChecks.map((check) => check.namespace))];
          return {
            ok: false,
            error: `error: this lesson expects namespace ${namespaces.map((namespace) => `"${namespace}"`).join(" or ")} (got "${parsed.namespace}")`,
          };
        }

        const ingress = namespaceMatches[0];
        if (ingress === undefined) {
          return { ok: true };
        }
        if (ingress.host !== undefined && ingress.host !== parsed.rule.host) {
          return {
            ok: false,
            error: `error: this lesson expects host ${ingress.host} (got ${parsed.rule.host})`,
          };
        }
        if (ingress.path !== undefined && ingress.path !== parsed.rule.path) {
          return {
            ok: false,
            error: `error: this lesson expects path ${ingress.path} (got ${parsed.rule.path})`,
          };
        }
        if (ingress.serviceName !== undefined && ingress.serviceName !== parsed.rule.serviceName) {
          return {
            ok: false,
            error: `error: this lesson expects Service ${ingress.serviceName} (got ${parsed.rule.serviceName})`,
          };
        }
        if (ingress.servicePort !== undefined && ingress.servicePort !== parsed.rule.servicePort) {
          return {
            ok: false,
            error: `error: this lesson expects Service port ${ingress.servicePort} (got ${parsed.rule.servicePort})`,
          };
        }
      }
    }

    const expected = checks.filter(
      (check): check is Extract<LessonCheck, { type: "command" }> =>
        check.type === "command" &&
        check.verb === parsed.verb &&
        check.resource === parsed.resource &&
        check.name !== undefined,
    );

    if (expected.length > 0) {
      const nameMatches = expected.filter((check) => check.name === parsed.name);
      if (nameMatches.length === 0) {
        const names = [...new Set(expected.flatMap((check) => (check.name ? [check.name] : [])))];
        return {
          ok: false,
          error: `error: this lesson expects ${parsed.resource} ${names.map((name) => `"${name}"`).join(" or ")} (got "${parsed.name}")`,
        };
      }

      if (!nameMatches.some((check) => check.namespace === parsed.namespace)) {
        const namespaces = [...new Set(nameMatches.map((check) => check.namespace))];
        return {
          ok: false,
          error: `error: this lesson expects namespace ${namespaces.map((namespace) => `"${namespace}"`).join(" or ")} (got "${parsed.namespace}")`,
        };
      }

      const deploymentChecks = checks.filter(
        (check): check is Extract<LessonCheck, { type: "deployment" }> =>
          check.type === "deployment" &&
          check.name === parsed.name &&
          check.namespace === parsed.namespace,
      );

      if (parsed.verb === "scale" && deploymentChecks.length > 0) {
        const replicas = [
          ...new Set(
            deploymentChecks.flatMap((check) =>
              check.replicas === undefined ? [] : [check.replicas],
            ),
          ),
        ];
        if (replicas.length > 0 && !replicas.includes(parsed.replicas)) {
          return {
            ok: false,
            error: `error: this lesson expects ${replicas.join(" or ")} replicas (got ${parsed.replicas})`,
          };
        }
      }

      if (parsed.verb === "set" && parsed.action === "image" && deploymentChecks.length > 0) {
        const images = [
          ...new Set(
            deploymentChecks.flatMap((check) => (check.image === undefined ? [] : [check.image])),
          ),
        ];
        if (images.length > 0 && !images.includes(parsed.image)) {
          return {
            ok: false,
            error: `error: this lesson expects image ${images.join(" or ")} (got ${parsed.image})`,
          };
        }
      }

      if (parsed.verb === "expose") {
        const serviceChecks = checks.filter(
          (check): check is Extract<LessonCheck, { type: "service" }> =>
            check.type === "service" && check.namespace === parsed.namespace,
        );

        if (serviceChecks.length > 0) {
          const service = serviceChecks.find((check) => check.name === parsed.serviceName);
          if (service === undefined) {
            const names = serviceChecks.map((check) => `"${check.name}"`);
            return {
              ok: false,
              error: `error: this lesson expects service ${names.join(" or ")} (got "${parsed.serviceName}")`,
            };
          }
          if (service.serviceType !== undefined && service.serviceType !== parsed.serviceType) {
            return {
              ok: false,
              error: `error: this lesson expects service type ${service.serviceType} (got ${parsed.serviceType})`,
            };
          }
          if (service.port !== undefined && service.port !== parsed.port) {
            return {
              ok: false,
              error: `error: this lesson expects service port ${service.port} (got ${parsed.port})`,
            };
          }
        }
      }
    }

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
