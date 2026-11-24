import type {
  KubeConfigMap,
  KubeDeployment,
  KubeIngress,
  KubeNode,
  KubeReplicaSet,
  KubeSecret,
  KubeService,
  Pod,
  SimEngine,
} from "@kubelab/sim";

export interface ClusterSnapshot {
  tick: number;
  nodes: KubeNode[];
  deployments: KubeDeployment[];
  replicaSets: KubeReplicaSet[];
  pods: Pod[];
  services: KubeService[];
  ingresses: KubeIngress[];
  configMaps: KubeConfigMap[];
  secrets: KubeSecret[];
}

export interface ChangeScene {
  id: number;
  command: string;
  frames: ClusterSnapshot[];
}

export function captureSnapshot(engine: SimEngine): ClusterSnapshot {
  return {
    tick: engine.clock.tick,
    nodes: engine.store.list<KubeNode>("Node"),
    deployments: engine.store.list<KubeDeployment>("Deployment"),
    replicaSets: engine.store.list<KubeReplicaSet>("ReplicaSet"),
    pods: engine.store.list<Pod>("Pod"),
    services: engine.store.list<KubeService>("Service"),
    ingresses: engine.store.list<KubeIngress>("Ingress"),
    configMaps: engine.store.list<KubeConfigMap>("ConfigMap"),
    secrets: engine.store.list<KubeSecret>("Secret"),
  };
}

function signature(snapshot: ClusterSnapshot): string {
  return JSON.stringify({
    pods: snapshot.pods.map((pod) => [
      pod.metadata.namespace,
      pod.metadata.name,
      pod.status.phase,
      pod.spec.nodeName,
    ]),
    deployments: snapshot.deployments.map((deployment) => [
      deployment.metadata.namespace,
      deployment.metadata.name,
      deployment.spec.replicas,
      deployment.status.readyReplicas,
      deployment.status.updatedReplicas,
      deployment.spec.template.containers.map((container) => [
        container.image,
        container.env,
        container.envFrom,
      ]),
    ]),
    replicaSets: snapshot.replicaSets.map((replicaSet) => [
      replicaSet.metadata.namespace,
      replicaSet.metadata.name,
      replicaSet.spec.revision,
      replicaSet.spec.replicas,
    ]),
    services: snapshot.services.map((service) => [
      service.metadata.namespace,
      service.metadata.name,
      service.spec.type,
      service.spec.clusterIP,
      service.spec.selector,
      service.spec.ports,
    ]),
    ingresses: snapshot.ingresses.map((ingress) => [
      ingress.metadata.namespace,
      ingress.metadata.name,
      ingress.spec.rules,
    ]),
    configMaps: snapshot.configMaps.map((configMap) => [
      configMap.metadata.namespace,
      configMap.metadata.name,
      configMap.data,
    ]),
    secrets: snapshot.secrets.map((secret) => [
      secret.metadata.namespace,
      secret.metadata.name,
      Object.keys(secret.data),
    ]),
  });
}

export function snapshotChanged(left: ClusterSnapshot, right: ClusterSnapshot): boolean {
  return signature(left) !== signature(right);
}
