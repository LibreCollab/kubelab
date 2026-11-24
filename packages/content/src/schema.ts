import { z } from "zod";

export const podCheckSchema = z.object({
  type: z.literal("pod"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1).optional(),
  image: z.string().min(1).optional(),
  labels: z.record(z.string(), z.string()).default({}),
  phase: z.enum(["Pending", "Running", "Succeeded", "Failed"]).optional(),
});

export const commandCheckSchema = z.object({
  type: z.literal("command"),
  label: z.string().min(1),
  verb: z.enum([
    "get",
    "run",
    "delete",
    "describe",
    "create",
    "expose",
    "scale",
    "set",
    "rollout",
    "exec",
    "logs",
    "auth",
    "helm",
    "argocd",
    "kustomize",
    "apply",
  ]),
  resource: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  namespace: z.string().min(1).default("default"),
  action: z
    .enum(["status", "undo", "list", "history", "get", "install", "upgrade", "rollback", "sync"])
    .optional(),
  replicas: z.number().int().nonnegative().optional(),
  image: z.string().min(1).optional(),
  container: z.string().min(1).optional(),
  command: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  file: z.string().min(1).optional(),
  subjectVerb: z.string().min(1).optional(),
  subjectResource: z.string().min(1).optional(),
  as: z.string().min(1).optional(),
});

export const deploymentCheckSchema = z.object({
  type: z.literal("deployment"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  replicas: z.number().int().nonnegative().optional(),
  image: z.string().min(1).optional(),
  ready: z.literal(true).optional(),
  labels: z.record(z.string(), z.string()).default({}),
});

export const configMapCheckSchema = z.object({
  type: z.literal("configmap"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  data: z.record(z.string(), z.string()).default({}),
});

export const secretCheckSchema = z.object({
  type: z.literal("secret"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  keys: z.array(z.string().min(1)).default([]),
});

export const envCheckSchema = z.object({
  type: z.literal("env"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  deployment: z.string().min(1),
  name: z.string().min(1),
  value: z.string(),
  sourceKind: z.enum(["ConfigMap", "Secret"]).optional(),
  sourceName: z.string().min(1).optional(),
});

export const dnsCheckSchema = z.object({
  type: z.literal("dns"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  pod: z.string().min(1).optional(),
});

export const ingressCheckSchema = z.object({
  type: z.literal("ingress"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  host: z.string().min(1).optional(),
  path: z.string().min(1).optional(),
  file: z.string().min(1).optional(),
  serviceName: z.string().min(1).optional(),
  servicePort: z.number().int().positive().optional(),
});

export const serviceCheckSchema = z.object({
  type: z.literal("service"),
  label: z.string().min(1),
  namespace: z.string().min(1).default("default"),
  name: z.string().min(1),
  serviceType: z.enum(["ClusterIP", "NodePort", "LoadBalancer"]).optional(),
  port: z.number().int().positive().optional(),
});

export const quizCheckSchema = z
  .object({
    type: z.literal("quiz"),
    id: z.string().min(1),
    label: z.string().min(1),
    question: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.number().int().nonnegative(),
  })
  .refine((check) => check.answer < check.options.length, {
    message: "answer index is out of range",
    path: ["answer"],
  })
  .refine((check) => new Set(check.options).size === check.options.length, {
    message: "quiz options must be unique",
    path: ["options"],
  });

export const checkSchema = z.discriminatedUnion("type", [
  podCheckSchema,
  commandCheckSchema,
  deploymentCheckSchema,
  serviceCheckSchema,
  configMapCheckSchema,
  secretCheckSchema,
  envCheckSchema,
  dnsCheckSchema,
  ingressCheckSchema,
  quizCheckSchema,
]);

const scenarioObjectSchema = z
  .object({
    apiVersion: z.string().optional(),
    kind: z.enum([
      "Application",
      "ConfigMap",
      "Deployment",
      "Event",
      "HelmRelease",
      "HorizontalPodAutoscaler",
      "Ingress",
      "Namespace",
      "NetworkPolicy",
      "PersistentVolume",
      "PersistentVolumeClaim",
      "Pod",
      "Role",
      "RoleBinding",
      "Secret",
      "Service",
      "ServiceAccount",
      "StorageClass",
      "Widget",
    ]),
    metadata: z
      .object({
        name: z.string().min(1),
        namespace: z.string().optional(),
        labels: z.record(z.string(), z.string()).optional(),
      })
      .passthrough(),
  })
  .passthrough()
  .superRefine((object, context) => {
    if (object.kind === "Pod") {
      const spec = object.spec;
      const status = object.status;
      if (
        typeof spec !== "object" ||
        spec === null ||
        !Array.isArray((spec as Record<string, unknown>).containers)
      ) {
        context.addIssue({
          code: "custom",
          message: "Pod scenario objects require spec.containers",
        });
      }
      if (
        typeof status !== "object" ||
        status === null ||
        typeof (status as Record<string, unknown>).phase !== "string"
      ) {
        context.addIssue({ code: "custom", message: "Pod scenario objects require status.phase" });
      }
    }

    if (object.kind === "Namespace") {
      const status = object.status;
      if (
        typeof status !== "object" ||
        status === null ||
        typeof (status as Record<string, unknown>).phase !== "string"
      ) {
        context.addIssue({
          code: "custom",
          message: "Namespace scenario objects require status.phase",
        });
      }
    }
  });

export const lessonSpecSchema = z.object({
  id: z.string().min(1),
  unit: z.string().min(1),
  title: z.string().min(1),
  xp: z.number().int().positive(),
  order: z.number().int().nonnegative().default(0),
  strict: z.boolean().default(true),
  prereqs: z.array(z.string()).default([]),
  theory: z.string().min(1),
  scenario: z.object({
    nodes: z
      .array(
        z.object({
          name: z.string().min(1),
          cpu: z.string().optional(),
          memory: z.string().optional(),
          labels: z.record(z.string(), z.string()).optional(),
          taints: z
            .array(
              z.object({
                key: z.string().min(1),
                value: z.string().optional(),
                effect: z.string().min(1),
              }),
            )
            .optional(),
        }),
      )
      .min(1),
    objects: z.array(scenarioObjectSchema).default([]),
    files: z.record(z.string(), z.string()).default({}),
  }),
  objectives: z.array(z.string().min(1)).min(1),
  checks: z.array(checkSchema).min(1),
  hints: z.array(z.string()).default([]),
  solution: z.string().min(1),
});

export type LessonSpec = z.infer<typeof lessonSpecSchema>;
export type LessonCheck = z.infer<typeof checkSchema>;

export interface Lesson extends LessonSpec {
  theoryMarkdown: string;
}
