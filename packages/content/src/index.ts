import { parse } from "yaml";

import {
  type CertificationTrackDefinition,
  certificationTrackDefinitions,
  type UnitDefinition,
  unitDefinitions,
} from "./curriculum";
import { type Lesson, type LessonCheck, type LessonSpec, lessonSpecSchema } from "./schema";

interface Unit extends UnitDefinition {
  lessons: Lesson[];
}

interface CertificationTrack extends CertificationTrackDefinition {
  lessons: Lesson[];
}

const specSources = import.meta.glob("../lessons/*.yaml", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const theorySources = import.meta.glob("../lessons/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function fileId(path: string, extension: string): string {
  const name = path.split("/").pop() ?? path;
  return name.slice(0, -extension.length);
}

const theoryById = new Map(
  Object.entries(theorySources).map(([path, markdown]) => [fileId(path, ".md"), markdown]),
);

export const lessons: Lesson[] = Object.entries(specSources)
  .map(([path, spec]) => {
    const parsed = lessonSpecSchema.parse(parse(spec) as unknown);
    const id = fileId(path, ".yaml");

    if (parsed.id !== id) {
      throw new Error(`Lesson file ${path} must match its id "${parsed.id}"`);
    }
    if (parsed.theory !== `./${parsed.id}.md`) {
      throw new Error(`Lesson "${parsed.id}" must point theory at ./${parsed.id}.md`);
    }

    const theoryMarkdown = theoryById.get(parsed.id);
    if (theoryMarkdown === undefined) {
      throw new Error(`Lesson "${parsed.id}" is missing ./${parsed.id}.md`);
    }

    return { ...parsed, theoryMarkdown };
  })
  .sort((left, right) => left.id.localeCompare(right.id));

const unitById = new Map(unitDefinitions.map((unit) => [unit.id, unit]));

for (const lesson of lessons) {
  if (!unitById.has(lesson.unit)) {
    throw new Error(`Lesson "${lesson.id}" references unknown unit "${lesson.unit}"`);
  }

  const labels = lesson.checks.map((check) => check.label);
  if (new Set(labels).size !== labels.length) {
    throw new Error(`Lesson "${lesson.id}" has duplicate check labels`);
  }

  const quizIds = lesson.checks.flatMap((check) => (check.type === "quiz" ? [check.id] : []));
  if (new Set(quizIds).size !== quizIds.length) {
    throw new Error(`Lesson "${lesson.id}" has duplicate quiz ids`);
  }
}

export const lessonsById = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export function getLesson(id: string): Lesson | undefined {
  return lessonsById.get(id);
}

export const units: Unit[] = unitDefinitions.map((unit) => ({
  ...unit,
  lessons: lessons
    .filter((lesson) => lesson.unit === unit.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id)),
}));

export const curriculumLessons: Lesson[] = units.flatMap((unit) => unit.lessons);

export const certificationTracks: CertificationTrack[] = certificationTrackDefinitions.map(
  (track) => ({
    ...track,
    lessons: track.lessonIds.flatMap((id) => {
      const lesson = lessonsById.get(id);
      if (lesson === undefined) {
        throw new Error(`Certification track "${track.id}" references unknown lesson "${id}"`);
      }
      return [lesson];
    }),
  }),
);

export interface ExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  answer: number;
  lessonId: string;
  lessonTitle: string;
  unit: string;
  label: string;
}

export interface ExamTask {
  id: string;
  title: string;
  instruction: string;
  lessonId: string;
  unit: string;
  scenario: LessonSpec["scenario"];
  checks: LessonCheck[];
}

export interface CertificationExam {
  id: string;
  name: string;
  description: string;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
  labs: Array<{ lessonId: string; lessonTitle: string }>;
  taskCount: number;
  taskPool: ExamTask[];
  tasks: ExamTask[];
}

const examUnits: Record<string, string[]> = {
  kcna: [
    "containers",
    "architecture",
    "workloads",
    "services",
    "config",
    "storage",
    "scheduling",
    "networking",
    "security",
    "observability",
  ],
  kcsa: ["architecture", "services", "config", "networking", "security", "observability"],
  cka: [
    "architecture",
    "workloads",
    "services",
    "config",
    "storage",
    "scheduling",
    "networking",
    "observability",
  ],
  ckad: ["workloads", "services", "config", "storage", "scheduling", "observability"],
  cks: ["config", "services", "networking", "security", "observability"],
};

