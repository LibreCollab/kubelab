import { describe, expect, it } from "vitest";

import { filterPods, matchesLabels, podMatches } from "./selectors";
import type { Pod } from "./types";

const pod: Pod = {
  apiVersion: "v1",
  kind: "Pod",
  metadata: {
    name: "web",
    namespace: "default",
    labels: { app: "web", tier: "frontend" },
    uid: "pod-1",
    resourceVersion: 1,
    creationTick: 0,
  },
  spec: {
    containers: [{ name: "web", image: "nginx" }],
  },
  status: {
    phase: "Running",
  },
};

describe("pod selectors", () => {
  it("matches labels as a subset", () => {
    expect(matchesLabels(pod.metadata.labels, { app: "web" })).toBe(true);
    expect(matchesLabels(pod.metadata.labels, { app: "web", tier: "frontend" })).toBe(true);
    expect(matchesLabels(pod.metadata.labels, { app: "api" })).toBe(false);
  });

  it("matches identity and state", () => {
    expect(
      podMatches(pod, {
        namespace: "default",
        name: "web",
        labels: { app: "web" },
        phase: "Running",
      }),
    ).toBe(true);
    expect(podMatches(pod, { phase: "Pending" })).toBe(false);
    expect(podMatches(pod, { namespace: "other" })).toBe(false);
  });

  it("filters a pod list", () => {
    expect(filterPods([pod], { labels: { app: "web" } })).toHaveLength(1);
    expect(filterPods([pod], { labels: { app: "api" } })).toHaveLength(0);
  });

  it("matches container images", () => {
    expect(podMatches(pod, { image: "nginx" })).toBe(true);
    expect(podMatches(pod, { image: "httpd" })).toBe(false);
  });
});
