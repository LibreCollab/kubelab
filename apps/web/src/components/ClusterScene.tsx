import {
  type KubeDeployment,
  type KubeIngress,
  type KubeService,
  matchesLabels,
  type Pod,
} from "@kubelab/sim";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ChangeScene } from "../lib/cluster-snapshot";
import styles from "./cluster-scene.module.scss";

interface ClusterSceneProps {
  scene: ChangeScene;
  onClose: () => void;
  onOpenFull: () => void;
}

function objectName(object: { metadata: { name: string; namespace: string } }): string {
  return object.metadata.namespace === "default"
    ? object.metadata.name
    : `${object.metadata.namespace}/${object.metadata.name}`;
}

function podState(pod: Pod): string {
  return pod.status.phase === "Running" ? "running" : pod.status.phase.toLowerCase();
}

function deploymentPods(deployment: KubeDeployment, pods: Pod[]): Pod[] {
  return pods.filter(
    (pod) =>
      pod.metadata.namespace === deployment.metadata.namespace &&
      pod.metadata.labels.deployment === deployment.metadata.name,
  );
}

function serviceEndpoints(service: KubeService, pods: Pod[]): Pod[] {
  if (Object.keys(service.spec.selector).length === 0) {
    return [];
  }
  return pods.filter(
    (pod) =>
      pod.metadata.namespace === service.metadata.namespace &&
      pod.status.phase === "Running" &&
      matchesLabels(pod.metadata.labels, service.spec.selector),
  );
}

function ingressEndpoints(ingress: KubeIngress, services: KubeService[], pods: Pod[]): number {
  return ingress.spec.rules.reduce((count, rule) => {
    const service = services.find(
      (candidate) =>
        candidate.metadata.namespace === ingress.metadata.namespace &&
        candidate.metadata.name === rule.serviceName,
    );
    return count + (service === undefined ? 0 : serviceEndpoints(service, pods).length);
  }, 0);
}

function PodRow({ pods }: { pods: Pod[] }) {
  const reduceMotion = useReducedMotion();

  if (pods.length === 0) {
    return <span className={styles.noPods}>no pods</span>;
  }

  return (
    <motion.div layout className={styles.pods}>
      <AnimatePresence initial={false} mode="popLayout">
        {pods.slice(0, 8).map((pod) => (
          <motion.span
            key={pod.metadata.name}
            layout
            className={styles.pod}
            data-state={podState(pod)}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            {pod.metadata.name}
          </motion.span>
        ))}
      </AnimatePresence>
      {pods.length > 8 ? <span className={styles.more}>+{pods.length - 8}</span> : null}
    </motion.div>
  );
}