const extraExamQuestions: ExamQuestion[] = [
  {
    id: "cert:container-image",
    prompt: "Which field identifies the container image a Pod should run?",
    options: ["spec.containers[].image", "spec.image", "metadata.image", "status.image"],
    answer: 0,
    lessonId: "containers-101",
    lessonTitle: "Containers",
    unit: "containers",
    label: "Container image",
  },
  {
    id: "cert:kubelet",
    prompt: "Which node component watches for assigned Pods and starts their containers?",
    options: ["kube-apiserver", "kube-scheduler", "kubelet", "kube-proxy"],
    answer: 2,
    lessonId: "control-plane-101",
    lessonTitle: "The control plane",
    unit: "architecture",
    label: "Node components",
  },
  {
    id: "cert:deployment-revision",
    prompt: "What does kubectl rollout undo deployment/web do?",
    options: [
      "Deletes the Deployment",
      "Restores the previous ReplicaSet template",
      "Scales the Deployment to zero",
      "Edits the container image in place",
    ],
    answer: 1,
    lessonId: "deployments-101",
    lessonTitle: "Deployments and rollouts",
    unit: "workloads",
    label: "Rollbacks",
  },
  {
    id: "cert:service-dns",
    prompt: "A Pod in namespace team-a queries api. What Service name does that resolve to?",
    options: ["api", "api.team-a", "api.team-a.svc", "api.team-a.svc.cluster.local"],
    answer: 1,
    lessonId: "dns-101",
    lessonTitle: "Service discovery and DNS",
    unit: "services",
    label: "DNS search paths",
  },
  {
    id: "cert:configmap-envfrom",
    prompt: "Which Deployment field imports all keys from a ConfigMap as environment variables?",
    options: ["env", "envFrom", "valueFrom", "volumes"],
    answer: 1,
    lessonId: "configmaps-101",
    lessonTitle: "ConfigMaps",
    unit: "config",
    label: "Environment injection",
  },
  {
    id: "cert:secret-encoding",
    prompt: "How are Secret values stored in the data field?",
    options: ["Plain text", "Base64-encoded", "Encrypted with TLS", "Hashed with SHA-256"],
    answer: 1,
    lessonId: "secrets-101",
    lessonTitle: "Secrets",
    unit: "config",
    label: "Secret encoding",
  },
  {
    id: "cert:pvc-binding",
    prompt: "A PVC remains Pending. Which condition prevents binding?",
    options: [
      "The PVC requests more storage than any available PV",
      "The PVC has a selector",
      "The Pod is Running",
      "The StorageClass has a provisioner",
    ],
    answer: 0,
    lessonId: "persistent-volumes-101",
    lessonTitle: "PersistentVolumes",
    unit: "storage",
    label: "Volume binding",
  },
  {
    id: "cert:taint-toleration",
    prompt: "A node has taint dedicated=db:NoSchedule. What must a Pod have to schedule there?",
    options: ["nodeName", "A matching toleration", "A matching label", "hostNetwork: true"],
    answer: 1,
    lessonId: "scheduling-101",
    lessonTitle: "Scheduling and placement",
    unit: "scheduling",
    label: "Taints and tolerations",
  },
  {
    id: "cert:networkpolicy-deny",
    prompt:
      "A NetworkPolicy selects a Pod with policyTypes: [Ingress] and no ingress rules. What happens?",
    options: [
      "All ingress is allowed",
      "All ingress is denied",
      "Only same-namespace traffic is allowed",
      "The policy is ignored",
    ],
    answer: 1,
    lessonId: "network-policy-101",
    lessonTitle: "NetworkPolicy",
    unit: "networking",
    label: "Default deny",
  },
  {
    id: "cert:rolebinding",
    prompt: "Which object grants a Role's permissions to a subject?",
    options: ["Role", "RoleBinding", "ServiceAccount", "ClusterRole"],
    answer: 1,
    lessonId: "rbac-101",
    lessonTitle: "RBAC",
    unit: "security",
    label: "Role bindings",
  },
  {
    id: "cert:readiness",
    prompt: "What does a readinessProbe control?",
    options: [
      "Whether the container restarts",
      "Whether the Pod receives Service traffic",
      "Whether the Pod is scheduled",
      "Whether the image is pulled",
    ],
    answer: 1,
    lessonId: "observability-101",
    lessonTitle: "Logs, events, and readiness",
    unit: "observability",
    label: "Readiness probes",
  },
  {
    id: "cert:rollout-status",
    prompt: "Which command waits for a Deployment rollout to finish?",
    options: [
      "kubectl rollout status deployment/web",
      "kubectl get deployment web -w",
      "kubectl describe deployment web",
      "kubectl scale deployment/web --replicas=1",
    ],
    answer: 0,
    lessonId: "deployments-101",
    lessonTitle: "Deployments and rollouts",
    unit: "workloads",
    label: "Rollout status",
  },
];

