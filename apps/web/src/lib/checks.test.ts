import { getLesson, type LessonCheck } from "@kubelab/content";
import {
  type KubeConfigMap,
  type KubeDeployment,
  type KubeIngress,
  type KubeSecret,
  type KubeService,
  type ParsedCommand,
  type Pod,
  type PodPhase,
  parseKubectl,
  SimEngine,
} from "@kubelab/sim";
import { describe, expect, it } from "vitest";

import { type CheckContext, evaluateCheck, evaluateChecks } from "./checks";

type PodCheck = Extract<LessonCheck, { type: "pod" }>;

function makePod(
  overrides: {
    name?: string;
    namespace?: string;
    image?: string;
    labels?: Record<string, string>;
    phase?: PodPhase;
  } = {},
): Pod {
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: overrides.name ?? "web",
      namespace: overrides.namespace ?? "default",
      labels: overrides.labels ?? { app: "web" },
      uid: "pod-1",
      resourceVersion: 1,
      creationTick: 0,
    },
    spec: {
      containers: [{ name: "web", image: overrides.image ?? "nginx" }],
    },
    status: {
      phase: overrides.phase ?? "Running",
    },
  };
}

function makeCheck(overrides: Partial<PodCheck> = {}): PodCheck {
  return {
    type: "pod",
    label: "web is ready",
    namespace: "default",
    name: "web",
    labels: {},
    ...overrides,
  };
}

function makeDeployment(overrides: { replicas?: number; image?: string } = {}): KubeDeployment {
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: "web",
      namespace: "default",
      labels: { app: "web" },
      uid: "deployment-1",
      resourceVersion: 1,
      creationTick: 0,
    },
    spec: {
      replicas: overrides.replicas ?? 3,
      template: {
        labels: { app: "web" },
        containers: [{ name: "nginx", image: overrides.image ?? "nginx" }],
      },
    },
    status: { replicas: 3, readyReplicas: 3, updatedReplicas: 3, availableReplicas: 3 },
  };
}

function makeService(): KubeService {
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: "web",
      namespace: "default",
      labels: { app: "web" },
      uid: "service-1",
      resourceVersion: 1,
      creationTick: 0,
    },
    spec: {
      type: "ClusterIP",
      selector: { app: "web" },
      ports: [{ port: 80, targetPort: 80 }],
      clusterIP: "10.96.0.1",
    },
  };
}

function makeIngress(): KubeIngress {
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: "web",
      namespace: "demo",
      labels: { app: "web" },
      uid: "ingress-1",
      resourceVersion: 1,
      creationTick: 0,
    },
    spec: {
      ingressClassName: "nginx",
      rules: [
        {
          host: "shop.example.com",
          path: "/",
          serviceName: "web",
          servicePort: 80,
        },
      ],
    },
  };
}

function command(input: string): ParsedCommand {
  const parsed = parseKubectl(input);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }
  return parsed;
}

function context(pods: Pod[] = [], commands: ParsedCommand[] = []): CheckContext {
  return { pods, commands };
}

