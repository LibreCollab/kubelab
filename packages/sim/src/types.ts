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

export interface KubeNode extends KubeObject {
  kind: "Node";
  status: {
    ready: boolean;
    allocatable: {
      cpu: string;
      memory: string;
    };
  };
}

export interface Pod extends KubeObject {
  kind: "Pod";
  spec: {
    nodeName?: string;
    containers: Array<{
      name: string;
      image: string;
    }>;
  };
  status: {
    phase: PodPhase;
    message?: string;
    podIP?: string;
  };
}

export interface PodTemplate {
  labels: Record<string, string>;
  containers: Array<{
    name: string;
    image: string;
  }>;
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

export interface KubeDeployment extends KubeObject {
  kind: "Deployment";
  spec: {
    replicas: number;
    template: PodTemplate;
  };
  status: {
    replicas: number;
    readyReplicas: number;
    updatedReplicas: number;
    availableReplicas: number;
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
    }>;
    clusterIP: string;
  };
}

export interface ScenarioNode {
  name: string;
  cpu?: string;
  memory?: string;
}

export interface Scenario {
  nodes: ScenarioNode[];
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
