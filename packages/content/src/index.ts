import { parse } from "yaml";

import { certificationTaskSeeds } from "./certification-tasks";
import {
  type CertificationTrackDefinition,
  certificationTrackDefinitions,
  type UnitDefinition,
  unitDefinitions,
} from "./curriculum";
import { quizExplanations } from "./quiz-explanations";
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

    const checks = parsed.checks.map((check) =>
      check.type === "quiz" && check.explanation === undefined
        ? {
            ...check,
            ...(quizExplanations[`${parsed.id}:${check.id}`] === undefined
              ? {}
              : { explanation: quizExplanations[`${parsed.id}:${check.id}`] }),
          }
        : check,
    );

    return { ...parsed, checks, theoryMarkdown };
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
  explanation?: string;
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
  format: "knowledge" | "hands-on";
  questionCount: number;
  durationMinutes: number;
  passingScore: number;
  questions: ExamQuestion[];
  labs: Array<{ lessonId: string; lessonTitle: string }>;
  taskCount: number;
  taskPool: ExamTask[];
  tasks: ExamTask[];
}

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
    explanation:
      "Pods run the image named in spec.containers[].image; there is no top-level spec.image field.",
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
    explanation:
      "Kubelet watches the API for Pods assigned to its node and asks the runtime to run them.",
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
    explanation: "Rollback switches the Deployment to a previous ReplicaSet template.",
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
    explanation:
      "A short name searches the Pod namespace first, so api resolves inside that namespace.",
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
    explanation: "envFrom imports all keys from a ConfigMap or Secret; valueFrom selects one key.",
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
    explanation: "Secret data values are base64 encoded; stringData accepts plain text.",
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
    explanation:
      "A claim stays Pending when its size, class, access mode, or selector cannot match a volume.",
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
    explanation:
      "NoSchedule taints require a matching toleration; labels alone do not bypass taints.",
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
    explanation: "Selecting a Pod with no ingress rules denies all ingress to it.",
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
    explanation: "A RoleBinding binds a Role or ClusterRole to subjects in a namespace.",
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
    explanation: "Readiness controls Service endpoints; liveness controls restarts.",
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
    explanation: "rollout status watches the Deployment until the new ReplicaSet is complete.",
  },
  {
    id: "cert:job-completions",
    prompt: "Which Job field sets the target number of successful Pods?",
    options: ["parallelism", "completions", "backoffLimit", "activeDeadlineSeconds"],
    answer: 1,
    lessonId: "jobs-101",
    lessonTitle: "Jobs and batch work",
    unit: "workloads",
    label: "Job completions",
    explanation: "completions is the target success count; parallelism controls concurrent Pods.",
  },
  {
    id: "cert:statefulset-ordinal",
    prompt: "Which Pod does a StatefulSet named db create first?",
    options: ["db-0", "db-1", "db-a", "db-random"],
    answer: 0,
    lessonId: "statefulsets-101",
    lessonTitle: "StatefulSets and ordinals",
    unit: "workloads",
    label: "Ordinal Pod names",
    explanation: "StatefulSet replicas get stable ordinals starting at zero.",
  },
  {
    id: "cert:daemonset-placement",
    prompt: "Where does a DaemonSet place its Pods?",
    options: [
      "One per eligible node",
      "One per cluster",
      "Only on the control plane",
      "Only where nodeName is set",
    ],
    answer: 0,
    lessonId: "daemonsets-101",
    lessonTitle: "DaemonSets",
    unit: "workloads",
    label: "DaemonSet placement",
    explanation: "DaemonSets schedule one Pod per eligible node.",
  },
  {
    id: "cert:init-ordering",
    prompt: "When do application containers start relative to init containers?",
    options: [
      "Before init containers",
      "After all init containers succeed",
      "At the same time",
      "Only after a liveness probe",
    ],
    answer: 1,
    lessonId: "init-containers-101",
    lessonTitle: "Init containers",
    unit: "workloads",
    label: "Init ordering",
    explanation: "Init containers run in order and must all succeed before app containers start.",
  },
  {
    id: "cert:pdb",
    prompt: "What does a PodDisruptionBudget constrain?",
    options: ["Voluntary disruptions", "Image pulls", "DNS records", "PersistentVolume size"],
    answer: 0,
    lessonId: "pdb-101",
    lessonTitle: "PodDisruptionBudgets",
    unit: "scheduling",
    label: "Disruption budgets",
    explanation: "PDBs constrain voluntary disruptions, not failures or normal rollouts.",
  },
  {
    id: "cert:quota",
    prompt: "What does a ResourceQuota limit?",
    options: [
      "Aggregate namespace consumption",
      "Node count only",
      "One image size",
      "Ingress hosts",
    ],
    answer: 0,
    lessonId: "resource-quota-101",
    lessonTitle: "ResourceQuota and LimitRange",
    unit: "scheduling",
    label: "Resource quotas",
    explanation: "ResourceQuota caps aggregate namespace usage.",
  },
  {
    id: "cert:limitrange",
    prompt: "What does a LimitRange defaultRequest do?",
    options: [
      "Sets a container request when omitted",
      "Deletes the Pod",
      "Sets the image tag",
      "Creates a Service",
    ],
    answer: 0,
    lessonId: "resource-quota-101",
    lessonTitle: "ResourceQuota and LimitRange",
    unit: "scheduling",
    label: "LimitRange defaults",
    explanation:
      "defaultRequest fills a missing container request before scheduling and quota checks.",
  },
  {
    id: "cert:required-affinity",
    prompt: "What happens when no node matches required node affinity?",
    options: [
      "The Pod stays Pending",
      "The scheduler ignores it",
      "The Pod runs on any node",
      "The Pod is deleted",
    ],
    answer: 0,
    lessonId: "affinity-101",
    lessonTitle: "Affinity and topology",
    unit: "scheduling",
    label: "Required affinity",
    explanation: "Required affinity is a hard constraint; no match leaves the Pod Pending.",
  },
  {
    id: "cert:tls-ingress",
    prompt: "What does an Ingress TLS section bind?",
    options: ["Hosts to a TLS Secret", "Pod IPs to nodes", "PVCs to PVs", "Roles to users"],
    answer: 0,
    lessonId: "tls-ingress-101",
    lessonTitle: "TLS Ingress",
    unit: "services",
    label: "TLS hosts",
    explanation: "The TLS section associates hosts with a certificate Secret.",
  },
  {
    id: "cert:clusterrole",
    prompt: "What scope does a ClusterRole have?",
    options: ["Cluster-wide", "One Pod only", "One container only", "One node only"],
    answer: 0,
    lessonId: "cluster-rbac-101",
    lessonTitle: "Cluster-scoped RBAC",
    unit: "security",
    label: "ClusterRole scope",
    explanation: "ClusterRoles are cluster-scoped and can be bound across namespaces.",
  },
  {
    id: "cert:startup-probe",
    prompt: "What is the purpose of a startup probe?",
    options: [
      "Delay readiness/liveness until the app starts",
      "Restart the node",
      "Scale the Deployment",
      "Create a Service",
    ],
    answer: 0,
    lessonId: "probes-101",
    lessonTitle: "Probes and health",
    unit: "observability",
    label: "Startup probes",
    explanation: "Startup probes protect slow-starting apps by delaying readiness and liveness.",
  },
  {
    id: "cert:external-hpa",
    prompt: "Which HPA metric type reads a value outside the cluster resource metrics?",
    options: ["External", "Resource", "ContainerResource", "ObjectName"],
    answer: 0,
    lessonId: "autoscaling-101",
    lessonTitle: "Horizontal autoscaling",
    unit: "scheduling",
    label: "External metrics",
    explanation:
      "External metrics come from outside Kubernetes, unlike Resource metrics such as CPU.",
  },
  {
    id: "cert:kustomize-patch",
    prompt: "Which Kustomize field applies a strategic merge patch file?",
    options: ["patchesStrategicMerge", "resources", "namePrefix", "images"],
    answer: 0,
    lessonId: "kustomize-101",
    lessonTitle: "Kustomize",
    unit: "helm",
    label: "Kustomize patches",
    explanation: "patchesStrategicMerge lists patch files that merge into rendered resources.",
  },
  {
    id: "cert:helm-rollback",
    prompt: "Which command moves a Helm release back to an earlier revision?",
    options: ["helm rollback web 1", "helm delete web", "helm list web", "helm template web"],
    answer: 0,
    lessonId: "helm-101",
    lessonTitle: "Helm",
    unit: "helm",
    label: "Helm rollback",
    explanation: "helm rollback <release> <revision> restores an earlier release revision.",
  },
  {
    id: "cert:argo-drift",
    prompt:
      "What does an Argo CD Application report when source content differs from what was applied?",
    options: ["OutOfSync", "Pending", "CrashLoopBackOff", "Bound"],
    answer: 0,
    lessonId: "gitops-101",
    lessonTitle: "GitOps",
    unit: "gitops",
    label: "Argo drift",
    explanation: "Argo reports OutOfSync when live state no longer matches the desired source.",
  },
  {
    id: "cert:netpol-selector",
    prompt: "Which NetworkPolicy field selects the Pods the policy applies to?",
    options: ["podSelector", "namespaceSelector", "ports", "policyTypes"],
    answer: 0,
    lessonId: "network-policy-101",
    lessonTitle: "NetworkPolicy",
    unit: "networking",
    label: "Policy selector",
    explanation: "podSelector chooses the Pods a NetworkPolicy applies to.",
  },
  {
    id: "cert:netpol-egress",
    prompt: "What does a NetworkPolicy with policyTypes: [Egress] control?",
    options: ["Outbound traffic", "Inbound traffic", "DNS only", "Ingress hosts"],
    answer: 0,
    lessonId: "network-policy-101",
    lessonTitle: "NetworkPolicy",
    unit: "networking",
    label: "Egress policy",
    explanation: "Egress policy types control outbound connections from selected Pods.",
  },
  {
    id: "cert:secret-tls",
    prompt: "Which Secret type stores a TLS certificate and key?",
    options: [
      "kubernetes.io/tls",
      "Opaque",
      "kubernetes.io/dockerconfigjson",
      "bootstrap.kubernetes.io/token",
    ],
    answer: 0,
    lessonId: "tls-ingress-101",
    lessonTitle: "TLS Ingress",
    unit: "config",
    label: "TLS Secrets",
    explanation: "kubernetes.io/tls expects tls.crt and tls.key.",
  },
  {
    id: "cert:sa-automount",
    prompt: "What does automountServiceAccountToken: false do?",
    options: [
      "Skips mounting the ServiceAccount token",
      "Deletes the ServiceAccount",
      "Disables RBAC",
      "Creates a ClusterRole",
    ],
    answer: 0,
    lessonId: "rbac-101",
    lessonTitle: "RBAC",
    unit: "security",
    label: "SA token mounting",
    explanation: "false prevents the token volume from being mounted automatically.",
  },
  {
    id: "cert:clusterrolebinding",
    prompt: "Which object grants a ClusterRole across the cluster?",
    options: ["ClusterRoleBinding", "RoleBinding", "Role", "ServiceAccount"],
    answer: 0,
    lessonId: "cluster-rbac-101",
    lessonTitle: "Cluster-scoped RBAC",
    unit: "security",
    label: "ClusterRoleBinding",
    explanation: "A ClusterRoleBinding grants a ClusterRole across the cluster.",
  },
  {
    id: "cert:psa-privilege",
    prompt: "Which container setting is required by the restricted Pod Security level?",
    options: [
      "allowPrivilegeEscalation: false",
      "privileged: true",
      "hostNetwork: true",
      "runAsUser: 0",
    ],
    answer: 0,
    lessonId: "pod-security-101",
    lessonTitle: "Pod hardening",
    unit: "security",
    label: "Restricted Pod Security",
    explanation: "Restricted Pod Security requires privilege escalation to be disabled.",
  },
  {
    id: "cert:ingress-tls-secret",
    prompt: "What does the Ingress TLS section reference?",
    options: ["A TLS Secret", "A ServiceAccount", "A PVC", "A NetworkPolicy"],
    answer: 0,
    lessonId: "tls-ingress-101",
    lessonTitle: "TLS Ingress",
    unit: "services",
    label: "Ingress TLS",
    explanation: "Ingress TLS references a Secret containing certificate data.",
  },
  {
    id: "cert:readiness-endpoints",
    prompt: "What happens when a Pod's readiness probe fails?",
    options: [
      "The Pod is removed from Service endpoints",
      "The container restarts",
      "The Pod is deleted",
      "The node is drained",
    ],
    answer: 0,
    lessonId: "probes-101",
    lessonTitle: "Probes and health",
    unit: "observability",
    label: "Readiness effects",
    explanation: "Readiness failure removes the Pod from endpoints but does not restart it.",
  },
  {
    id: "cert:secret-consume",
    prompt: "Which approach injects a Secret without putting values directly in the Pod spec?",
    options: [
      "secretRef or a Secret volume",
      "A hard-coded env value",
      "A Node label",
      "An Ingress host",
    ],
    answer: 0,
    lessonId: "secrets-101",
    lessonTitle: "Secrets",
    unit: "config",
    label: "Secret consumption",
    explanation: "Use envFrom or a Secret volume so values are not hard-coded in the Pod spec.",
  },
  {
    id: "cert:netpol-ports",
    prompt: "Which NetworkPolicy rule field restricts destination ports?",
    options: ["ports", "to", "from", "podSelector"],
    answer: 0,
    lessonId: "network-policy-101",
    lessonTitle: "NetworkPolicy",
    unit: "networking",
    label: "Policy ports",
    explanation: "ports limits allowed destination ports inside a policy rule.",
  },
  {
    id: "cert:cni",
    prompt: "Which component provides Pod network connectivity?",
    options: ["CNI plugin", "kube-scheduler", "etcd", "Ingress controller"],
    answer: 0,
    lessonId: "cni-101",
    lessonTitle: "CNI and Pod networking",
    unit: "networking",
    label: "CNI",
    explanation: "The CNI plugin configures Pod network interfaces and routes.",
  },
  {
    id: "cert:serviceaccount",
    prompt: "What identity does a ServiceAccount provide to Pods?",
    options: [
      "A workload identity for API access",
      "A node identity",
      "A TLS certificate for Ingress",
      "A StorageClass",
    ],
    answer: 0,
    lessonId: "rbac-101",
    lessonTitle: "RBAC",
    unit: "security",
    label: "ServiceAccount identity",
    explanation: "ServiceAccounts provide workload identity for API authentication.",
  },
  {
    id: "cert:security-context",
    prompt: "What is the purpose of a container securityContext?",
    options: [
      "Control privileges and user identity",
      "Set the replica count",
      "Create a Service",
      "Choose a node",
    ],
    answer: 0,
    lessonId: "pod-security-101",
    lessonTitle: "Pod hardening",
    unit: "security",
    label: "Security context",
    explanation: "securityContext controls user, group, capabilities, and privilege behavior.",
  },
  {
    id: "cert:quota-aggregate",
    prompt: "Which object limits aggregate namespace consumption?",
    options: ["ResourceQuota", "LimitRange", "PDB", "NetworkPolicy"],
    answer: 0,
    lessonId: "resource-quota-101",
    lessonTitle: "ResourceQuota and LimitRange",
    unit: "scheduling",
    label: "Namespace quotas",
    explanation:
      "ResourceQuota limits aggregate namespace usage; LimitRange defaults individual containers.",
  },
  {
    id: "cert:statefulset-identity",
    prompt: "Which workload gives Pods stable ordinal identities?",
    options: ["StatefulSet", "Deployment", "DaemonSet", "Job"],
    answer: 0,
    lessonId: "statefulsets-101",
    lessonTitle: "StatefulSets and ordinals",
    unit: "workloads",
    label: "Stable identity",
    explanation: "StatefulSets provide stable ordinal Pod names.",
  },
  {
    id: "cert:daemonset-node",
    prompt: "Which controller runs one Pod per eligible node?",
    options: ["DaemonSet", "StatefulSet", "Job", "CronJob"],
    answer: 0,
    lessonId: "daemonsets-101",
    lessonTitle: "DaemonSets",
    unit: "workloads",
    label: "Per-node workloads",
    explanation: "DaemonSets place one Pod on every eligible node.",
  },
  {
    id: "cert:job-batch",
    prompt: "Which controller runs Pods until a completion target succeeds?",
    options: ["Job", "Deployment", "DaemonSet", "StatefulSet"],
    answer: 0,
    lessonId: "jobs-101",
    lessonTitle: "Jobs and batch work",
    unit: "workloads",
    label: "Batch completion",
    explanation: "Jobs run Pods until the completion target is reached.",
  },
  {
    id: "cert:init-purpose",
    prompt: "What is the role of an init container?",
    options: [
      "Prepare the Pod before app containers start",
      "Serve production traffic",
      "Scale replicas",
      "Expose a Service",
    ],
    answer: 0,
    lessonId: "init-containers-101",
    lessonTitle: "Init containers",
    unit: "workloads",
    label: "Init containers",
    explanation: "Init containers run setup before app containers.",
  },
  {
    id: "cert:pvc-request",
    prompt: "What does a PersistentVolumeClaim request?",
    options: ["Storage capacity and access mode", "A DNS name", "A node port", "A cluster role"],
    answer: 0,
    lessonId: "persistent-volumes-101",
    lessonTitle: "PersistentVolumes",
    unit: "storage",
    label: "PVC requests",
    explanation: "A PVC requests capacity and access modes, not a specific node or DNS name.",
  },
  {
    id: "cert:node-selector",
    prompt: "What does spec.nodeSelector do?",
    options: [
      "Restricts scheduling to matching node labels",
      "Sets the container image",
      "Creates a Service",
      "Mounts a Secret",
    ],
    answer: 0,
    lessonId: "scheduling-101",
    lessonTitle: "Scheduling and placement",
    unit: "scheduling",
    label: "Node selectors",
    explanation: "nodeSelector is a hard label match for scheduling.",
  },
  {
    id: "cert:hpa-metrics",
    prompt: "What does a HorizontalPodAutoscaler use to change replicas?",
    options: ["Metrics and targets", "Node taints", "PVC size", "Ingress hosts"],
    answer: 0,
    lessonId: "autoscaling-101",
    lessonTitle: "Horizontal autoscaling",
    unit: "scheduling",
    label: "HPA metrics",
    explanation: "HPA changes replicas from metrics compared with targets.",
  },
  {
    id: "cert:kcna-cncf",
    prompt: "What does the CNCF primarily do?",
    options: [
      "Hosts cloud native projects and community programs",
      "Runs Kubernetes clusters for enterprises",
      "Sells certification vouchers",
      "Builds only container runtimes",
    ],
    answer: 0,
    explanation:
      "The CNCF hosts open-source cloud native projects and supports the surrounding community.",
    lessonId: "kcna-readiness",
    lessonTitle: "KCNA readiness",
    unit: "architecture",
    label: "CNCF role",
  },
  {
    id: "cert:kcna-sig",
    prompt: "What is a CNCF Special Interest Group (SIG)?",
    options: [
      "A focused community group for a technical area",
      "A Kubernetes namespace",
      "A type of Service",
      "A node label",
    ],
    answer: 0,
    explanation:
      "SIGs organize contributors around technical areas such as networking, storage, or security.",
    lessonId: "kcna-readiness",
    lessonTitle: "KCNA readiness",
    unit: "architecture",
    label: "SIGs",
  },
  {
    id: "cert:kcna-observability",
    prompt: "Which set best describes the three pillars of observability?",
    options: [
      "Metrics, logs, and traces",
      "Pods, Services, and Ingress",
      "RBAC, Secrets, and quotas",
      "Nodes, kubelet, and etcd",
    ],
    answer: 0,
    explanation: "Observability commonly combines metrics, logs, and distributed traces.",
    lessonId: "logs-events-101",
    lessonTitle: "Logs and events",
    unit: "observability",
    label: "Observability pillars",
  },
  {
    id: "cert:kcna-delivery",
    prompt: "What is continuous delivery?",
    options: [
      "Keeping software deployable and releasing through an automated path",
      "Running every commit directly in production",
      "Only building container images",
      "Replacing all tests with manual approval",
    ],
    answer: 0,
    explanation:
      "Continuous delivery keeps releases deployable while preserving a controlled release decision.",
    lessonId: "gitops-101",
    lessonTitle: "GitOps",
    unit: "services",
    label: "Continuous delivery",
  },
  {
    id: "cert:kcna-gitops",
    prompt: "What is the desired-state source in GitOps?",
    options: ["Git", "The kubelet cache", "A NodePort", "The container runtime"],
    answer: 0,
    explanation: "GitOps treats Git as the desired-state source and reconciles clusters toward it.",
    lessonId: "gitops-101",
    lessonTitle: "GitOps",
    unit: "config",
    label: "GitOps source",
  },
  {
    id: "cert:kcna-cost",
    prompt: "Which practice most directly controls Kubernetes cost?",
    options: [
      "Right-sizing requests and cleaning unused resources",
      "Adding more node taints",
      "Using latest tags",
      "Disabling readiness probes",
    ],
    answer: 0,
    explanation: "Accurate requests and removing unused workloads prevent wasted cluster capacity.",
    lessonId: "resource-quota-101",
    lessonTitle: "ResourceQuota and LimitRange",
    unit: "scheduling",
    label: "Cost control",
  },
  {
    id: "cert:kcna-api",
    prompt: "How do Kubernetes components communicate?",
    options: [
      "Through the kube-apiserver",
      "Directly through etcd only",
      "Through the container runtime socket",
      "Through NodePorts",
    ],
    answer: 0,
    explanation:
      "Clients and controllers use the API server as the central interface to cluster state.",
    lessonId: "control-plane-101",
    lessonTitle: "The control plane",
    unit: "architecture",
    label: "API server",
  },
  {
    id: "cert:kcna-etcd",
    prompt: "What is etcd responsible for?",
    options: [
      "Storing cluster state",
      "Scheduling Pods",
      "Serving application traffic",
      "Pulling images",
    ],
    answer: 0,
    explanation: "etcd is the consistent key-value store that holds Kubernetes cluster state.",
    lessonId: "control-plane-101",
    lessonTitle: "The control plane",
    unit: "architecture",
    label: "etcd",
  },
  {
    id: "cert:kcna-service-mesh",
    prompt: "What does a service mesh add?",
    options: [
      "Traffic policy, identity, and telemetry between services",
      "A replacement for the API server",
      "A node image",
      "A storage class",
    ],
    answer: 0,
    explanation:
      "Service meshes add service-to-service traffic control, identity, and observability.",
    lessonId: "cni-101",
    lessonTitle: "CNI and Pod networking",
    unit: "networking",
    label: "Service mesh",
  },
  {
    id: "cert:kcna-community",
    prompt: "Which resource is best for tracking a CNCF project's maturity?",
    options: ["Its CNCF maturity level", "Its Pod count", "Its namespace name", "Its Service port"],
    answer: 0,
    explanation:
      "CNCF projects move through maturity levels such as sandbox, incubating, and graduated.",
    lessonId: "kcna-readiness",
    lessonTitle: "KCNA readiness",
    unit: "containers",
    label: "Project maturity",
  },
  {
    id: "cert:kcsa-threat-model",
    prompt: "What is the first step in a Kubernetes threat model?",
    options: [
      "Identify assets, actors, and trust boundaries",
      "Create a Service",
      "Scale the Deployment",
      "Delete etcd",
    ],
    answer: 0,
    explanation:
      "Threat modeling starts by identifying what must be protected and where trust changes.",
    lessonId: "kcsa-readiness",
    lessonTitle: "KCSA readiness",
    unit: "security",
    label: "Threat modeling",
  },
  {
    id: "cert:kcsa-runtime",
    prompt: "Which signal is most useful for detecting runtime compromise?",
    options: [
      "Unexpected process or network activity inside a container",
      "A valid YAML file",
      "A Deployment replica count",
      "A node hostname",
    ],
    answer: 0,
    explanation:
      "Runtime security observes behavior after startup, such as unusual processes or connections.",
    lessonId: "pod-security-101",
    lessonTitle: "Pod hardening",
    unit: "observability",
    label: "Runtime detection",
  },
  {
    id: "cert:kcsa-supply-chain",
    prompt: "Which control improves container supply chain trust?",
    options: [
      "Signed images with verified provenance",
      "Using latest tags",
      "Running privileged containers",
      "Disabling admission control",
    ],
    answer: 0,
    explanation:
      "Signing and provenance let clusters verify where an image came from and whether it was altered.",
    lessonId: "images-101",
    lessonTitle: "Images, tags, and registries",
    unit: "containers",
    label: "Supply chain trust",
  },
  {
    id: "cert:kcsa-admission",
    prompt: "When does admission control run?",
    options: [
      "Before a resource is persisted by the API server",
      "After a Pod exits",
      "Only during node boot",
      "Only when a Service is deleted",
    ],
    answer: 0,
    explanation: "Admission controllers can validate or mutate requests before objects are stored.",
    lessonId: "pod-security-101",
    lessonTitle: "Pod hardening",
    unit: "security",
    label: "Admission control",
  },
  {
    id: "cert:kcsa-audit",
    prompt: "What is Kubernetes audit logging used for?",
    options: [
      "Recording API requests and security-relevant actions",
      "Storing container images",
      "Scheduling Pods",
      "Encrypting Secrets automatically",
    ],
    answer: 0,
    explanation: "Audit logs record who did what through the API and are central to investigation.",
    lessonId: "logs-events-101",
    lessonTitle: "Logs and events",
    unit: "observability",
    label: "Audit logs",
  },
  {
    id: "cert:kcsa-compliance",
    prompt: "What does a compliance framework provide?",
    options: [
      "A structured set of controls and evidence expectations",
      "A Kubernetes CNI plugin",
      "A Pod restart policy",
      "A Service account token",
    ],
    answer: 0,
    explanation:
      "Compliance frameworks define controls that organizations must implement and evidence.",
    lessonId: "kcsa-readiness",
    lessonTitle: "KCSA readiness",
    unit: "config",
    label: "Compliance",
  },
  {
    id: "cert:kcsa-secrets-management",
    prompt: "Which practice improves Secret handling?",
    options: [
      "Encrypting at rest and limiting access with RBAC",
      "Committing Secrets to Git",
      "Using the default namespace",
      "Using latest image tags",
    ],
    answer: 0,
    explanation: "Encryption at rest and least-privilege access reduce Secret exposure.",
    lessonId: "secrets-101",
    lessonTitle: "Secrets",
    unit: "security",
    label: "Secret handling",
  },
  {
    id: "cert:kcsa-network-threat",
    prompt: "How does a default-deny NetworkPolicy help?",
    options: [
      "It blocks unapproved network paths until explicitly allowed",
      "It encrypts all traffic",
      "It restarts unhealthy Pods",
      "It signs container images",
    ],
    answer: 0,
    explanation: "Default deny narrows the network attack surface; allowed flows must be declared.",
    lessonId: "network-policy-101",
    lessonTitle: "NetworkPolicy",
    unit: "networking",
    label: "Network threats",
  },
  {
    id: "cert:kcsa-node-hardening",
    prompt: "Which action hardens a Kubernetes node?",
    options: [
      "Restricting access and keeping the runtime patched",
      "Running every Pod privileged",
      "Disabling audit logs",
      "Mounting the host root everywhere",
    ],
    answer: 0,
    explanation:
      "Node hardening reduces host access and keeps critical runtime components current.",
    lessonId: "nodes-101",
    lessonTitle: "Nodes and kubelet",
    unit: "scheduling",
    label: "Node hardening",
  },
  {
    id: "cert:kcsa-sbom",
    prompt: "What is an SBOM?",
    options: [
      "A software bill of materials listing components",
      "A Service load balancer",
      "A Pod disruption budget",
      "A node taint",
    ],
    answer: 0,
    explanation: "An SBOM records the components and dependencies inside a software artifact.",
    lessonId: "images-101",
    lessonTitle: "Images, tags, and registries",
    unit: "config",
    label: "SBOM",
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
              ...(check.explanation === undefined ? {} : { explanation: check.explanation }),
            } satisfies ExamQuestion,
          ]
        : [],
    ),
  );