describe("lesson checks", () => {
  it("passes when the pod matches name, namespace, labels, and phase", () => {
    const result = evaluateCheck(
      makeCheck({ labels: { app: "web" }, phase: "Running" }),
      context([makePod()]),
    );
    expect(result.pass).toBe(true);
  });

  it("fails on a missing label", () => {
    expect(evaluateCheck(makeCheck({ labels: { app: "api" } }), context([makePod()])).pass).toBe(
      false,
    );
  });

  it("fails on the wrong phase", () => {
    expect(
      evaluateCheck(makeCheck({ phase: "Running" }), context([makePod({ phase: "Pending" })])).pass,
    ).toBe(false);
  });

  it("fails on a namespace mismatch", () => {
    expect(evaluateCheck(makeCheck({ namespace: "other" }), context([makePod()])).pass).toBe(false);
  });

  it("passes a command check for the executed command", () => {
    const check: LessonCheck = {
      type: "command",
      label: "Run kubectl get pods",
      verb: "get",
      resource: "pods",
      namespace: "default",
    };

    expect(evaluateCheck(check, context([], [command("kubectl get pods")])).pass).toBe(true);
    expect(evaluateCheck(check, context([], [command("kubectl get nodes")])).pass).toBe(false);
  });

  it("requires the correct quiz answer", () => {
    const lesson = getLesson("containers-101");
    const quizCheck = lesson?.checks.find((check) => check.type === "quiz");
    expect(quizCheck).toBeDefined();
    if (quizCheck === undefined || quizCheck.type !== "quiz") {
      return;
    }

    expect(evaluateCheck(quizCheck, { pods: [], commands: [], answers: {} }).pass).toBe(false);
    expect(
      evaluateCheck(quizCheck, {
        pods: [],
        commands: [],
        answers: { [quizCheck.id]: quizCheck.answer },
      }).pass,
    ).toBe(true);
  });

  it("uses the real lesson checks against a mistyped label", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const results = evaluateChecks(
      lesson.checks,
      context([makePod({ labels: { run: "web", app: "webb" } })]),
    );

    expect(results.map((result) => result.pass)).toEqual([true, false, true, true, false]);
  });

  it("fails the real image check for a different image", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const results = evaluateChecks(
      lesson.checks,
      context([makePod({ image: "httpd", labels: { run: "web", app: "web" } })]),
    );

    expect(results.map((result) => result.pass)).toEqual([true, true, false, true, false]);
  });

  it("checks Deployment replicas, image, and labels", () => {
    const check: LessonCheck = {
      type: "deployment",
      label: "web rollout",
      namespace: "default",
      name: "web",
      replicas: 3,
      image: "nginx",
      ready: true,
      labels: { app: "web" },
    };

    expect(
      evaluateCheck(check, { pods: [], commands: [], deployments: [makeDeployment()] }).pass,
    ).toBe(true);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        deployments: [makeDeployment({ replicas: 2 })],
      }).pass,
    ).toBe(false);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        deployments: [makeDeployment({ image: "httpd" })],
      }).pass,
    ).toBe(false);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        deployments: [
          {
            ...makeDeployment(),
            status: { replicas: 3, readyReplicas: 2, updatedReplicas: 3, availableReplicas: 2 },
          },
        ],
      }).pass,
    ).toBe(false);
  });

  it("matches command actions and parameters", () => {
    const check: LessonCheck = {
      type: "command",
      label: "Rollout checked",
      verb: "rollout",
      resource: "deployments",
      name: "web",
      action: "status",
      namespace: "default",
    };

    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [command("kubectl rollout status deployment/web")],
      }).pass,
    ).toBe(true);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [command("kubectl rollout undo deployment/web")],
      }).pass,
    ).toBe(false);
  });

  it("matches auth command parameters", () => {
    const check: LessonCheck = {
      type: "command",
      label: "Can read Pods",
      verb: "auth",
      namespace: "default",
      subjectVerb: "get",
      subjectResource: "pods",
      as: "system:serviceaccount:default:deploy-bot",
    };

    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [
          command("kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot"),
        ],
      }).pass,
    ).toBe(true);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [command("kubectl auth can-i delete pods")],
      }).pass,
    ).toBe(false);
  });

  it("checks Service type and port", () => {
    const check: LessonCheck = {
      type: "service",
      label: "web Service",
      namespace: "default",
      name: "web",
      serviceType: "ClusterIP",
      port: 80,
    };

    expect(evaluateCheck(check, { pods: [], commands: [], services: [makeService()] }).pass).toBe(
      true,
    );
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        services: [{ ...makeService(), spec: { ...makeService().spec, type: "NodePort" } }],
      }).pass,
    ).toBe(false);
  });

  it("requires the verification command for a complete lesson", () => {
    const lesson = getLesson("pods-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const pods = [makePod({ labels: { run: "web", app: "web" } })];
    const withoutCommand = evaluateChecks(lesson.checks, context(pods));
    expect(withoutCommand.every((result) => result.pass)).toBe(false);

    const withCommand = evaluateChecks(lesson.checks, context(pods, [command("kubectl get pods")]));
    expect(withCommand.every((result) => result.pass)).toBe(true);
  });

  it("checks Ingress host, path, and backend", () => {
    const check: LessonCheck = {
      type: "ingress",
      label: "shop route",
      namespace: "demo",
      name: "web",
      host: "shop.example.com",
      path: "/",
      serviceName: "web",
      servicePort: 80,
    };

    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        ingresses: [makeIngress()],
      }).pass,
    ).toBe(true);
    expect(
      evaluateCheck(check, {
        pods: [],
        commands: [],
        ingresses: [
          {
            ...makeIngress(),
            spec: {
              rules: [
                {
                  host: "other.example.com",
                  path: "/",
                  serviceName: "web",
                  servicePort: 80,
                },
              ],
            },
          },
        ],
      }).pass,
    ).toBe(false);
  });
});

