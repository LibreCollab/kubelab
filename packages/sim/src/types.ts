export type PodPhase = "Pending" | "Running" | "Succeeded" | "Failed";

export interface ObjectMeta {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  uid: string;
  resourceVersion: number;
  creationTick: number;
}

export interface KubeObject {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
}

export interface NodeTaint {
  key: string;
  value?: string;
  effect: string;
}

export interface KubeNode extends KubeObject {
  kind: "Node";
  spec?: {
    taints?: NodeTaint[];
  };
  status: {
    ready: boolean;
    allocatable: {
      cpu: string;
      memory: string;
    };
  };
}

export interface EnvVar {
  name: string;
  value: string;
  source?: EnvFromSource;
}

export interface EnvFromSource {
  kind: "ConfigMap" | "Secret";
  name: string;
}

export interface Probe {
  initialDelaySeconds?: number;
  periodSeconds?: number;
  timeoutSeconds?: number;
  failureThreshold?: number;
  successThreshold?: number;
  exec?: { command: string[] };
  httpGet?: { path?: string; port: number | string; scheme?: string };
  tcpSocket?: { port: number | string };
}

export interface ContainerSecurityContext {
  allowPrivilegeEscalation?: boolean;
  readOnlyRootFilesystem?: boolean;
  capabilities?: { drop?: string[] };
}

export interface PodSecurityContext {
  runAsNonRoot?: boolean;
  runAsUser?: number;
  seccompProfile?: { type: string };
}

export interface ContainerSpec {
  name: string;
  image: string;
  env?: EnvVar[];
  envFrom?: EnvFromSource[];
  securityContext?: ContainerSecurityContext;
  readinessProbe?: Probe;
  livenessProbe?: Probe;
  simulator?: {
    probeStatus?: {
      readiness?: number;
      liveness?: number;
    };
  };
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
}

export interface PodCondition {
  type: string;
  status: "True" | "False";
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  ready: boolean;
  restartCount: number;
  state: "running" | "waiting" | "terminated";
  reason?: string;
}

export interface ProbeState {
  lastTick: number;
  failures: number;
  successes: number;
}

export interface Pod extends KubeObject {
  kind: "Pod";
  spec: {
    nodeName?: string;
    nodeSelector?: Record<string, string>;
    securityContext?: PodSecurityContext;
    tolerations?: Array<{
      key?: string;
      operator?: string;
      value?: string;
      effect?: string;
    }>;
    containers: ContainerSpec[];
    initContainers?: ContainerSpec[];
    volumes?: Array<{
      name: string;
      persistentVolumeClaim?: { claimName: string };
      configMap?: { name: string };
      secret?: { secretName: string };
    }>;
  };
  status: {
    phase: PodPhase;
    message?: string;
    podIP?: string;
    conditions?: PodCondition[];
    usage?: { cpuMillicores: number; memoryBytes: number };
    containerStatuses?: ContainerStatus[];
    probeState?: Record<string, ProbeState>;
    initialized?: boolean;
    reason?: string;
    backoffUntil?: number;
  };
  logs?: string[];
}

export interface PodTemplate {
  labels: Record<string, string>;
  containers: ContainerSpec[];
  initContainers?: ContainerSpec[];
}

export interface KubeNamespace extends KubeObject {
  kind: "Namespace";
  status: {
    phase: "Active";
  };
}

export interface KubeStorageClass extends KubeObject {
  kind: "StorageClass";
  provisioner: string;
  reclaimPolicy: "Delete" | "Retain";
  volumeBindingMode: "Immediate" | "WaitForFirstConsumer";
  allowVolumeExpansion?: boolean;
}

export interface KubePersistentVolume extends KubeObject {
  kind: "PersistentVolume";
  spec: {
    capacity: { storage: string };
    accessModes: string[];
    storageClassName?: string;
    claimRef?: { namespace: string; name: string };
    reclaimPolicy?: "Delete" | "Retain";
  };
  status: {
    phase: "Available" | "Bound" | "Released";
  };
}

export interface KubePersistentVolumeClaim extends KubeObject {
  kind: "PersistentVolumeClaim";
  spec: {
    accessModes: string[];
    resources: { requests: { storage: string } };
    storageClassName?: string;
    volumeName?: string;
  };
  status: {
    phase: "Pending" | "Bound";
    capacity?: string;
  };
}

export interface NetworkPolicyPeer {
  podSelector?: Record<string, string>;
  namespaceSelector?: Record<string, string>;
  ipBlock?: { cidr: string; except?: string[] };
}

export interface NetworkPolicyPort {
  protocol?: string;
  port?: number | string;
}