function normalizeTaskCheck(raw: Record<string, unknown>): LessonCheck {
  if (raw.type === "pod" || raw.type === "deployment") {
    return {
      ...raw,
      namespace: raw.namespace ?? "default",
      labels: raw.labels ?? {},
    } as LessonCheck;
  }
  if (raw.type === "configmap") {
    return { ...raw, namespace: raw.namespace ?? "default", data: raw.data ?? {} } as LessonCheck;
  }
  if (raw.type === "secret") {
    return { ...raw, namespace: raw.namespace ?? "default", keys: raw.keys ?? [] } as LessonCheck;
  }
  if (
    raw.type === "env" ||
    raw.type === "service" ||
    raw.type === "dns" ||
    raw.type === "ingress" ||
    raw.type === "command"
  ) {
    return { ...raw, namespace: raw.namespace ?? "default" } as LessonCheck;
  }
  return raw as LessonCheck;
}

const labTaskPools: Record<string, string[]> = {
  cka: ["cka"],
  ckad: ["ckad"],
  cks: ["cks"],
};

const taskCounts: Record<string, number> = { kcna: 0, kcsa: 0, cka: 15, ckad: 15, cks: 15 };
const knowledgeQuestionCounts: Record<string, number> = { kcna: 60, kcsa: 60 };
const passingScores: Record<string, number> = { kcna: 75, kcsa: 75, cka: 66, ckad: 66, cks: 67 };
const durationMinutes: Record<string, number> = {
  kcna: 90,
  kcsa: 90,
  cka: 120,
  ckad: 120,
  cks: 120,
};

