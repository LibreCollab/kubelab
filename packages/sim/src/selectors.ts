import type { Pod, PodPhase } from "./types";

/**
 * PodFilter is the single source of truth for matching pods by identity and
 * state. Both the kubectl simulator and lesson checks use it so their semantics
 * cannot drift.
 */
export interface PodFilter {
  namespace?: string;
  name?: string;
  image?: string;
  labels?: Record<string, string>;
  phase?: PodPhase;
}

export function matchesLabels(
  labels: Record<string, string>,
  selector: Record<string, string>,
): boolean {
  return Object.entries(selector).every(([key, value]) => labels[key] === value);
}

export function podMatches(pod: Pod, filter: PodFilter): boolean {
  if (filter.namespace !== undefined && pod.metadata.namespace !== filter.namespace) {
    return false;
  }
  if (filter.name !== undefined && pod.metadata.name !== filter.name) {
    return false;
  }
  if (
    filter.image !== undefined &&
    !pod.spec.containers.some((container) => container.image === filter.image)
  ) {
    return false;
  }
  if (filter.labels !== undefined && !matchesLabels(pod.metadata.labels, filter.labels)) {
    return false;
  }
  if (filter.phase !== undefined && pod.status.phase !== filter.phase) {
    return false;
  }
  return true;
}

export function filterPods(pods: Pod[], filter: PodFilter): Pod[] {
  return pods.filter((pod) => podMatches(pod, filter));
}