describe("lesson completability", () => {
  function engine(): SimEngine {
    const instance = new SimEngine({ intervalMs: 1_000 });
    instance.seed({ nodes: [{ name: "node-1" }] });
    return instance;
  }

  it("completes the deployment lesson with its documented commands", () => {
    const lesson = getLesson("deployments-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute("kubectl create deployment web --image=nginx --replicas=3");
    sim.execute("kubectl scale deployment web --replicas=5");
    sim.execute("kubectl set image deployment/web nginx=nginx:1.27");
    sim.execute("kubectl rollout status deployment/web");

    const beforeRollout = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      commands: sim.commands,
      answers: { q1: 0 },
    });
    expect(
      beforeRollout.find((result) => result.label === "Deployment scaled and updated")?.pass,
    ).toBe(false);

    sim.step();
    sim.step();

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      commands: sim.commands,
      answers: { q1: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("completes the service lesson with its documented commands", () => {
    const lesson = getLesson("services-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute("kubectl create deployment web --image=nginx --replicas=2");
    sim.execute("kubectl expose deployment web --port=80");
    sim.step();
    sim.step();

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      commands: sim.commands,
      answers: { q1: 0, q2: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("completes the DNS lesson with its documented commands", () => {
    const lesson = getLesson("dns-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute("kubectl create deployment web --image=nginx --replicas=2 -n demo");
    sim.execute("kubectl expose deployment web --port=80 -n demo");
    sim.execute("kubectl run client --image=busybox -n demo");
    sim.step();
    sim.step();
    const lookup = sim.execute("kubectl exec client -n demo -- nslookup web");
    expect(lookup.ok).toBe(true);

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      ingresses: sim.store.list<KubeIngress>("Ingress"),
      commands: sim.commands,
      answers: { q1: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("completes the Ingress lesson with its documented commands", () => {
    const lesson = getLesson("ingress-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute("kubectl create deployment web --image=nginx --replicas=2 -n demo");
    sim.execute("kubectl expose deployment web --port=80 -n demo");
    sim.execute("kubectl run client --image=busybox -n demo");
    sim.step();
    sim.step();
    sim.execute("kubectl create ingress web --rule=shop.example.com/=web:80 -n demo");
    const request = sim.execute(
      'kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/',
    );
    expect(request.ok).toBe(true);

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      ingresses: sim.store.list<KubeIngress>("Ingress"),
      commands: sim.commands,
      answers: { q1: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("completes the ConfigMap lesson with its documented commands", () => {
    const lesson = getLesson("configmaps-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute(
      "kubectl create configmap app-config --from-literal=APP_MODE=production --from-literal=LOG_LEVEL=debug",
    );
    sim.execute("kubectl create deployment web --image=nginx --replicas=2");
    sim.execute("kubectl set env deployment/web --from=configmap/app-config");
    sim.step();
    sim.step();

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      ingresses: sim.store.list<KubeIngress>("Ingress"),
      configMaps: sim.store.list<KubeConfigMap>("ConfigMap"),
      secrets: sim.store.list<KubeSecret>("Secret"),
      commands: sim.commands,
      answers: { q1: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });

  it("completes the Secret lesson with its documented commands", () => {
    const lesson = getLesson("secrets-101");
    expect(lesson).toBeDefined();
    if (lesson === undefined) {
      return;
    }

    const sim = engine();
    sim.execute("kubectl create secret generic db-secret --from-literal=DB_PASSWORD=s3cr3t");
    sim.execute("kubectl create deployment api --image=nginx --replicas=1");
    sim.execute("kubectl set env deployment/api --from=secret/db-secret");
    sim.step();
    sim.step();

    const results = evaluateChecks(lesson.checks, {
      pods: sim.store.list<Pod>("Pod"),
      deployments: sim.store.list<KubeDeployment>("Deployment"),
      services: sim.store.list<KubeService>("Service"),
      ingresses: sim.store.list<KubeIngress>("Ingress"),
      configMaps: sim.store.list<KubeConfigMap>("ConfigMap"),
      secrets: sim.store.list<KubeSecret>("Secret"),
      commands: sim.commands,
      answers: { q1: 0 },
    });

    expect(results.filter((result) => !result.pass)).toEqual([]);
  });
});
