import { describe, expect, it } from "vitest";

import { parseKubectl, SimEngine } from "./index";

function createEngine(): SimEngine {
  const engine = new SimEngine({ intervalMs: 1000 });
  engine.seed({ nodes: [{ name: "node-1" }] });
  return engine;
}

describe("kubectl parser", () => {
  it("parses run with flags", () => {
    const parsed = parseKubectl("kubectl run web --image=nginx --labels=app=web,tier=frontend");

    expect("error" in parsed).toBe(false);
    if ("error" in parsed) {
      return;
    }

    expect(parsed.verb).toBe("run");
    if (parsed.verb === "run") {
      expect(parsed.name).toBe("web");
      expect(parsed.image).toBe("nginx");
      expect(parsed.labels).toEqual({ app: "web", tier: "frontend" });
    }
  });

  it("rejects an unknown verb", () => {
    const parsed = parseKubectl("kubectl frobnicate");
    expect("error" in parsed).toBe(true);
  });

  it("parses get label selectors", () => {
    const parsed = parseKubectl("kubectl get pods -l app=web");
    expect("error" in parsed).toBe(false);
    if (!("error" in parsed) && parsed.verb === "get") {
      expect(parsed.selector).toEqual({ app: "web" });
    }
  });

  it("rejects unsupported output formats", () => {
    expect("error" in parseKubectl("kubectl get pods -o json")).toBe(true);
  });

  it("parses --output=wide", () => {
    const parsed = parseKubectl("kubectl get pods --output=wide");
    expect("error" in parsed).toBe(false);
    if (!("error" in parsed) && parsed.verb === "get") {
      expect(parsed.output).toBe("wide");
    }
  });

  it("parses --show-labels", () => {
    const parsed = parseKubectl("kubectl get pods --show-labels");
    expect("error" in parsed).toBe(false);
    if (!("error" in parsed) && parsed.verb === "get") {
      expect(parsed.showLabels).toBe(true);
    }
  });

  it("rejects malformed labels and selectors", () => {
    expect("error" in parseKubectl("kubectl run web --image=nginx --labels=app")).toBe(true);
    expect("error" in parseKubectl("kubectl get pods -l app")).toBe(true);
  });

  it("rejects unknown flags and extra arguments", () => {
    expect("error" in parseKubectl("kubectl run web --image=nginx --labls=app=web")).toBe(true);
    expect("error" in parseKubectl("kubectl run web api --image=nginx")).toBe(true);
  });

  it("parses workload commands", () => {
    const created = parseKubectl("kubectl create deployment web --image=nginx --replicas=3");
    expect("error" in created).toBe(false);
    if (!("error" in created) && created.verb === "create") {
      expect(created).toMatchObject({ name: "web", image: "nginx", replicas: 3 });
    }

    const exposed = parseKubectl("kubectl expose deployment/web --port=80 --type=NodePort");
    expect("error" in exposed).toBe(false);
    if (!("error" in exposed) && exposed.verb === "expose") {
      expect(exposed).toMatchObject({
        serviceName: "web",
        port: 80,
        serviceType: "NodePort",
      });
    }

    const scaled = parseKubectl("kubectl scale deployment/web --replicas=5");
    expect("error" in scaled).toBe(false);
    if (!("error" in scaled) && scaled.verb === "scale") {
      expect(scaled).toMatchObject({ name: "web", replicas: 5 });
    }

    const image = parseKubectl("kubectl set image deployment/web nginx=nginx:1.27");
    expect("error" in image).toBe(false);
    if (!("error" in image) && image.verb === "set") {
      expect(image).toMatchObject({ name: "web", container: "nginx", image: "nginx:1.27" });
    }

    const rollout = parseKubectl("kubectl rollout undo deployment/web");
    expect("error" in rollout).toBe(false);
    if (!("error" in rollout) && rollout.verb === "rollout") {
      expect(rollout).toMatchObject({ action: "undo", name: "web" });
    }
  });

  it("rejects partial numbers, empty assignments, and extra arguments", () => {
    expect(
      "error" in parseKubectl("kubectl create deployment web --image=nginx --replicas=3x"),
    ).toBe(true);
    expect("error" in parseKubectl("kubectl scale deployment web --replicas=2x")).toBe(true);
    expect("error" in parseKubectl("kubectl expose deployment web --port=80x")).toBe(true);
    expect("error" in parseKubectl("kubectl expose deployment web extra --port=80")).toBe(true);
    expect("error" in parseKubectl("kubectl set image deployment/web =nginx")).toBe(true);
    expect("error" in parseKubectl("kubectl create deployment web extra --image=nginx")).toBe(true);
    expect("error" in parseKubectl("kubectl scale deployment web extra --replicas=2")).toBe(true);
    expect("error" in parseKubectl("kubectl set image deployment/web nginx=nginx extra")).toBe(
      true,
    );
    expect("error" in parseKubectl("kubectl rollout undo deployment/web extra")).toBe(true);
    expect("error" in parseKubectl("kubectl scale deployment/web/extra --replicas=2")).toBe(true);
  });
});