export function ClusterScene({ scene, onClose, onOpenFull }: ClusterSceneProps) {
  const reduceMotion = useReducedMotion();
  const framesRef = useRef(scene.frames);
  framesRef.current = scene.frames;
  const [frameIndex, setFrameIndex] = useState(() => Math.min(1, scene.frames.length - 1));
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    void replayKey;
    let interval: number | undefined;
    const start = window.setTimeout(() => {
      interval = window.setInterval(() => {
        setFrameIndex((index) => Math.min(index + 1, framesRef.current.length - 1));
      }, 1_100);
    }, 380);
    return () => {
      window.clearTimeout(start);
      if (interval !== undefined) {
        window.clearInterval(interval);
      }
    };
  }, [replayKey]);

  const frame = scene.frames[Math.min(frameIndex, scene.frames.length - 1)];
  const initial = scene.frames[0];
  if (frame === undefined || initial === undefined) {
    return null;
  }

  const initialDeployments = new Set(
    initial.deployments.map((deployment) => objectName(deployment)),
  );
  const initialServices = new Set(initial.services.map((service) => objectName(service)));
  const initialIngresses = new Set(initial.ingresses.map((ingress) => objectName(ingress)));
  const initialConfigMaps = new Set(initial.configMaps.map((configMap) => objectName(configMap)));
  const initialSecrets = new Set(initial.secrets.map((secret) => objectName(secret)));
  const standalonePods = frame.pods.filter((pod) => pod.metadata.labels.deployment === undefined);
  const hasResources =
    frame.deployments.length > 0 ||
    standalonePods.length > 0 ||
    frame.services.length > 0 ||
    frame.ingresses.length > 0 ||
    frame.configMaps.length > 0 ||
    frame.secrets.length > 0;

  const replay = () => {
    setFrameIndex(0);
    setReplayKey((value) => value + 1);
  };

  return (
    <motion.aside
      layout
      className={styles.scene}
      data-testid="cluster-scene"
      data-frame={frameIndex}
      aria-label="Cluster change animation"
      initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.98 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <header className={styles.sceneHead}>
        <div>
          <span className={styles.eyebrow}>Change applied</span>
          <code>{scene.command.replace(/^kubectl\s+/, "")}</code>
        </div>
        <button
          type="button"
          className={styles.close}
          aria-label="Dismiss change animation"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <div className={styles.summary}>
        <span>{frame.tick}s</span>
        <span>{frame.pods.length} pods</span>
        <span>{frame.services.length} svc</span>
        <span>
          frame {Math.min(frameIndex + 1, scene.frames.length)}/{scene.frames.length}
        </span>
      </div>

      <motion.div
        layout
        className={styles.body}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        {frame.deployments.map((deployment) => {
          const pods = deploymentPods(deployment, frame.pods);
          const ready = pods.filter((pod) => pod.status.phase === "Running").length;
          return (
            <motion.article
              layout
              key={objectName(deployment)}
              className={styles.workload}
              data-new={!initialDeployments.has(objectName(deployment))}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={styles.workloadHead}>
                <span>Deployment</span>
                <strong>{objectName(deployment)}</strong>
                <span className={styles.count}>
                  {ready}/{deployment.spec.replicas}
                </span>
              </div>
              <PodRow pods={pods} />
            </motion.article>
          );
        })}

        {standalonePods.length > 0 ? (
          <article className={styles.workload}>
            <div className={styles.workloadHead}>
              <span>Pods</span>
              <strong>standalone</strong>
              <span className={styles.count}>
                {standalonePods.filter((pod) => pod.status.phase === "Running").length}/
                {standalonePods.length}
              </span>
            </div>
            <PodRow pods={standalonePods} />
          </article>
        ) : null}

        {frame.ingresses.map((ingress) => (
          <motion.div
            layout
            key={objectName(ingress)}
            className={styles.route}
            data-new={!initialIngresses.has(objectName(ingress))}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            <span>Ingress {objectName(ingress)}</span>
            <span>→ {ingress.spec.rules.map((rule) => `${rule.host}${rule.path}`).join(", ")}</span>
            <strong>{ingressEndpoints(ingress, frame.services, frame.pods)} ep</strong>
          </motion.div>
        ))}

        {frame.services.map((service) => {
          const endpoints = serviceEndpoints(service, frame.pods);
          return (
            <motion.div
              layout
              key={objectName(service)}
              className={styles.route}
              data-new={!initialServices.has(objectName(service))}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            >
              <span>Service {objectName(service)}</span>
              <span>
                {service.spec.clusterIP}:{service.spec.ports[0]?.port ?? 80}
              </span>
              <strong>{endpoints.length} ep</strong>
            </motion.div>
          );
        })}

        {frame.configMaps.map((configMap) => (
          <motion.div
            layout
            key={objectName(configMap)}
            className={styles.config}
            data-new={!initialConfigMaps.has(objectName(configMap))}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            ConfigMap {objectName(configMap)} · {Object.keys(configMap.data).length} keys
          </motion.div>
        ))}

        {frame.secrets.map((secret) => (
          <motion.div
            layout
            key={objectName(secret)}
            className={styles.config}
            data-new={!initialSecrets.has(objectName(secret))}
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
          >
            Secret {objectName(secret)} · {Object.keys(secret.data).length} keys
          </motion.div>
        ))}

        {!hasResources ? <p className={styles.empty}>No visible resources yet.</p> : null}
      </motion.div>

      <footer className={styles.footer}>
        <button
          type="button"
          className={styles.replay}
          onClick={replay}
          disabled={scene.frames.length < 2}
        >
          Replay
        </button>
        <button type="button" className={styles.openFull} onClick={onOpenFull}>
          Open full map
        </button>
      </footer>
    </motion.aside>
  );
}