export interface NetworkPolicyIngressRule {
  from?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface NetworkPolicyEgressRule {
  to?: NetworkPolicyPeer[];
  ports?: NetworkPolicyPort[];
}

export interface KubeNetworkPolicy extends KubeObject {
  kind: "NetworkPolicy";
  spec: {
    podSelector: Record<string, string>;
    policyTypes: string[];
    ingress?: NetworkPolicyIngressRule[];
    egress?: NetworkPolicyEgressRule[];
  };
}

export interface KubeServiceAccount extends KubeObject {
  kind: "ServiceAccount";
}

export interface KubeRole extends KubeObject {
  kind: "Role";
  rules: Array<{
    apiGroups: string[];
    resources: string[];
    verbs: string[];
  }>;
}

export interface KubeRoleBinding extends KubeObject {
  kind: "RoleBinding";
  roleRef: { kind: string; name: string };
  subjects: Array<{ kind: string; name: string; namespace?: string }>;
}

export interface KubeEvent extends KubeObject {
  kind: "Event";
  reason: string;
  message: string;
  type: "Normal" | "Warning";
  involvedObject: { kind: string; name: string; namespace?: string };
}

export interface KubeHelmRelease extends KubeObject {
  kind: "HelmRelease";
  chartName: string;
  chartVersion: string;
  appVersion?: string;
  status: string;
  history: Array<{
    revision: number;
    status: string;
    chart: string;
    description: string;
  }>;
}

export interface KubeApplication extends KubeObject {
  kind: "Application";
  source: {
    repoURL: string;
    path: string;
    revision?: string;
  };
  destination: {
    namespace: string;
    server?: string;
  };
  syncStatus: "Synced" | "OutOfSync";
  healthStatus: "Healthy" | "Progressing" | "Degraded";
}

export interface KubeWidget extends KubeObject {
  kind: "Widget";
  spec: {
    size: number;
    color: string;
  };
  status: {
    phase: "Ready";
  };
}

export interface HpaResourceMetric {
  type: "Resource";
  resource: {
    name: string;
    target: {
      type: "Utilization" | "AverageValue";
      averageUtilization?: number;
      averageValue?: string;
    };
  };
}

export interface KubeHorizontalPodAutoscaler extends KubeObject {
  kind: "HorizontalPodAutoscaler";
  spec: {
    minReplicas: number;
    maxReplicas: number;
    scaleTargetRef: { kind: string; name: string };
    metrics?: HpaResourceMetric[];
  };
  status: {
    currentReplicas: number;
    desiredReplicas: number;
    currentCPUUtilization?: number;
  };
}

export interface KubeConfigMap extends KubeObject {
  kind: "ConfigMap";
  data: Record<string, string>;
}

export interface KubeSecret extends KubeObject {
  kind: "Secret";
  type: "Opaque";
  data: Record<string, string>;
}

export interface KubeReplicaSet extends KubeObject {
  kind: "ReplicaSet";
  spec: {
    replicas: number;
    revision: number;
    template: PodTemplate;
  };
  status: {
    replicas: number;
    readyReplicas: number;
  };
}

export interface KubeDaemonSet extends KubeObject {
  kind: "DaemonSet";
  spec: {
    template: PodTemplate;
  };
  status: {
    desiredNumberScheduled: number;
    currentNumberScheduled: number;
    numberReady: number;
  };
}

export interface KubeStatefulSet extends KubeObject {
  kind: "StatefulSet";
  spec: {
    replicas: number;
    serviceName?: string;
    template: PodTemplate;
  };
  status: {
    replicas: number;
    readyReplicas: number;
  };
}

export interface KubeJob extends KubeObject {
  kind: "Job";
  spec: {
    completions: number;
    parallelism: number;
    template: PodTemplate;
  };
  status: {
    active: number;
    succeeded: number;
    failed: number;
    startTick?: number;
    completionTick?: number;
  };
}

export interface KubeCronJob extends KubeObject {
  kind: "CronJob";
  spec: {
    schedule: string;
    jobTemplate: {
      spec: {
        completions: number;
        parallelism: number;
        template: PodTemplate;
      };
    };
  };
  status: {
    lastScheduleTick?: number;
  };
}

export interface KubeDeployment extends KubeObject {
  kind: "Deployment";
  spec: {
    replicas: number;
    template: PodTemplate;
    strategy?: {
      type?: "RollingUpdate" | "Recreate";
      rollingUpdate?: {
        maxSurge?: number | string;
        maxUnavailable?: number | string;
      };
    };
  };
  status: {
    replicas: number;
    readyReplicas: number;
    updatedReplicas: number;
    availableReplicas: number;
  };
}

export interface IngressRule {
  host: string;
  path: string;
  serviceName: string;
  servicePort: number;
}

export interface KubeIngress extends KubeObject {
  kind: "Ingress";
  spec: {
    ingressClassName?: string;
    rules: IngressRule[];
  };
}

export type ServiceType = "ClusterIP" | "NodePort" | "LoadBalancer";

export interface KubeService extends KubeObject {
  kind: "Service";
  spec: {
    type: ServiceType;
    selector: Record<string, string>;
    ports: Array<{
      port: number;
      targetPort: number;
      nodePort?: number;
    }>;
    clusterIP: string;
  };
}

export interface ScenarioNode {
  name: string;
  cpu?: string;
  memory?: string;
  labels?: Record<string, string>;
  taints?: NodeTaint[];
}

export interface Scenario {
  nodes: ScenarioNode[];
  objects?: unknown[];
  files?: Record<string, string>;
}

export interface CommandResult {
  ok: boolean;
  output: string;
}

export type SimEvent =
  | { type: "pod.created"; tick: number; pod: Pod }
  | { type: "pod.scheduled"; tick: number; pod: Pod }
  | { type: "pod.running"; tick: number; pod: Pod }
  | { type: "pod.deleted"; tick: number; pod: Pod };