describe("engine", () => {
  it("schedules and runs a pod over two ticks", () => {
    const engine = createEngine();

    const created = engine.execute("kubectl run web --image=nginx --labels=app=web");
    expect(created.ok).toBe(true);
    expect(engine.execute("kubectl get pods").output).toContain("Pending");

    engine.step();
    expect(engine.execute("kubectl get pods").output).toContain("Pending");

    engine.step();
    const pods = engine.execute("kubectl get pods").output;
    expect(pods).toContain("Running");
    expect(pods).toContain("web");
  });

  it("deletes a pod", () => {
    const engine = createEngine();
    engine.execute("kubectl run web --image=nginx");

    const deleted = engine.execute("kubectl delete pod web");
    expect(deleted.ok).toBe(true);
    expect(engine.execute("kubectl get pods").output).toContain("No resources found");
  });

  it("reports missing pods", () => {
    const engine = createEngine();
    const result = engine.execute("kubectl describe pod missing");
    expect(result.ok).toBe(false);
    expect(result.output).toContain("NotFound");
  });

  it("rejects a duplicate pod name", () => {
    const engine = createEngine();
    engine.execute("kubectl run web --image=nginx");

    const second = engine.execute("kubectl run web --image=nginx");
    expect(second.ok).toBe(false);
    expect(second.output).toContain("AlreadyExists");
  });

  it("filters pods by label selector", () => {
    const engine = createEngine();
    engine.execute("kubectl run web --image=nginx --labels=app=web");
    engine.execute("kubectl run api --image=nginx --labels=app=api");

    const result = engine.execute("kubectl get pods -l app=web");
    expect(result.output).toContain("web");
    expect(result.output).not.toContain("api");
  });

  it("shows labels and keeps a mistyped label visible", () => {
    const engine = createEngine();
    engine.execute("kubectl run web --image=nginx --labels=app=webb");

    const result = engine.execute("kubectl get pods --show-labels");
    expect(result.output).toContain("LABELS");
    expect(result.output).toContain("app=webb");

    const filtered = engine.execute("kubectl get pods -l app=web");
    expect(filtered.output).toContain("No resources found");
  });

  it("records executed commands", () => {
    const engine = createEngine();
    engine.execute("kubectl get pods");
    engine.execute("kubectl run web --image=nginx");

    expect(engine.commands.map((command) => command.verb)).toEqual(["get", "run"]);
  });

  it("creates a deployment and reconciles replicas", () => {
    const engine = createEngine();

    expect(engine.execute("kubectl create deployment web --image=nginx --replicas=2").ok).toBe(
      true,
    );
    expect(engine.execute("kubectl get deployments").output).toContain("0/2");

    engine.step();
    engine.step();

    const deployments = engine.execute("kubectl get deployments");
    expect(deployments.output).toContain("2/2");
    expect(engine.execute("kubectl get pods -l app=web").output.match(/Running/g)).toHaveLength(2);
    expect(engine.execute("kubectl get replicasets").output).toContain("web-");
  });

  it("scales a deployment", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl scale deployment/web --replicas=3").ok).toBe(true);
    engine.step();
    engine.step();

    expect(engine.execute("kubectl get deployments").output).toContain("3/3");
  });

  it("rolls out a new image and rolls back", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl set image deployment/web nginx=nginx:1.27").ok).toBe(true);
    engine.step();
    engine.step();

    expect(engine.execute("kubectl describe deployment web").output).toContain("nginx:1.27");
    expect(engine.execute("kubectl get deployments").output).toContain("2/2");

    expect(engine.execute("kubectl rollout undo deployment/web").ok).toBe(true);
    engine.step();
    engine.step();

    expect(engine.execute("kubectl describe deployment web").output).toContain("Image: nginx");
    expect(engine.execute("kubectl get deployments").output).toContain("2/2");

    expect(engine.execute("kubectl rollout undo deployment/web").ok).toBe(true);
    engine.step();
    engine.step();
    expect(engine.execute("kubectl describe deployment web").output).toContain("nginx:1.27");
    expect(engine.execute("kubectl get deployments").output).toContain("2/2");
  });

  it("exposes a deployment and reports endpoints on the target port", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl expose deployment web --port=80 --target-port=8080").ok).toBe(
      true,
    );
    const service = engine.execute("kubectl get services -l app=web");
    expect(service.output).toContain("web");
    expect(service.output).toContain("ClusterIP");

    expect(engine.execute("kubectl get replicasets -l deployment=web").output).toContain("web-");
    const endpoints = engine.execute("kubectl get endpoints web");
    expect(endpoints.output).toContain("10.244.0.");
    expect(endpoints.output).toContain(":8080");
  });

  it("caps replica counts to keep the simulator responsive", () => {
    const engine = createEngine();
    const result = engine.execute("kubectl create deployment web --image=nginx --replicas=101");
    expect(result.ok).toBe(false);
    expect(result.output).toContain("max 100");
  });

  it("does not record failed commands", () => {
    const engine = createEngine();
    const result = engine.execute("kubectl rollout status deployment/missing");
    expect(result.ok).toBe(false);
    expect(engine.commands).toHaveLength(0);
  });

  it("accepts resource/name and API group forms for get", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx");

    expect(engine.execute("kubectl get deployment/web").output).toContain("web");
    expect(engine.execute("kubectl get deployments.apps").output).toContain("web");
    expect(engine.execute("kubectl get deploy/web").output).toContain("web");
  });

  it("shows a clean scale-down state before the next tick", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=3");
    engine.step();
    engine.step();

    engine.execute("kubectl scale deployment/web --replicas=1");
    expect(engine.execute("kubectl get deployments").output).toContain("0/1");
    expect(engine.execute("kubectl rollout status deployment/web").output).toContain(
      "scale down to finish",
    );

    engine.step();
    engine.step();
    expect(engine.execute("kubectl get deployments").output).toContain("1/1");
  });

  it("exposes a standalone pod and deletes the Service", () => {
    const engine = createEngine();
    engine.execute("kubectl run web --image=nginx");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl expose pod web --port=8080").ok).toBe(true);
    expect(engine.execute("kubectl get endpoints web").output).toContain(":8080");
    expect(engine.execute("kubectl delete service web").ok).toBe(true);
    expect(engine.execute("kubectl get services").output).toContain("No resources found");
  });

  it("copies exposed workload labels onto the Service", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx");
    engine.execute("kubectl expose deployment web --port=80 --name=api");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl get services -l app=web").output).toContain("api");
  });

  it("deletes a deployment with its ReplicaSets and Pods", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl delete deployment/web").ok).toBe(true);
    expect(engine.execute("kubectl get deployments").output).toContain("No resources found");
    expect(engine.execute("kubectl get pods").output).toContain("No resources found");
    expect(engine.execute("kubectl get replicasets").output).toContain("No resources found");
  });

  it("reports rollout status", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx");
    engine.step();
    engine.step();

    expect(engine.execute("kubectl rollout status deployment/web").output).toContain(
      "successfully rolled out",
    );
  });
});