const knowledgeExamUnits: Record<string, string[]> = {
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
  kcsa: [
    "architecture",
    "workloads",
    "services",
    "config",
    "scheduling",
    "networking",
    "security",
    "observability",
  ],
};

function questionSortKey(trackId: string, questionId: string): number {
  let hash = 2166136261;
  for (const value of `${trackId}:${questionId}`) {
    hash ^= value.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const certificationExams: CertificationExam[] = certificationTracks.map((track) => {
  const questionCount = knowledgeQuestionCounts[track.id] ?? 0;
  const allowedKnowledgeUnits = new Set(knowledgeExamUnits[track.id] ?? []);
  const questions =
    questionCount === 0
      ? []
      : [...extraExamQuestions, ...examPool]
          .filter((question) => allowedKnowledgeUnits.has(question.unit))
          .sort(
            (left, right) =>
              questionSortKey(track.id, left.id) - questionSortKey(track.id, right.id),
          )
          .slice(0, questionCount);
  const taskPool: ExamTask[] = (labTaskPools[track.id] ?? [])
    .flatMap((poolTrack) => certificationTaskSeeds[poolTrack] ?? [])
    .map((seed) => ({
      id: seed.id,
      title: seed.title,
      instruction: seed.instruction,
      lessonId: "certification",
      unit: seed.unit,
      scenario: seed.scenario,
      checks: seed.checks.map(normalizeTaskCheck),
    }));
  const taskCount = taskCounts[track.id] ?? 0;

  return {
    id: track.id,
    name: track.name,
    description: track.description,
    format: track.format,
    questionCount,
    durationMinutes: durationMinutes[track.id] ?? 15,
    passingScore: passingScores[track.id] ?? 70,
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
  [...extraExamQuestions, ...examPool].map((question) => [question.id, question] as const),
);

export function getCertificationExam(id: string): CertificationExam | undefined {
  return certificationExams.find((exam) => exam.id === id);
}

export type { CertificationDomain } from "./certification-roadmaps";
export { certificationDomains } from "./certification-roadmaps";
export type { Lesson, LessonCheck, LessonSpec } from "./schema";
export { lessonSpecSchema } from "./schema";