const examPool = lessons
  .filter((lesson) => lesson.unit !== "certification")
  .flatMap((lesson) =>
    lesson.checks.flatMap((check) =>
      check.type === "quiz"
        ? [
            {
              id: `${lesson.id}:${check.id}`,
              prompt: check.question,
              options: check.options,
              answer: check.answer,
              lessonId: lesson.id,
              lessonTitle: lesson.title,
              unit: lesson.unit,
              label: check.label,
            } satisfies ExamQuestion,
          ]
        : [],
    ),
  );

const taskSpecs: Record<string, Array<{ lessonId: string; instruction: string }>> = {
  kcna: [
    {
      lessonId: "pods-101",
      instruction:
        "Create a Pod named web using nginx, label it app=web, and verify that it reaches Running.",
    },
    {
      lessonId: "services-101",
      instruction:
        "Create a two-replica nginx Deployment named web, expose it on port 80, and verify its endpoints.",
    },
    {
      lessonId: "deployments-101",
      instruction:
        "Create Deployment web with three nginx replicas, scale it to five, update to nginx:1.27, and check the rollout.",
    },
  ],
  kcsa: [
    {
      lessonId: "rbac-101",
      instruction:
        "Inspect the deploy-bot ServiceAccount, Role, and RoleBinding, then test whether it can get Pods.",
    },
    {
      lessonId: "network-policy-101",
      instruction: "Inspect the deny-all NetworkPolicy and the Pods it selects.",
    },
    {
      lessonId: "pod-security-101",
      instruction: "Inspect the restricted namespace labels and the hardened web Pod.",
    },
  ],
  cka: [
    {
      lessonId: "deployments-101",
      instruction:
        "Create Deployment web with three nginx replicas, scale it to five, update to nginx:1.27, and verify the rollout.",
    },
    {
      lessonId: "scheduling-101",
      instruction:
        "Inspect node labels and taints, read node-2, and verify where the db Pod landed.",
    },
    {
      lessonId: "persistent-volumes-101",
      instruction:
        "Inspect PVC data, its binding to a PersistentVolume, and the Pod that mounts it.",
    },
  ],
  ckad: [
    {
      lessonId: "configmaps-101",
      instruction:
        "Create ConfigMap app-config, create Deployment web, inject the ConfigMap into its environment, and verify readiness.",
    },
    {
      lessonId: "secrets-101",
      instruction:
        "Create Secret db-secret, create Deployment api, inject the Secret, and verify the environment value.",
    },
    {
      lessonId: "ingress-101",
      instruction:
        "Create the web Deployment and Service, create an Ingress for shop.example.com, and verify routing with curl.",
    },
  ],
  cks: [
    {
      lessonId: "rbac-101",
      instruction: "Inspect RBAC for deploy-bot and verify it can get Pods.",
    },
    {
      lessonId: "network-policy-101",
      instruction: "Inspect the deny-all NetworkPolicy and the selected Pods.",
    },
    {
      lessonId: "pod-security-101",
      instruction: "Inspect the restricted Pod Security namespace and hardened web Pod.",
    },
  ],
};

const additionalTaskSpecs: Record<
  string,
  Array<{ lessonId: string; instruction: string; checks?: LessonCheck[] }>
