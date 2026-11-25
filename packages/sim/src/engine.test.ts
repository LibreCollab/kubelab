import { describe, expect, it } from "vitest";

import {
  type KubeCronJob,
  type KubeDaemonSet,
  type KubeDeployment,
  type KubeHorizontalPodAutoscaler,
  type KubeJob,
  type KubeNetworkPolicy,
  type KubePersistentVolume,
  type KubePersistentVolumeClaim,
  type KubePodDisruptionBudget,
  type KubeStatefulSet,
  type KubeWidget,
  type Pod,
  parseKubectl,
  SimEngine,
} from "./index";

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

  it("parses top for pods and nodes", () => {
    const pods = parseKubectl("kubectl top pods -A");
    expect("error" in pods).toBe(false);
    if (!("error" in pods) && pods.verb === "top") {
      expect(pods).toMatchObject({ resource: "pods", allNamespaces: true });
    }

    const nodes = parseKubectl("kubectl top nodes node-1");
    expect("error" in nodes).toBe(false);
    if (!("error" in nodes) && nodes.verb === "top") {
      expect(nodes).toMatchObject({ resource: "nodes", name: "node-1" });
    }
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
    engine.step();
    engine.step();

    expect(engine.execute("kubectl describe deployment web").output).toContain("nginx:1.27");
    expect(engine.execute("kubectl get deployments").output).toContain("2/2");

    expect(engine.execute("kubectl rollout undo deployment/web").ok).toBe(true);
    engine.step();
    engine.step();
    engine.step();
    engine.step();

    expect(engine.execute("kubectl describe deployment web").output).toContain("Image: nginx");
    expect(engine.execute("kubectl get deployments").output).toContain("2/2");

    expect(engine.execute("kubectl rollout undo deployment/web").ok).toBe(true);
    engine.step();
    engine.step();
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

  it("seeds storage, events, logs, and RBAC resources", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "StorageClass",
          metadata: { name: "fast" },
          provisioner: "kubernetes.io/no-provisioner",
          reclaimPolicy: "Retain",
          volumeBindingMode: "WaitForFirstConsumer",
        },
        {
          kind: "PersistentVolumeClaim",
          metadata: { name: "data" },
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: { requests: { storage: "5Gi" } },
            storageClassName: "fast",
            volumeName: "data-pv",
          },
          status: { phase: "Bound", capacity: "5Gi" },
        },
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.10",
            conditions: [{ type: "Ready", status: "True" }],
          },
          logs: ["hello", "ready"],
        },
        {
          kind: "Event",
          metadata: { name: "web-started" },
          type: "Normal",
          reason: "Started",
          message: "Started container web",
          involvedObject: { kind: "Pod", name: "web" },
        },
        {
          kind: "ServiceAccount",
          metadata: { name: "deploy-bot" },
        },
        {
          kind: "Role",
          metadata: { name: "pod-reader" },
          rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get"] }],
        },
        {
          kind: "RoleBinding",
          metadata: { name: "read-pods" },
          roleRef: { kind: "Role", name: "pod-reader" },
          subjects: [{ kind: "ServiceAccount", name: "deploy-bot", namespace: "default" }],
        },
      ],
    });

    expect(engine.execute("kubectl get storageclass fast").output).toContain("fast");
    expect(engine.execute("kubectl get pvc data").output).toContain("Bound");
    expect(engine.execute("kubectl get pod web").output).toContain("1/1");
    expect(engine.execute("kubectl logs web").output).toContain("ready");
    expect(engine.execute("kubectl get events").output).toContain("Started container web");
    expect(
      engine.execute("kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot")
        .output,
    ).toBe("yes");
  });

  it("shows taints and hides unready Pods from Service endpoints", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [
        {
          name: "node-2",
          labels: { disk: "hdd" },
          taints: [{ key: "dedicated", value: "db", effect: "NoSchedule" }],
        },
      ],
      objects: [
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 8080 }],
            clusterIP: "10.96.0.50",
          },
        },
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-2", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.11",
            conditions: [{ type: "Ready", status: "False", reason: "ContainersNotReady" }],
          },
        },
      ],
    });

    expect(engine.execute("kubectl describe node node-2").output).toContain(
      "dedicated=db:NoSchedule",
    );
    expect(engine.execute("kubectl get pod web").output).toContain("0/1");
    expect(engine.execute("kubectl get endpoints web").output).toContain("<none>");
  });

  it("honors node selectors and taints when scheduling", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [
        {
          name: "node-2",
          labels: { disk: "hdd" },
          taints: [{ key: "dedicated", value: "db", effect: "NoSchedule" }],
        },
      ],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "bad", labels: { app: "bad" } },
          spec: {
            nodeSelector: { disk: "hdd" },
            containers: [{ name: "bad", image: "nginx" }],
          },
          status: { phase: "Pending" },
        },
        {
          kind: "Pod",
          metadata: { name: "good", labels: { app: "good" } },
          spec: {
            nodeSelector: { disk: "hdd" },
            tolerations: [
              { key: "dedicated", operator: "Equal", value: "db", effect: "NoSchedule" },
            ],
            containers: [{ name: "good", image: "nginx" }],
          },
          status: { phase: "Pending" },
        },
      ],
    });

    engine.step();
    engine.step();

    expect(engine.store.get<Pod>("Pod", "bad")?.spec.nodeName).toBeUndefined();
    expect(engine.store.get<Pod>("Pod", "bad")?.status.message).toContain("none match");
    expect(engine.store.get<Pod>("Pod", "good")?.spec.nodeName).toBe("node-2");
    expect(engine.store.get<Pod>("Pod", "good")?.status.phase).toBe("Running");
  });

  it("validates log containers and unsupported follow mode", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web" },
          spec: {
            nodeName: "node-1",
            containers: [
              { name: "web", image: "nginx" },
              { name: "sidecar", image: "busybox" },
            ],
          },
          status: { phase: "Running" },
          logs: ["hello"],
        },
      ],
    });

    expect(engine.execute("kubectl logs web").ok).toBe(false);
    expect(engine.execute("kubectl logs web -c missing").ok).toBe(false);
    expect(engine.execute("kubectl logs web -c web").output).toBe("hello");
    expect(engine.execute("kubectl logs web -c web --follow").output).toBe("hello");
  });

  it("denies RBAC requests for the wrong subject", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        { kind: "ServiceAccount", metadata: { name: "deploy-bot" } },
        {
          kind: "Role",
          metadata: { name: "pod-reader" },
          rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get"] }],
        },
        {
          kind: "RoleBinding",
          metadata: { name: "read-pods" },
          roleRef: { kind: "Role", name: "pod-reader" },
          subjects: [{ kind: "ServiceAccount", name: "deploy-bot" }],
        },
      ],
    });

    expect(
      engine.execute("kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot")
        .output,
    ).toBe("yes");
    expect(
      engine.execute("kubectl auth can-i delete pods --as=system:serviceaccount:default:deploy-bot")
        .output,
    ).toBe("yes".replace("yes", "no"));
    expect(
      engine.execute("kubectl auth can-i get pods --as=system:serviceaccount:default:other").output,
    ).toBe("no");
  });

  it("evaluates readiness probes without restarting and restores endpoints", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 8080 }],
            clusterIP: "10.96.0.70",
          },
        },
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: {
            nodeName: "node-1",
            containers: [
              {
                name: "web",
                image: "nginx",
                readinessProbe: {
                  httpGet: { path: "/healthz", port: 8080 },
                  periodSeconds: 1,
                  failureThreshold: 1,
                },
                simulator: { probeStatus: { readiness: 500 } },
              },
            ],
          },
          status: {
            phase: "Running",
            podIP: "10.244.0.70",
            conditions: [{ type: "Ready", status: "True" }],
            containerStatuses: [{ name: "web", ready: true, restartCount: 0, state: "running" }],
          },
        },
      ],
    });

    engine.step();
    const pod = engine.store.get<Pod>("Pod", "web");
    expect(pod?.status.conditions?.find((condition) => condition.type === "Ready")?.status).toBe(
      "False",
    );
    expect(pod?.status.containerStatuses?.[0]?.restartCount).toBe(0);
    expect(engine.execute("kubectl get endpoints web").output).toContain("<none>");
    expect(engine.execute("kubectl get events").output).toContain("Readiness probe failed");

    const current = engine.store.get<Pod>("Pod", "web");
    expect(current).toBeDefined();
    if (current === undefined) {
      return;
    }
    engine.store.upsert({
      ...current,
      spec: {
        ...current.spec,
        containers: current.spec.containers.map((container) => ({
          ...container,
          simulator: { probeStatus: { readiness: 200 } },
        })),
      },
    });

    engine.step();
    expect(
      engine.store
        .get<Pod>("Pod", "web")
        ?.status.conditions?.find((condition) => condition.type === "Ready")?.status,
    ).toBe("True");
    expect(engine.execute("kubectl get endpoints web").output).toContain("10.244.0.70");
  });

  it("restarts failed liveness containers and enters CrashLoopBackOff", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "worker", labels: { app: "worker" } },
          spec: {
            nodeName: "node-1",
            containers: [
              {
                name: "worker",
                image: "busybox",
                livenessProbe: {
                  exec: { command: ["false"] },
                  periodSeconds: 1,
                  failureThreshold: 1,
                },
              },
            ],
          },
          status: {
            phase: "Running",
            podIP: "10.244.0.71",
            conditions: [{ type: "Ready", status: "True" }],
            containerStatuses: [{ name: "worker", ready: true, restartCount: 0, state: "running" }],
          },
        },
      ],
    });

    engine.step();
    engine.step();
    engine.step();

    const pod = engine.store.get<Pod>("Pod", "worker");
    expect(pod?.status.reason).toBe("CrashLoopBackOff");
    expect(pod?.status.containerStatuses?.[0]?.restartCount).toBe(3);
    expect(pod?.status.conditions?.find((condition) => condition.type === "Ready")?.status).toBe(
      "False",
    );

    const listed = engine.execute("kubectl get pods");
    expect(listed.output).toContain("CrashLoopBackOff");
    expect(listed.output).toContain("3");
    expect(engine.execute("kubectl get events").output).toContain("Liveness probe failed");
    expect(engine.execute("kubectl get events").output).toContain("Back-off");
    expect(engine.execute("kubectl describe pod worker").output).toContain("Restart Count: 3");
  });

  it("reconciles HPAs and dynamically provisions PVCs", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Deployment",
          metadata: { name: "web" },
          spec: {
            replicas: 3,
            template: { labels: { app: "web" }, containers: [{ name: "web", image: "nginx" }] },
          },
          status: { replicas: 3, readyReplicas: 3, updatedReplicas: 3, availableReplicas: 3 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "web" },
          spec: {
            minReplicas: 2,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "web" },
          },
          status: { currentReplicas: 3, desiredReplicas: 5 },
        },
        {
          kind: "StorageClass",
          metadata: { name: "fast" },
          provisioner: "ebs.csi.aws.com",
          reclaimPolicy: "Delete",
          volumeBindingMode: "Immediate",
        },
        {
          kind: "PersistentVolumeClaim",
          metadata: { name: "data" },
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: { requests: { storage: "2Gi" } },
            storageClassName: "fast",
          },
          status: { phase: "Pending" },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(5);
    expect(
      engine.store.get<KubePersistentVolumeClaim>("PersistentVolumeClaim", "data")?.status.phase,
    ).toBe("Bound");
    expect(engine.execute("kubectl get pvc data").output).toContain("Bound");
  });

  it("enforces default-deny NetworkPolicy for Service requests", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.60",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "client", labels: { app: "client" } },
          spec: { nodeName: "node-1", containers: [{ name: "client", image: "busybox" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.61",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 80 }],
            clusterIP: "10.96.0.60",
          },
        },
        {
          kind: "NetworkPolicy",
          metadata: { name: "deny-all" },
          spec: { podSelector: {}, policyTypes: ["Ingress"], ingress: [], egress: [] },
        },
      ],
    });

    const result = engine.execute("kubectl exec client -- curl http://web");
    expect(result.output).toContain("403");
    expect(result.output).toContain("NetworkPolicy");
  });

  it("renders resources as YAML and reports top usage", () => {
    const engine = createEngine();
    engine.execute("kubectl create deployment web --image=nginx");
    engine.step();
    engine.step();

    const yaml = engine.execute("kubectl get deployment web -o yaml");
    expect(yaml.ok).toBe(true);
    expect(yaml.output).toContain("kind: Deployment");
    expect(yaml.output).toContain("image: nginx");

    const pods = engine.execute("kubectl top pods");
    expect(pods.ok).toBe(true);
    expect(pods.output).toContain("CPU(cores)");
    expect(pods.output).toContain("web-");

    const nodes = engine.execute("kubectl top nodes");
    expect(nodes.output).toContain("node-1");
    expect(nodes.output).toContain("CPU%");
  });

  it("scales an HPA from Pod CPU usage and stabilizes demand", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [{ name: "node-1" }],
      files: {
        "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    labels:
      app: web
    containers:
      - name: web
        image: nginx
        resources:
          requests:
            cpu: 100m
`,
      },
    });
    engine.execute("kubectl apply -f deployment.yaml");
    engine.step();
    engine.step();

    for (const pod of engine.store.list<Pod>("Pod", "default")) {
      engine.store.upsert({
        ...pod,
        status: { ...pod.status, usage: { cpuMillicores: 80, memoryBytes: 64 * 1024 * 1024 } },
      });
    }

    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "web" },
          spec: {
            minReplicas: 1,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "web" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "cpu",
                  target: { type: "Utilization", averageUtilization: 50 },
                },
              },
            ],
          },
          status: { currentReplicas: 2, desiredReplicas: 1 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(4);
    expect(
      engine.store.get<KubeHorizontalPodAutoscaler>("HorizontalPodAutoscaler", "web")?.status,
    ).toMatchObject({ currentReplicas: 2, desiredReplicas: 4, currentCPUUtilization: 80 });

    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(4);
    expect(
      engine.store.get<KubeHorizontalPodAutoscaler>("HorizontalPodAutoscaler", "web")?.status,
    ).toMatchObject({ currentReplicas: 4, desiredReplicas: 4, currentCPUUtilization: 40 });
  });

  it("scales from memory metrics and respects tolerance", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Deployment",
          metadata: { name: "cache" },
          spec: {
            replicas: 2,
            template: {
              labels: { app: "cache" },
              containers: [{ name: "cache", image: "redis" }],
            },
          },
          status: { replicas: 2, readyReplicas: 2, updatedReplicas: 2, availableReplicas: 2 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "cache" },
          spec: {
            minReplicas: 1,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "cache" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "memory",
                  target: { type: "Utilization", averageUtilization: 100 },
                },
              },
            ],
          },
          status: { currentReplicas: 2, desiredReplicas: 1, currentMemoryUtilization: 200 },
        },
        {
          kind: "Deployment",
          metadata: { name: "steady" },
          spec: {
            replicas: 3,
            template: {
              labels: { app: "steady" },
              containers: [{ name: "steady", image: "nginx" }],
            },
          },
          status: { replicas: 3, readyReplicas: 3, updatedReplicas: 3, availableReplicas: 3 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "steady" },
          spec: {
            minReplicas: 1,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "steady" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "cpu",
                  target: { type: "Utilization", averageUtilization: 50 },
                },
              },
            ],
          },
          status: { currentReplicas: 3, desiredReplicas: 1, currentCPUUtilization: 52 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "cache")?.spec.replicas).toBe(4);
    expect(engine.store.get<KubeDeployment>("Deployment", "steady")?.spec.replicas).toBe(3);
    expect(
      engine.store.get<KubeHorizontalPodAutoscaler>("HorizontalPodAutoscaler", "cache")?.status,
    ).toMatchObject({ desiredReplicas: 4, currentMemoryUtilization: 200 });
    expect(engine.execute("kubectl get hpa cache").output).toContain("memory: 200%/100%");
    expect(engine.execute("kubectl get hpa steady").output).toContain("cpu: 52%/50%");
  });

  it("clamps HPA metric scaling to configured bounds", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Deployment",
          metadata: { name: "web" },
          spec: {
            replicas: 4,
            template: { labels: { app: "web" }, containers: [{ name: "web", image: "nginx" }] },
          },
          status: { replicas: 4, readyReplicas: 4, updatedReplicas: 4, availableReplicas: 4 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "web" },
          spec: {
            minReplicas: 2,
            maxReplicas: 6,
            scaleTargetRef: { kind: "Deployment", name: "web" },
            metrics: [
              {
                type: "Resource",
                resource: {
                  name: "cpu",
                  target: { type: "Utilization", averageUtilization: 50 },
                },
              },
            ],
          },
          status: { currentReplicas: 4, desiredReplicas: 1, currentCPUUtilization: 500 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(6);
    expect(engine.execute("kubectl get hpa web").output).toContain("500%/50%");
  });

  it("uses authored Pod usage in top output", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.10",
            conditions: [{ type: "Ready", status: "True" }],
            usage: { cpuMillicores: 73, memoryBytes: 128 * 1024 * 1024 },
          },
        },
      ],
    });

    const top = engine.execute("kubectl top pods");
    expect(top.output).toContain("73m");
    expect(top.output).toContain("128Mi");
  });

  it("reconciles one DaemonSet Pod per ready node", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [{ name: "node-2" }],
      objects: [
        {
          kind: "DaemonSet",
          metadata: { name: "agent" },
          spec: {
            template: {
              labels: { app: "agent" },
              containers: [{ name: "agent", image: "busybox" }],
            },
          },
          status: { desiredNumberScheduled: 0, currentNumberScheduled: 0, numberReady: 0 },
        },
      ],
    });

    engine.step();
    engine.step();
    expect(
      engine.store
        .list<Pod>("Pod", "default")
        .map((pod) => pod.metadata.name)
        .sort(),
    ).toEqual(["agent-node-1", "agent-node-2"]);
    expect(engine.store.get<KubeDaemonSet>("DaemonSet", "agent")?.status).toEqual({
      desiredNumberScheduled: 2,
      currentNumberScheduled: 2,
      numberReady: 2,
    });
    expect(engine.execute("kubectl get daemonsets").output).toContain("agent");
  });

  it("reconciles stable StatefulSet ordinals and scale down", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "StatefulSet",
          metadata: { name: "db" },
          spec: {
            replicas: 3,
            serviceName: "db",
            template: {
              labels: { app: "db" },
              containers: [{ name: "db", image: "postgres" }],
            },
          },
          status: { replicas: 0, readyReplicas: 0 },
        },
      ],
    });

    engine.step();
    engine.step();
    expect(
      engine.store
        .list<Pod>("Pod", "default")
        .map((pod) => pod.metadata.name)
        .sort(),
    ).toEqual(["db-0", "db-1", "db-2"]);
    expect(engine.store.get<KubeStatefulSet>("StatefulSet", "db")?.status.replicas).toBe(3);

    const statefulSet = engine.store.get<KubeStatefulSet>("StatefulSet", "db");
    expect(statefulSet).toBeDefined();
    if (statefulSet === undefined) {
      return;
    }
    engine.store.upsert({ ...statefulSet, spec: { ...statefulSet.spec, replicas: 1 } });
    engine.step();
    expect(engine.store.list<Pod>("Pod", "default").map((pod) => pod.metadata.name)).toEqual([
      "db-0",
    ]);
  });

  it("completes Jobs and schedules CronJobs", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Job",
          metadata: { name: "migrate" },
          spec: {
            completions: 2,
            parallelism: 2,
            template: {
              labels: { app: "migrate" },
              containers: [{ name: "migrate", image: "busybox" }],
            },
          },
          status: { active: 0, succeeded: 0, failed: 0 },
        },
        {
          kind: "CronJob",
          metadata: { name: "backup" },
          spec: {
            schedule: "@every 2s",
            jobTemplate: {
              spec: {
                completions: 1,
                parallelism: 1,
                template: {
                  labels: { app: "backup" },
                  containers: [{ name: "backup", image: "busybox" }],
                },
              },
            },
          },
          status: {},
        },
      ],
    });

    engine.step();
    engine.step();
    engine.step();
    expect(engine.store.get<KubeJob>("Job", "migrate")?.status.succeeded).toBe(2);
    expect(engine.execute("kubectl get jobs").output).toContain("2/2");
    expect(engine.execute("kubectl get jobs").output).toContain("Complete");

    const cronJobs = engine.store
      .list<KubeJob>("Job", "default")
      .filter((job) => job.metadata.labels.cronjob === "backup");
    expect(cronJobs).toHaveLength(1);
    expect(engine.store.get<KubeCronJob>("CronJob", "backup")?.status.lastScheduleTick).toBe(2);
    expect(engine.execute("kubectl get cronjobs").output).toContain("@every 2s");
  });

  it("waits for init containers before running a Pod", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "app" },
          spec: {
            nodeName: "node-1",
            initContainers: [{ name: "init", image: "busybox" }],
            containers: [{ name: "app", image: "nginx" }],
          },
          status: { phase: "Pending" },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<Pod>("Pod", "app")?.status.phase).toBe("Pending");
    expect(engine.store.get<Pod>("Pod", "app")?.status.message).toContain("Init:0/1");
    engine.step();
    expect(engine.store.get<Pod>("Pod", "app")?.status.phase).toBe("Running");
  });

  it("honors required node affinity and Pod anti-affinity", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [{ name: "node-2", labels: { zone: "b" } }],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "zoned" },
          spec: {
            nodeName: undefined,
            affinity: {
              nodeAffinity: {
                requiredDuringSchedulingIgnoredDuringExecution: {
                  nodeSelectorTerms: [
                    { matchExpressions: [{ key: "zone", operator: "In", values: ["b"] }] },
                  ],
                },
              },
            },
            containers: [{ name: "zoned", image: "nginx" }],
          },
          status: { phase: "Pending" },
        },
        {
          kind: "Deployment",
          metadata: { name: "spread" },
          spec: {
            replicas: 2,
            template: {
              labels: { app: "spread" },
              affinity: {
                podAntiAffinity: {
                  requiredDuringSchedulingIgnoredDuringExecution: [
                    { labelSelector: { app: "spread" }, topologyKey: "kubernetes.io/hostname" },
                  ],
                },
              },
              containers: [{ name: "spread", image: "nginx" }],
            },
          },
          status: { replicas: 0, readyReplicas: 0, updatedReplicas: 0, availableReplicas: 0 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<Pod>("Pod", "zoned")?.spec.nodeName).toBe("node-2");
    engine.step();
    const nodes = engine.store
      .list<Pod>("Pod", "default")
      .filter((pod) => pod.metadata.labels.app === "spread")
      .map((pod) => pod.spec.nodeName);
    expect(new Set(nodes).size).toBe(2);
  });

  it("applies LimitRange defaults and enforces pod quotas", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "LimitRange",
          metadata: { name: "defaults" },
          spec: {
            limits: [
              {
                type: "Container",
                defaultRequest: { cpu: "100m", memory: "64Mi" },
              },
            ],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "existing", labels: { app: "existing" } },
          spec: { nodeName: "node-1", containers: [{ name: "app", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.40",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "ResourceQuota",
          metadata: { name: "small" },
          spec: { hard: { pods: "1", "requests.cpu": "1" } },
          status: {},
        },
        {
          kind: "Pod",
          metadata: { name: "blocked" },
          spec: { containers: [{ name: "app", image: "nginx" }] },
          status: { phase: "Pending" },
        },
      ],
    });

    engine.step();
    const blocked = engine.store.get<Pod>("Pod", "blocked");
    expect(blocked?.status.message).toContain("exceeded quota");
    expect(engine.execute("kubectl get resourcequota small").output).toContain("pods=2");
    const existing = engine.store.get<Pod>("Pod", "existing");
    expect(existing?.spec.containers[0]?.resources?.requests).toBeUndefined();
  });

  it("reports PodDisruptionBudget allowed disruptions", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web-1", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.41",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "web-2", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.42",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "web-3", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: { phase: "Succeeded" },
        },
        {
          kind: "PodDisruptionBudget",
          metadata: { name: "web" },
          spec: { minAvailable: 2, selector: { app: "web" } },
          status: { currentHealthy: 0, desiredHealthy: 0, disruptionsAllowed: 0 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<KubePodDisruptionBudget>("PodDisruptionBudget", "web")?.status).toEqual(
      { currentHealthy: 2, desiredHealthy: 2, disruptionsAllowed: 0 },
    );
    expect(engine.execute("kubectl get pdb").output).toContain("web");
  });

  it("streams appended logs until follow is stopped", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web" },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: { phase: "Running", podIP: "10.244.0.50" },
          logs: ["one"],
        },
      ],
    });
    const lines: string[] = [];
    const stop = engine.followLogs("kubectl logs web -f", (line) => lines.push(line));
    expect(stop).toBeDefined();
    expect(lines).toEqual(["one"]);

    const pod = engine.store.get<Pod>("Pod", "web");
    expect(pod).toBeDefined();
    if (pod === undefined) {
      return;
    }
    engine.store.upsert({ ...pod, logs: ["one", "two"] });
    engine.step();
    expect(lines).toEqual(["one", "two"]);

    stop?.();
    engine.store.upsert({ ...pod, logs: ["one", "two", "three"] });
    engine.step();
    expect(lines).toEqual(["one", "two"]);
    expect(engine.followLogs("kubectl logs missing -f", () => undefined)).toBeUndefined();
  });

  it("routes TLS Ingress and projects ServiceAccount files", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.80",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "client" },
          spec: {
            nodeName: "node-1",
            serviceAccountName: "bot",
            containers: [{ name: "client", image: "busybox" }],
          },
          status: {
            phase: "Running",
            podIP: "10.244.0.81",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 80 }],
            clusterIP: "10.96.0.80",
          },
        },
        {
          kind: "Ingress",
          metadata: { name: "web" },
          spec: {
            rules: [{ host: "shop.example.com", path: "/", serviceName: "web", servicePort: 80 }],
            tls: [{ hosts: ["shop.example.com"], secretName: "shop-tls" }],
          },
        },
      ],
    });
    expect(engine.execute("kubectl exec client -- curl https://shop.example.com").output).toContain(
      "200",
    );
    expect(
      engine.execute(
        "kubectl exec client -- cat /var/run/secrets/kubernetes.io/serviceaccount/token",
      ).output,
    ).toContain("kubelab-token.default.bot");
  });

  it("enforces restricted Pod Security", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Namespace",
          metadata: {
            name: "restricted",
            labels: { "pod-security.kubernetes.io/enforce": "restricted" },
          },
          status: { phase: "Active" },
        },
        {
          kind: "Pod",
          metadata: { name: "unsafe" },
          spec: { containers: [{ name: "app", image: "nginx" }] },
          status: { phase: "Pending" },
        },
      ],
    });
    engine.execute("kubectl run safe --image=nginx -n restricted");
    engine.step();
    expect(engine.execute("kubectl get pod safe -n restricted").output).toContain("Pending");
    expect(engine.execute("kubectl describe pod safe -n restricted").output).toContain(
      "PodSecurity",
    );
  });

  it("expires old events and reconciles external HPA metrics", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Event",
          metadata: { name: "old" },
          type: "Warning",
          reason: "Old",
          message: "old event",
          involvedObject: { kind: "Pod", name: "web", namespace: "default" },
        },
        {
          kind: "Deployment",
          metadata: { name: "web" },
          spec: {
            replicas: 2,
            template: { labels: { app: "web" }, containers: [{ name: "web", image: "nginx" }] },
          },
          status: { replicas: 2, readyReplicas: 2, updatedReplicas: 2, availableReplicas: 2 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "web" },
          spec: {
            minReplicas: 1,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "web" },
            metrics: [
              {
                type: "External",
                metric: { name: "queue" },
                target: { type: "AverageValue", averageValue: "10" },
              },
            ],
          },
          status: { currentReplicas: 2, desiredReplicas: 1, currentExternalMetric: 20 },
        },
      ],
    });
    const old = engine.store.get("Event", "old");
    expect(old).toBeDefined();
    if (old !== undefined) {
      engine.store.upsert({ ...old, metadata: { ...old.metadata, creationTick: -400 } });
    }
    expect(engine.execute("kubectl get events").output).not.toContain("old event");
    engine.step();
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(4);
    expect(engine.execute("kubectl get hpa web").output).toContain("external: 20/10");
  });

  it("renders Kustomize patches, applies Helm charts, syncs Argo, and reconciles Widgets", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "base/deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    labels:
      app: web
    containers:
      - name: web
        image: nginx
`,
        "base/kustomization.yaml": `resources:
  - deployment.yaml
patchesStrategicMerge:
  - patch.yaml
`,
        "base/patch.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 3
`,
        "charts/web.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: chart-web
spec:
  replicas: 1
  template:
    labels:
      app: chart-web
    containers:
      - name: web
        image: nginx
`,
      },
      objects: [
        {
          kind: "Application",
          metadata: { name: "web" },
          source: { repoURL: "https://example.com/repo", path: "charts/web.yaml" },
          destination: { namespace: "default" },
          syncStatus: "OutOfSync",
          healthStatus: "Degraded",
        },
        {
          kind: "Widget",
          metadata: { name: "demo" },
          spec: { size: 2, color: "green" },
          status: { phase: "Ready" },
        },
      ],
    });

    expect(engine.execute("kubectl kustomize base").output).toContain("replicas: 3");
    expect(engine.execute("helm install web charts/web.yaml").ok).toBe(true);
    expect(engine.execute("kubectl get deployment chart-web").ok).toBe(true);
    expect(engine.execute("argocd app sync web").ok).toBe(true);
    engine.step();
    engine.step();
    expect(engine.execute("kubectl get deployment chart-web").output).toContain("1/1");
    expect(engine.execute("kubectl get configmap demo-config").ok).toBe(true);
    const widget = engine.store.get<KubeWidget>("Widget", "demo");
    expect(widget).toBeDefined();
    if (widget !== undefined) {
      engine.store.upsert({ ...widget, spec: { ...widget.spec, color: "blue" } });
      engine.step();
      expect(engine.execute("kubectl get configmap demo-config -o yaml").output).toContain(
        "color: blue",
      );
    }
  });

  it("gates readiness on startup probes and delays scale-down", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "api" },
          spec: {
            nodeName: "node-1",
            containers: [
              {
                name: "api",
                image: "api",
                startupProbe: { grpc: { port: 9000 }, periodSeconds: 1, failureThreshold: 1 },
                simulator: { probeStatus: { startup: 500 } },
              },
            ],
          },
          status: {
            phase: "Running",
            podIP: "10.244.0.90",
            conditions: [{ type: "Ready", status: "False" }],
            containerStatuses: [{ name: "api", ready: false, restartCount: 0, state: "running" }],
          },
        },
        {
          kind: "Deployment",
          metadata: { name: "steady" },
          spec: {
            replicas: 4,
            template: {
              labels: { app: "steady" },
              containers: [{ name: "steady", image: "nginx" }],
            },
          },
          status: { replicas: 4, readyReplicas: 4, updatedReplicas: 4, availableReplicas: 4 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "steady" },
          spec: {
            minReplicas: 1,
            maxReplicas: 8,
            scaleTargetRef: { kind: "Deployment", name: "steady" },
            metrics: [
              {
                type: "Resource",
                resource: { name: "cpu", target: { type: "Utilization", averageUtilization: 50 } },
              },
            ],
            behavior: { scaleDown: { stabilizationWindowSeconds: 60 } },
          },
          status: { currentReplicas: 4, desiredReplicas: 1, currentCPUUtilization: 20 },
        },
      ],
    });

    engine.step();
    expect(engine.store.get<Pod>("Pod", "api")?.status.containerStatuses?.[0]?.reason).toBe(
      "StartupProbeFailed",
    );
    expect(engine.store.get<KubeDeployment>("Deployment", "steady")?.spec.replicas).toBe(4);

    const pod = engine.store.get<Pod>("Pod", "api");
    expect(pod).toBeDefined();
    if (pod === undefined) {
      return;
    }
    engine.store.upsert({
      ...pod,
      spec: {
        ...pod.spec,
        containers: pod.spec.containers.map((container) => ({
          ...container,
          simulator: { probeStatus: { startup: 200 } },
        })),
      },
    });
    engine.step();
    expect(engine.store.get<Pod>("Pod", "api")?.status.containerStatuses?.[0]?.ready).toBe(true);
  });

  it("applies comma-separated files and directory manifests", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "a.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    labels:
      app: web
    containers:
      - name: nginx
        image: nginx
`,
        "manifests/b.yaml": `apiVersion: v1
kind: ConfigMap
metadata:
  name: settings
data:
  mode: prod
`,
        "manifests/c.yaml": `apiVersion: v1
kind: Service
metadata:
  name: web
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 80
`,
      },
    });

    expect(engine.execute("kubectl apply -f a.yaml,manifests").ok).toBe(true);
    expect(engine.store.get<KubeDeployment>("Deployment", "web")).toBeDefined();
    expect(engine.execute("kubectl get configmap settings").ok).toBe(true);
    expect(engine.execute("kubectl get service web").ok).toBe(true);
  });

  it("allows only matching NetworkPolicy peers and enforces egress", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.10",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "client", labels: { app: "client" } },
          spec: { nodeName: "node-1", containers: [{ name: "client", image: "busybox" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.11",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "intruder", labels: { app: "intruder" } },
          spec: { nodeName: "node-1", containers: [{ name: "intruder", image: "busybox" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.12",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 80 }],
            clusterIP: "10.96.0.10",
          },
        },
        {
          kind: "NetworkPolicy",
          metadata: { name: "allow-client" },
          spec: {
            podSelector: { app: "web" },
            policyTypes: ["Ingress"],
            ingress: [{ from: [{ podSelector: { app: "client" } }] }],
          },
        },
        {
          kind: "NetworkPolicy",
          metadata: { name: "client-egress" },
          spec: {
            podSelector: { app: "client" },
            policyTypes: ["Egress"],
            egress: [{ to: [{ podSelector: { app: "web" } }] }],
          },
        },
      ],
    });

    expect(engine.execute("kubectl exec client -- curl http://web").output).toContain("200");
    expect(engine.execute("kubectl exec intruder -- curl http://web").output).toContain("403");
  });

  it("enforces NetworkPolicy port rules", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.20",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "client", labels: { app: "client" } },
          spec: { nodeName: "node-1", containers: [{ name: "client", image: "busybox" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.21",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Service",
          metadata: { name: "web" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 8080 }],
            clusterIP: "10.96.0.20",
          },
        },
        {
          kind: "NetworkPolicy",
          metadata: { name: "allow-web" },
          spec: {
            podSelector: { app: "web" },
            policyTypes: ["Ingress"],
            ingress: [{ from: [{ podSelector: { app: "client" } }], ports: [{ port: 8080 }] }],
          },
        },
      ],
    });

    expect(engine.execute("kubectl exec client -- curl http://web").output).toContain("403");

    const policy = engine.store.get<KubeNetworkPolicy>("NetworkPolicy", "allow-web");
    expect(policy).toBeDefined();
    if (policy !== undefined) {
      engine.store.upsert({
        ...policy,
        spec: {
          ...policy.spec,
          ingress: [{ from: [{ podSelector: { app: "client" } }], ports: [{ port: 80 }] }],
        },
      });
    }

    expect(engine.execute("kubectl exec client -- curl http://web").output).toContain("200");
  });

  it("resolves headless Services to Pod IPs and renders NodePorts", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "web", labels: { app: "web" } },
          spec: { nodeName: "node-1", containers: [{ name: "web", image: "nginx" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.30",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Pod",
          metadata: { name: "client", labels: { app: "client" } },
          spec: { nodeName: "node-1", containers: [{ name: "client", image: "busybox" }] },
          status: {
            phase: "Running",
            podIP: "10.244.0.31",
            conditions: [{ type: "Ready", status: "True" }],
          },
        },
        {
          kind: "Service",
          metadata: { name: "headless" },
          spec: {
            type: "ClusterIP",
            selector: { app: "web" },
            ports: [{ port: 80, targetPort: 8080 }],
            clusterIP: "None",
          },
        },
      ],
    });

    expect(engine.execute("kubectl exec client -- getent hosts headless").output).toContain(
      "10.244.0.30",
    );
    expect(engine.execute("kubectl get service headless").output).toContain("<none>");

    engine.execute("kubectl create deployment api --image=nginx");
    expect(engine.execute("kubectl expose deployment api --port=80 --type=NodePort").ok).toBe(true);
    expect(engine.execute("kubectl get services api").output).toMatch(/80:3000\d/);
  });

  it("handles PVC reclaim policies and delayed binding", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "StorageClass",
          metadata: { name: "wait" },
          provisioner: "ebs.csi.aws.com",
          reclaimPolicy: "Retain",
          volumeBindingMode: "WaitForFirstConsumer",
        },
        {
          kind: "PersistentVolumeClaim",
          metadata: { name: "data" },
          spec: {
            accessModes: ["ReadWriteOnce"],
            resources: { requests: { storage: "2Gi" } },
            storageClassName: "wait",
          },
          status: { phase: "Pending" },
        },
      ],
    });

    engine.step();
    expect(
      engine.store.get<KubePersistentVolumeClaim>("PersistentVolumeClaim", "data")?.status.phase,
    ).toBe("Pending");

    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "Pod",
          metadata: { name: "consumer" },
          spec: {
            nodeName: "node-1",
            containers: [{ name: "app", image: "busybox" }],
            volumes: [{ name: "data", persistentVolumeClaim: { claimName: "data" } }],
          },
          status: { phase: "Pending" },
        },
      ],
    });
    engine.step();
    expect(
      engine.store.get<KubePersistentVolumeClaim>("PersistentVolumeClaim", "data")?.status.phase,
    ).toBe("Bound");

    expect(engine.execute("kubectl delete pvc data").ok).toBe(true);
    const volumes = engine.store.list<KubePersistentVolume>("PersistentVolume");
    expect(volumes).toHaveLength(1);
    expect(volumes[0]?.status.phase).toBe("Released");
  });

  it("supports cluster-scoped RBAC", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      objects: [
        {
          kind: "ClusterRole",
          metadata: { name: "pod-reader" },
          rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] }],
        },
        {
          kind: "ClusterRoleBinding",
          metadata: { name: "read-pods" },
          roleRef: { kind: "ClusterRole", name: "pod-reader" },
          subjects: [{ kind: "ServiceAccount", name: "deploy-bot", namespace: "default" }],
        },
      ],
    });

    expect(engine.execute("kubectl get clusterroles").output).toContain("pod-reader");
    expect(engine.execute("kubectl get clusterrolebindings").output).toContain("read-pods");
    expect(
      engine.execute("kubectl auth can-i list pods --as=system:serviceaccount:default:deploy-bot")
        .output,
    ).toBe("yes");
    expect(
      engine.execute("kubectl auth can-i delete pods --as=system:serviceaccount:default:deploy-bot")
        .output,
    ).toBe("no");
  });

  it("applies manifests from seeded files and Kustomize paths", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 2
  template:
    labels:
      app: web
    containers:
      - name: nginx
        image: nginx
`,
        "overlays/prod": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: prod-web
spec:
  replicas: 1
  template:
    labels:
      app: prod-web
    containers:
      - name: nginx
        image: nginx:1.27
`,
      },
    });

    expect(engine.execute("kubectl apply -f deployment.yaml").ok).toBe(true);
    expect(engine.store.get<KubeDeployment>("Deployment", "web")?.spec.replicas).toBe(2);
    engine.step();
    expect(engine.store.list<Pod>("Pod", "default")).toHaveLength(2);

    expect(engine.execute("kubectl apply -k overlays/prod").ok).toBe(true);
    expect(engine.store.get<KubeDeployment>("Deployment", "prod-web")?.spec.replicas).toBe(1);
    expect(engine.execute("kubectl describe deployment prod-web").output).toContain("nginx:1.27");
  });

  it("normalizes standard Ingress manifests on apply", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "ingress.yaml": `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: web
                port:
                  number: 80
`,
      },
    });

    expect(engine.execute("kubectl apply -f ingress.yaml").ok).toBe(true);
    const listed = engine.execute("kubectl get ingress shop");
    expect(listed.output).toContain("shop.example.com");
    expect(listed.output).toContain("80");
  });

  it("normalizes standard envFrom references on apply", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: api
spec:
  replicas: 1
  template:
    labels:
      app: api
    containers:
      - name: api
        image: nginx
        envFrom:
          - configMapRef:
              name: app-config
`,
      },
    });

    expect(engine.execute("kubectl apply -f deployment.yaml").ok).toBe(true);
    expect(
      engine.store.get<KubeDeployment>("Deployment", "api")?.spec.template.containers[0]?.envFrom,
    ).toEqual([{ kind: "ConfigMap", name: "app-config" }]);
  });

  it("normalizes standard Deployment pod templates on apply", () => {
    const engine = createEngine();
    engine.seed({
      nodes: [],
      files: {
        "deployment.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
spec:
  replicas: 1
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: nginx
`,
      },
    });

    expect(engine.execute("kubectl apply -f deployment.yaml").ok).toBe(true);
    const deployment = engine.store.get<KubeDeployment>("Deployment", "web");
    expect(deployment?.spec.template.labels.app).toBe("web");
    expect(deployment?.spec.template.containers[0]?.image).toBe("nginx");
    engine.step();
    expect(engine.store.list<Pod>("Pod", "default")).toHaveLength(1);
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
