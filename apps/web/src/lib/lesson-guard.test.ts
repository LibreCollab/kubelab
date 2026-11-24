import { getLesson, type LessonCheck } from "@kubelab/content";
import { describe, expect, it } from "vitest";

import { guardLessonCommand } from "./lesson-guard";

const checks = getLesson("pods-101")?.checks ?? [];

describe("lesson guard", () => {
  it("allows the expected run command", () => {
    expect(guardLessonCommand("kubectl run web --image=nginx --labels=app=web", checks).ok).toBe(
      true,
    );
  });

  it("allows extra labels", () => {
    const result = guardLessonCommand(
      "kubectl run web --image=nginx --labels=app=web,tier=frontend",
      checks,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a wrong label", () => {
    const result = guardLessonCommand("kubectl run web --image=nginx --labels=app=kur", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("label app=web (got app=kur)");
    }
  });

  it("rejects a wrong image", () => {
    const result = guardLessonCommand("kubectl run web --image=httpd --labels=app=web", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("image nginx (got httpd)");
    }
  });

  it("rejects a wrong pod name", () => {
    const result = guardLessonCommand("kubectl run webb --image=nginx --labels=app=web", checks);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('pod name "web" (got "webb")');
    }
  });

  it("does not guard reads", () => {
    expect(guardLessonCommand("kubectl get pods", checks).ok).toBe(true);
  });

  it("guards workload command targets", () => {
    const workloads = getLesson("deployments-101")?.checks ?? [];

    expect(
      guardLessonCommand("kubectl create deployment web --image=nginx --replicas=3", workloads).ok,
    ).toBe(true);
    const wrong = guardLessonCommand(
      "kubectl create deployment api --image=nginx --replicas=3",
      workloads,
    );
    expect(wrong.ok).toBe(false);
    if (!wrong.ok) {
      expect(wrong.error).toContain('deployments "web"');
    }
  });

  it("rejects a Service with the wrong type or name", () => {
    const services = getLesson("services-101")?.checks ?? [];

    expect(
      guardLessonCommand("kubectl expose deployment web --port=80 --type=ClusterIP", services).ok,
    ).toBe(true);

    const wrongType = guardLessonCommand(
      "kubectl expose deployment web --port=80 --type=NodePort",
      services,
    );
    expect(wrongType.ok).toBe(false);
    if (!wrongType.ok) {
      expect(wrongType.error).toContain("service type ClusterIP");
    }

    const wrongName = guardLessonCommand(
      "kubectl expose deployment web --port=80 --name=api",
      services,
    );
    expect(wrongName.ok).toBe(false);
    if (!wrongName.ok) {
      expect(wrongName.error).toContain('service "web"');
    }
  });

  it("rejects a scale or image update that contradicts the checkpoint", () => {
    const workloads = getLesson("deployments-101")?.checks ?? [];

    const wrongReplicas = guardLessonCommand(
      "kubectl scale deployment web --replicas=4",
      workloads,
    );
    expect(wrongReplicas.ok).toBe(false);
    if (!wrongReplicas.ok) {
      expect(wrongReplicas.error).toContain("5 replicas");
    }

    const wrongImage = guardLessonCommand(
      "kubectl set image deployment/web nginx=httpd",
      workloads,
    );
    expect(wrongImage.ok).toBe(false);
    if (!wrongImage.ok) {
      expect(wrongImage.error).toContain("image nginx:1.27");
    }
  });

  it("matches name and namespace on the same check", () => {
    const crossNamespace: LessonCheck[] = [
      {
        type: "command",
        label: "web",
        verb: "create",
        resource: "deployments",
        name: "web",
        namespace: "default",
      },
      {
        type: "command",
        label: "api",
        verb: "create",
        resource: "deployments",
        name: "api",
        namespace: "other",
      },
    ];

    const result = guardLessonCommand(
      "kubectl create deployment web --image=nginx -n other",
      crossNamespace,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("namespace");
    }
  });

  it("rejects an Ingress rule that contradicts the lesson", () => {
    const ingress = getLesson("ingress-101")?.checks ?? [];

    expect(
      guardLessonCommand(
        "kubectl create ingress web --rule=shop.example.com/=web:80 -n demo",
        ingress,
      ).ok,
    ).toBe(true);

    const result = guardLessonCommand(
      "kubectl create ingress web --rule=wrong.example.com/=web:80 -n demo",
      ingress,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("host shop.example.com");
    }

    const ingressOnly: LessonCheck[] = ingress.filter((check) => check.type === "ingress");
    const bypass = guardLessonCommand(
      "kubectl create ingress web --rule=wrong.example.com/=web:80 -n demo",
      ingressOnly,
    );
    expect(bypass.ok).toBe(false);
  });

  it("validates each named pod in a multi-pod lesson", () => {
    const multi = getLesson("labels-101")?.checks ?? [];

    expect(guardLessonCommand("kubectl run web --image=nginx --labels=app=web", multi).ok).toBe(
      true,
    );
    expect(guardLessonCommand("kubectl run api --image=nginx --labels=app=api", multi).ok).toBe(
      true,
    );
    expect(guardLessonCommand("kubectl run web --image=nginx --labels=app=api", multi).ok).toBe(
      false,
    );
  });
});
