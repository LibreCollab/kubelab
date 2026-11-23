export interface UnitDefinition {
  id: string;
  number: number;
  title: string;
  description: string;
}

export const unitDefinitions: UnitDefinition[] = [
  {
    id: "containers",
    number: 1,
    title: "Containers & orchestration",
    description: "Images, runtimes, and why Kubernetes exists.",
  },
  {
    id: "architecture",
    number: 2,
    title: "Cluster anatomy",
    description: "Control plane, nodes, kubelet, and kubectl.",
  },
  {
    id: "workloads",
    number: 3,
    title: "Workloads & rollouts",
    description: "Pods, labels, lifecycle, and Deployments.",
  },
  {
    id: "services",
    number: 4,
    title: "Services & DNS",
    description: "Stable networking for ephemeral Pods.",
  },
  {
    id: "config",
    number: 5,
    title: "Configuration & secrets",
    description: "ConfigMaps, Secrets, and environment wiring.",
  },
  {
    id: "storage",
    number: 6,
    title: "Storage",
    description: "Volumes, PVs, PVCs, and StorageClasses.",
  },
  {
    id: "scheduling",
    number: 7,
    title: "Scheduling & scaling",
    description: "Placement, quotas, and autoscaling.",
  },
  {
    id: "networking",
    number: 8,
    title: "Networking",
    description: "CNI, NetworkPolicy, Ingress, and traffic flow.",
  },
  {
    id: "security",
    number: 9,
    title: "Security & RBAC",
    description: "Identities, authorization, and pod hardening.",
  },
  {
    id: "observability",
    number: 10,
    title: "Observability & troubleshooting",
    description: "Logs, events, probes, metrics, and debugging.",
  },
  {
    id: "helm",
    number: 11,
    title: "Helm & Kustomize",
    description: "Packaging and customizing manifests.",
  },
  {
    id: "gitops",
    number: 12,
    title: "GitOps & operators",
    description: "Declarative delivery and controller patterns.",
  },
  {
    id: "certification",
    number: 13,
    title: "Certification readiness",
    description: "Checkpoints for KCNA, KCSA, CKA, CKAD, and CKS.",
  },
];

export interface CertificationTrackDefinition {
  id: string;
  name: string;
  description: string;
  lessonIds: string[];
}

export const certificationTrackDefinitions: CertificationTrackDefinition[] = [
  {
    id: "kcna",
    name: "KCNA",
    description: "Kubernetes and Cloud Native Associate foundations.",
    lessonIds: ["kcna-readiness"],
  },
  {
    id: "kcsa",
    name: "KCSA",
    description: "Kubernetes and Cloud Native Security Associate foundations.",
    lessonIds: ["kcsa-readiness"],
  },
  {
    id: "cka",
    name: "CKA",
    description: "Administrator track: architecture and troubleshooting.",
    lessonIds: ["cka-readiness"],
  },
  {
    id: "ckad",
    name: "CKAD",
    description: "Developer track: application design and delivery.",
    lessonIds: ["ckad-readiness"],
  },
  {
    id: "cks",
    name: "CKS",
    description: "Security specialist track: hardening and runtime security.",
    lessonIds: ["cks-readiness"],
  },
];
