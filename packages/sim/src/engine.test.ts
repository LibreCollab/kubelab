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
});