> = {
  kcna: [
    {
      lessonId: "logs-events-101",
      instruction: "Inspect the web Pod logs and the recent cluster events.",
    },
    {
      lessonId: "nodes-101",
      instruction: "Inspect node readiness, labels, and the Pod placement on node-1.",
    },
  ],
  kcsa: [
    {
      lessonId: "secrets-101",
      instruction: "Inspect the db-secret keys and the Deployment that consumes it.",
    },
    {
      lessonId: "ingress-101",
      instruction: "Inspect the Ingress rule and the Service backend it targets.",
    },
  ],
  cka: [
    {
      lessonId: "probes-101",
      instruction:
        "Diagnose the failing readiness probe, its endpoint state, and the warning event.",
    },
    {
      lessonId: "network-policy-101",
      instruction: "Inspect the default-deny NetworkPolicy and confirm which Pods it selects.",
    },
  ],
  ckad: [
    {
      lessonId: "autoscaling-101",
      instruction: "Inspect the HPA target, current utilization, and the Deployment it scales.",
    },
    {
      lessonId: "secrets-101",
      instruction: "Inspect the Secret and verify the Deployment receives the injected value.",
    },
  ],
  cks: [
    {
      lessonId: "secrets-101",
      instruction: "Inspect the Secret data keys and the consuming Deployment environment.",
    },
    {
      lessonId: "ingress-101",
      instruction: "Inspect the Ingress backend and verify routing from the client Pod.",
    },
  ],
};

const allTaskSpecs = Object.fromEntries(
  Object.entries(taskSpecs).map(([track, specs]) => [
    track,
    [...specs, ...(additionalTaskSpecs[track] ?? [])],
  ]),
) as Record<string, Array<{ lessonId: string; instruction: string; checks?: LessonCheck[] }>>;

const taskCounts: Record<string, number> = { kcna: 3, kcsa: 3, cka: 5, ckad: 5, cks: 5 };

function questionSortKey(trackId: string, questionId: string): number {
  let hash = 2166136261;
  for (const value of `${trackId}:${questionId}`) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function buildTask(
  trackId: string,
  spec: { lessonId: string; instruction: string; checks?: LessonCheck[] },
): ExamTask | undefined {
  const lesson = lessonsById.get(spec.lessonId);
  if (lesson === undefined) {
    return undefined;
  }
  const checks = (spec.checks ?? lesson.checks).filter((check) => check.type !== "quiz");
  if (checks.length === 0) {
    return undefined;
  }

  return {
    id: `${trackId}-${lesson.id}`,
    title: lesson.title,
    instruction: spec.instruction,
    lessonId: lesson.id,
    unit: lesson.unit,
    scenario: lesson.scenario,
    checks,
  };
}

export const certificationExams: CertificationExam[] = certificationTracks.map((track) => {
  const allowedUnits = new Set(examUnits[track.id] ?? []);
  const questions = [...extraExamQuestions, ...examPool]
    .filter((question) => allowedUnits.has(question.unit))
    .sort((left, right) => questionSortKey(track.id, left.id) - questionSortKey(track.id, right.id))
    .slice(0, 10);
  const taskPool = (allTaskSpecs[track.id] ?? [])
    .map((spec) => buildTask(track.id, spec))
    .filter((task): task is ExamTask => task !== undefined);
  const taskCount = taskCounts[track.id] ?? 3;

  return {
    id: track.id,
    name: track.name,
    description: track.description,
    durationMinutes: 15,
    passingScore: 70,
    questions,
    labs: [...new Map(questions.map((question) => [question.lessonId, question])).values()]
      .slice(0, 4)
      .map((question) => ({
        lessonId: question.lessonId,
        lessonTitle: question.lessonTitle,
      })),
    taskCount,
    taskPool,
    tasks: taskPool.slice(0, taskCount),
  };
});

export const examQuestionsById = new Map(
  certificationExams.flatMap((exam) =>
    exam.questions.map((question) => [question.id, question] as const),
  ),
);

export function getCertificationExam(id: string): CertificationExam | undefined {
  return certificationExams.find((exam) => exam.id === id);
}

export type { Lesson, LessonCheck, LessonSpec } from "./schema";
export { lessonSpecSchema } from "./schema";
