import { describe, expect, it } from "vitest";

import { type KubeDeployment, type Pod, parseKubectl, SimEngine } from "./index";

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

  it("parses exec and Ingress commands", () => {
    const exec = parseKubectl("kubectl exec client -n demo -- nslookup web");
    expect("error" in exec).toBe(false);
    if (!("error" in exec) && exec.verb === "exec") {
      expect(exec).toMatchObject({
        name: "client",
        namespace: "demo",
        command: "nslookup",
        args: ["web"],
      });
    }

    const ingress = parseKubectl(
      "kubectl create ingress web --rule=shop.example.com/=web:80 -n demo --class=nginx",
    );
    expect("error" in ingress).toBe(false);
    if (!("error" in ingress) && ingress.verb === "create") {
      expect(ingress.resource).toBe("ingresses");
      if (ingress.resource === "ingresses") {
        expect(ingress.rule).toEqual({
          host: "shop.example.com",
          path: "/",
          serviceName: "web",
          servicePort: 80,
        });
        expect(ingress.ingressClassName).toBe("nginx");
      }
    }

    expect(
      "error" in parseKubectl("kubectl create ingress web --rule=shop.example.com=web:80"),
    ).toBe(true);
    expect("error" in parseKubectl("kubectl create ingress web --rule=shop.example.com/=80")).toBe(
      true,
    );
    expect("error" in parseKubectl("kubectl exec client nslookup web")).toBe(true);
    expect(
      "error" in
        parseKubectl(
          "kubectl create ingress web --rule=a.example.com/=web:80 --rule=b.example.com/=web:80",
        ),
    ).toBe(true);
  });

  it("parses ConfigMap, Secret, and set env commands", () => {
    const configMap = parseKubectl(
      "kubectl create configmap app-config --from-literal=APP_MODE=production --from-literal=LOG_LEVEL=debug",
    );
    expect("error" in configMap).toBe(false);
    if (!("error" in configMap) && configMap.verb === "create") {
      expect(configMap.resource).toBe("configmaps");
      if (configMap.resource === "configmaps") {
        expect(configMap.data).toEqual({ APP_MODE: "production", LOG_LEVEL: "debug" });
      }
    }

    const secret = parseKubectl(
      "kubectl create secret generic db-secret --from-literal=DB_PASSWORD=s3cr3t",
    );
    expect("error" in secret).toBe(false);
    if (!("error" in secret) && secret.verb === "create") {
      expect(secret.resource).toBe("secrets");
      if (secret.resource === "secrets") {
        expect(secret.name).toBe("db-secret");
        expect(secret.data).toEqual({ DB_PASSWORD: "s3cr3t" });
      }
    }

    const env = parseKubectl("kubectl set env deployment/web --from=configmap/app-config");
    expect("error" in env).toBe(false);
    if (!("error" in env) && env.verb === "set") {
      expect(env).toMatchObject({
        action: "env",
        name: "web",
        fromKind: "ConfigMap",
        fromName: "app-config",
      });
    }

    expect("error" in parseKubectl("kubectl create secret db-secret --from-literal=BAD")).toBe(
      true,
    );
    expect("error" in parseKubectl("kubectl set env deployment/web")).toBe(true);
    expect("error" in parseKubectl("kubectl set env deployment/web --from=literal/thing")).toBe(
      true,
    );
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

  it("resolves Service DNS through exec", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2 -n demo");
    engine.execute("kubectl expose deployment web --port=80 -n demo");
    engine.execute("kubectl run client --image=busybox -n demo");
    engine.step();
    engine.step();

    const nslookup = engine.execute("kubectl exec client -n demo -- nslookup web");
    expect(nslookup.ok).toBe(true);
    expect(nslookup.output).toContain("web.demo.svc.cluster.local");
    expect(nslookup.output).toContain("10.96.0.");

    const getent = engine.execute("kubectl exec client -n demo -- getent hosts web.demo");
    expect(getent.ok).toBe(true);
    expect(getent.output).toContain("web.demo.svc.cluster.local");
  });

  it("routes HTTP requests through Ingress to Service endpoints", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=2 -n demo");
    engine.execute("kubectl expose deployment web --port=80 -n demo");
    engine.execute("kubectl run client --image=busybox -n demo");
    engine.step();
    engine.step();

    expect(
      engine.execute(
        "kubectl create ingress web --rule=shop.example.com/=web:80 -n demo --class=nginx",
      ).ok,
    ).toBe(true);
    expect(engine.execute("kubectl get ingresses -n demo").output).toContain("shop.example.com");
    expect(engine.execute("kubectl describe ingress web -n demo").output).toContain(
      "Backend: web:80",
    );

    const curl = engine.execute(
      'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/',
    );
    expect(curl.ok).toBe(true);
    expect(curl.output).toContain("HTTP/1.1 200 OK");
    expect(curl.output).toContain("web -> web-");

    expect(engine.execute("kubectl delete ingress web -n demo").ok).toBe(true);
    expect(engine.execute("kubectl get ingresses -n demo").output).toContain("No resources found");
  });

  it("reports exec failures without recording them", () => {
    const engine = createEngine();
    engine.execute("kubectl run client --image=busybox");

    expect(engine.execute("kubectl exec missing -- nslookup web").ok).toBe(false);

    engine.step();
    expect(engine.execute("kubectl exec client -- getent hosts web").ok).toBe(false);

    engine.step();
    expect(engine.execute("kubectl exec client -- nslookup web").output).toContain("NXDOMAIN");
    expect(engine.execute("kubectl exec client -- whoami").ok).toBe(false);
    expect(engine.execute("kubectl exec client -- getent web").ok).toBe(false);
    expect(engine.execute("kubectl exec client -- getent hosts web extra").ok).toBe(false);
    expect(engine.execute("kubectl exec client -- nslookup web extra").ok).toBe(false);
    expect(engine.commands.some((command) => command.verb === "exec")).toBe(false);
  });

  it("enforces Ingress path boundaries and backend ports", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx --replicas=1 -n demo");
    engine.execute("kubectl expose deployment web --port=80 -n demo");
    engine.execute("kubectl run client --image=busybox -n demo");
    engine.step();
    engine.step();
    engine.execute("kubectl create ingress api --rule=shop.example.com/api=web:80 -n demo");

    expect(
      engine.execute(
        'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/api/users',
      ).ok,
    ).toBe(true);
    expect(
      engine.execute(
        'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/apifoo',
      ).output,
    ).toContain("404");

    engine.execute("kubectl delete ingress api -n demo");
    engine.execute("kubectl create ingress web --rule=shop.example.com/=web:81 -n demo");
    expect(
      engine.execute(
        'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/',
      ).output,
    ).toContain("503");
  });

  it("wires ConfigMaps and Secrets into Deployment environments", () => {
    const engine = createEngine();
    engine.execute(
      "kubectl create configmap app-config --from-literal=APP_MODE=production --from-literal=LOG_LEVEL=debug",
    );
    engine.execute("kubectl create deployment web --image=nginx --replicas=1");
    expect(engine.execute("kubectl set env deployment/web --from=configmap/app-config").ok).toBe(
      true,
    );
    engine.step();
    engine.step();

    const web = engine.store.list<KubeDeployment>("Deployment")[0];
    expect(web?.spec.template.containers[0]?.env).toEqual([
      {
        name: "APP_MODE",
        value: "production",
        source: { kind: "ConfigMap", name: "app-config" },
      },
      {
        name: "LOG_LEVEL",
        value: "debug",
        source: { kind: "ConfigMap", name: "app-config" },
      },
    ]);
    expect(engine.execute("kubectl describe deployment web").output).toContain(
      "EnvFrom: ConfigMap/app-config",
    );
    expect(engine.execute("kubectl describe deployment web").output).not.toContain(
      "APP_MODE: production",
    );

    const webPod = engine.store
      .list<Pod>("Pod")
      .find((pod) => pod.metadata.labels.deployment === "web");
    expect(webPod).toBeDefined();
    if (webPod !== undefined) {
      expect(
        engine.execute(`kubectl exec ${webPod.metadata.name} -- printenv APP_MODE`).output,
      ).toBe("production");
    }

    engine.execute("kubectl create secret generic db-secret --from-literal=DB_PASSWORD=s3cr3t");
    engine.execute("kubectl create deployment api --image=nginx");
    expect(engine.execute("kubectl set env deployment/api --from=secret/db-secret").ok).toBe(true);
    expect(engine.execute("kubectl get configmaps").output).toContain("app-config");
    expect(engine.execute("kubectl get secrets").output).toContain("db-secret");
    expect(engine.execute("kubectl describe deployment api").output).not.toContain("s3cr3t");
    expect(engine.execute("kubectl describe deployment api").output).toContain(
      "EnvFrom: Secret/db-secret",
    );
    engine.step();
    engine.step();

    const apiPod = engine.store
      .list<Pod>("Pod")
      .find((pod) => pod.metadata.labels.deployment === "api");
    expect(apiPod?.spec.containers[0]?.env).toEqual([
      {
        name: "DB_PASSWORD",
        value: "s3cr3t",
        source: { kind: "Secret", name: "db-secret" },
      },
    ]);

    engine.execute("kubectl create secret generic unicode --from-literal=GREETING=🔐");
    engine.execute("kubectl create deployment unicode --image=nginx");
    expect(engine.execute("kubectl set env deployment/unicode --from=secret/unicode").ok).toBe(
      true,
    );
    engine.step();
    engine.step();
    const unicodePod = engine.store
      .list<Pod>("Pod")
      .find((pod) => pod.metadata.labels.deployment === "unicode");
    expect(unicodePod?.spec.containers[0]?.env?.[0]?.value).toBe("🔐");
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
