import type { LessonSpec } from "./schema";

export interface CertificationTaskSeed {
  id: string;
  title: string;
  unit: string;
  instruction: string;
  scenario: LessonSpec["scenario"];
  checks: Array<Record<string, unknown>>;
}

const node = { name: "node-1", cpu: "4", memory: "8Gi" };
const scenario = (
  files: Record<string, string> = {},
  objects: unknown[] = [],
  nodes: LessonSpec["scenario"]["nodes"] = [node],
): LessonSpec["scenario"] => ({
  nodes,
  objects: objects as LessonSpec["scenario"]["objects"],
  files,
});

const get = (label: string, resource: string, name?: string): Record<string, unknown> => ({
  type: "command",
  label,
  verb: "get",
  resource,
  ...(name === undefined ? {} : { name }),
});

const describe = (label: string, resource: string, name: string): Record<string, unknown> => ({
  type: "command",
  label,
  verb: "describe",
  resource,
  name,
});

const deploymentManifest = (
  name: string,
  replicas: number,
  image = "nginx",
): string => `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
spec:
  replicas: ${replicas}
  template:
    labels:
      app: ${name}
    containers:
      - name: ${name}
        image: ${image}
`;

const serviceManifest = (name: string): string => `apiVersion: v1
kind: Service
metadata:
  name: ${name}
spec:
  selector:
    app: ${name}
  ports:
    - port: 80
      targetPort: 80
`;

const pod = (name: string, labels: Record<string, string>, ip: string, ready = true): unknown => ({
  kind: "Pod",
  metadata: { name, labels },
  spec: { nodeName: "node-1", containers: [{ name, image: "nginx" }] },
  status: {
    phase: "Running",
    podIP: ip,
    conditions: [{ type: "Ready", status: ready ? "True" : "False" }],
  },
});

const service = (name: string, selector: Record<string, string>, ip: string): unknown => ({
  kind: "Service",
  metadata: { name },
  spec: { type: "ClusterIP", selector, ports: [{ port: 80, targetPort: 80 }], clusterIP: ip },
});

export const certificationTaskSeeds: Record<string, CertificationTaskSeed[]> = {
  kcna: [
    {
      id: "kcna-pod",
      title: "Create a Pod",
      unit: "workloads",
      instruction: "Create Pod web from nginx with label app=web, then verify it is Running.",
      scenario: scenario(),
      checks: [
        {
          type: "pod",
          label: "Running web Pod",
          name: "web",
          image: "nginx",
          labels: { app: "web" },
          phase: "Running",
        },
        get("Verified the Pod", "pods", "web"),
      ],
    },
    {
      id: "kcna-service",
      title: "Deployment and Service",
      unit: "services",
      instruction: "Apply the manifests, then verify the Deployment and Service.",
      scenario: scenario({
        "manifests.yaml": `${deploymentManifest("web", 2)}---\n${serviceManifest("web")}`,
      }),
      checks: [
        { type: "deployment", label: "Two web replicas", name: "web", replicas: 2, image: "nginx" },
        { type: "service", label: "Web Service", name: "web", port: 80 },
      ],
    },
    {
      id: "kcna-scale",
      title: "Scale and update",
      unit: "workloads",
      instruction:
        "Scale web to four replicas, update the image to nginx:1.27, and check the rollout.",
      scenario: scenario({ "deployment.yaml": deploymentManifest("web", 2) }),
      checks: [
        {
          type: "deployment",
          label: "Four updated replicas",
          name: "web",
          replicas: 4,
          image: "nginx:1.27",
        },
        {
          type: "command",
          label: "Checked the rollout",
          verb: "rollout",
          action: "status",
          resource: "deployments",
          name: "web",
        },
      ],
    },
    {
      id: "kcna-config",
      title: "ConfigMap and Secret",
      unit: "config",
      instruction: "Apply the configuration objects and verify their data.",
      scenario: scenario({
        "config.yaml": `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  MODE: prod
---
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
stringData:
  password: s3cret
`,
      }),
      checks: [
        { type: "configmap", label: "ConfigMap data", name: "app-config", data: { MODE: "prod" } },
        { type: "secret", label: "Secret key", name: "db-secret", keys: ["password"] },
      ],
    },
    {
      id: "kcna-observe",
      title: "Logs and events",
      unit: "observability",
      instruction: "Read the web Pod logs and inspect recent events.",
      scenario: scenario({}, [
        { ...(pod("web", { app: "web" }, "10.244.0.120") as object), logs: ["listening on :80"] },
        {
          kind: "Event",
          metadata: { name: "web-started" },
          type: "Normal",
          reason: "Started",
          message: "Started container web",
          involvedObject: { kind: "Pod", name: "web", namespace: "default" },
        },
      ]),
      checks: [
        { type: "command", label: "Read the logs", verb: "logs", name: "web" },
        get("Listed events", "events"),
      ],
    },
  ],
  kcsa: [
    {
      id: "kcsa-rbac",
      title: "Inspect RBAC",
      unit: "security",
      instruction: "Inspect deploy-bot permissions and verify read access.",
      scenario: scenario({}, [
        { kind: "ServiceAccount", metadata: { name: "deploy-bot" } },
        {
          kind: "Role",
          metadata: { name: "pod-reader" },
          rules: [{ apiGroups: [""], resources: ["pods"], verbs: ["get", "list"] }],
        },
        {
          kind: "RoleBinding",
          metadata: { name: "read-pods" },
          roleRef: { kind: "Role", name: "pod-reader" },
          subjects: [{ kind: "ServiceAccount", name: "deploy-bot" }],
        },
      ]),
      checks: [
        get("Listed Roles", "roles"),
        {
          type: "command",
          label: "Tested access",
          verb: "auth",
          subjectVerb: "list",
          subjectResource: "pods",
          as: "system:serviceaccount:default:deploy-bot",
        },
      ],
    },
    {
      id: "kcsa-netpol",
      title: "Inspect NetworkPolicy",
      unit: "networking",
      instruction: "Inspect the default-deny NetworkPolicy and the Pods it selects.",
      scenario: scenario({}, [
        pod("web", { app: "web" }, "10.244.0.121"),
        {
          kind: "NetworkPolicy",
          metadata: { name: "deny-all" },
          spec: { podSelector: {}, policyTypes: ["Ingress"], ingress: [] },
        },
      ]),
      checks: [
        get("Listed the policy", "networkpolicies"),
        describe("Described the policy", "networkpolicies", "deny-all"),
      ],
    },
    {
      id: "kcsa-psa",
      title: "Inspect Pod security",
      unit: "security",
      instruction: "Inspect the restricted Namespace labels and the hardened Pod.",
      scenario: scenario({}, [
        {
          kind: "Namespace",
          metadata: {
            name: "restricted",
            labels: { "pod-security.kubernetes.io/enforce": "restricted" },
          },
          status: { phase: "Active" },
        },
        {
          ...(pod("web", { app: "web" }, "10.244.0.122") as Record<string, unknown>),
          metadata: { name: "web", labels: { app: "web" }, namespace: "restricted" },
          spec: {
            nodeName: "node-1",
            securityContext: { runAsNonRoot: true },
            containers: [
              { name: "web", image: "nginx", securityContext: { allowPrivilegeEscalation: false } },
            ],
          },
        },
      ]),
      checks: [
        get("Listed the Namespace", "namespaces", "restricted"),
        describe("Inspected the Pod", "pods", "web"),
      ],
    },
    {
      id: "kcsa-secret",
      title: "Inspect a Secret",
      unit: "config",
      instruction: "Inspect the Secret keys and verify the consuming Deployment.",
      scenario: scenario({}, [
        {
          kind: "Secret",
          metadata: { name: "db-secret" },
          type: "Opaque",
          data: { password: "czNjcmV0" },
        },
        {
          kind: "Deployment",
          metadata: { name: "api" },
          spec: {
            replicas: 1,
            template: {
              labels: { app: "api" },
              containers: [
                { name: "api", image: "nginx", envFrom: [{ kind: "Secret", name: "db-secret" }] },
              ],
            },
          },
          status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
        },
      ]),
      checks: [
        get("Listed the Secret", "secrets", "db-secret"),
        describe("Inspected the Deployment", "deployments", "api"),
      ],
    },
    {
      id: "kcsa-tls",
      title: "Inspect TLS routing",
      unit: "services",
      instruction: "Inspect the TLS Ingress and test HTTPS routing.",
      scenario: scenario({}, [
        pod("web", { app: "web" }, "10.244.0.123"),
        pod("client", {}, "10.244.0.124"),
        service("web", { app: "web" }, "10.96.0.123"),
        {
          kind: "Ingress",
          metadata: { name: "shop" },
          spec: {
            rules: [{ host: "shop.example.com", path: "/", serviceName: "web", servicePort: 80 }],
            tls: [{ hosts: ["shop.example.com"], secretName: "shop-tls" }],
          },
        },
      ]),
      checks: [
        get("Listed the Ingress", "ingresses", "shop"),
        { type: "command", label: "Tested HTTPS", verb: "exec", name: "client", command: "curl" },
      ],
    },
  ],
  cka: [
    {
      id: "cka-rollout",
      title: "Rolling update",
      unit: "workloads",
      instruction: "Scale web to four, update to nginx:1.27, and verify the rollout.",
      scenario: scenario({ "deployment.yaml": deploymentManifest("web", 2) }),
      checks: [
        {
          type: "deployment",
          label: "Four updated replicas",
          name: "web",
          replicas: 4,
          image: "nginx:1.27",
        },
        {
          type: "command",
          label: "Rollout status",
          verb: "rollout",
          action: "status",
          resource: "deployments",
          name: "web",
        },
      ],
    },
    {
      id: "cka-affinity",
      title: "Placement constraints",
      unit: "scheduling",
      instruction: "Apply the Pod and verify where required affinity schedules it.",
      scenario: scenario(
        {
          "pod.yaml": `apiVersion: v1
kind: Pod
metadata:
  name: web
spec:
  affinity:
    nodeAffinity:
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
          - matchExpressions:
              - key: topology.kubernetes.io/zone
                operator: In
                values: [b]
  containers:
    - name: web
      image: nginx
`,
        },
        [],
        [
          {
            name: "node-1",
            cpu: "4",
            memory: "8Gi",
            labels: { "topology.kubernetes.io/zone": "a" },
          },
          {
            name: "node-2",
            cpu: "4",
            memory: "8Gi",
            labels: { "topology.kubernetes.io/zone": "b" },
          },
        ],
      ),
      checks: [
        get("Checked the Pod", "pods", "web"),
        describe("Read placement", "pods", "web"),
        get("Listed Nodes", "nodes"),
      ],
    },
    {
      id: "cka-storage",
      title: "Storage binding",
      unit: "storage",
      instruction: "Apply the claim and verify binding through the StorageClass.",
      scenario: scenario(
        {
          "pvc.yaml": `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
spec:
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
  storageClassName: fast
`,
        },
        [
          {
            kind: "StorageClass",
            metadata: { name: "fast" },
            provisioner: "ebs.csi.aws.com",
            reclaimPolicy: "Delete",
            volumeBindingMode: "Immediate",
          },
        ],
      ),
      checks: [
        get("Listed the claim", "persistentvolumeclaims", "data"),
        get("Listed the StorageClass", "storageclasses", "fast"),
      ],
    },
    {
      id: "cka-netpol",
      title: "NetworkPolicy",
      unit: "networking",
      instruction: "Apply the policy and verify the denied Service request.",
      scenario: scenario(
        {
          "netpol.yaml": `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-all
spec:
  podSelector: {}
  policyTypes: [Ingress]
  ingress: []
`,
        },
        [
          pod("web", { app: "web" }, "10.244.0.125"),
          pod("client", {}, "10.244.0.126"),
          service("web", { app: "web" }, "10.96.0.125"),
        ],
      ),
      checks: [
        get("Listed the policy", "networkpolicies", "deny-all"),
        { type: "command", label: "Tested traffic", verb: "exec", name: "client", command: "curl" },
      ],
    },
    {
      id: "cka-probes",
      title: "Probe troubleshooting",
      unit: "observability",
      instruction: "Inspect the failing readiness probe and endpoint state.",
      scenario: scenario({}, [
        {
          ...(pod("web", { app: "web" }, "10.244.0.127", false) as Record<string, unknown>),
          spec: {
            nodeName: "node-1",
            containers: [
              {
                name: "web",
                image: "nginx",
                readinessProbe: {
                  httpGet: { path: "/healthz", port: 80 },
                  periodSeconds: 1,
                  failureThreshold: 1,
                },
                simulator: { probeStatus: { readiness: 500 } },
              },
            ],
          },
        },
        service("web", { app: "web" }, "10.96.0.127"),
      ]),
      checks: [get("Checked the Pod", "pods", "web"), get("Checked endpoints", "endpoints", "web")],
    },
    {
      id: "cka-hpa",
      title: "Autoscaling",
      unit: "scheduling",
      instruction: "Inspect the HPA target and current utilization.",
      scenario: scenario({}, [
        {
          kind: "Deployment",
          metadata: { name: "web" },
          spec: {
            replicas: 3,
            template: {
              labels: { app: "web" },
              containers: [
                { name: "web", image: "nginx", resources: { requests: { cpu: "100m" } } },
              ],
            },
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
            metrics: [
              {
                type: "Resource",
                resource: { name: "cpu", target: { type: "Utilization", averageUtilization: 50 } },
              },
            ],
          },
          status: { currentReplicas: 3, desiredReplicas: 5, currentCPUUtilization: 80 },
        },
      ]),
      checks: [
        get("Listed the HPA", "horizontalpodautoscalers", "web"),
        describe("Read the HPA", "horizontalpodautoscalers", "web"),
      ],
    },
    {
      id: "cka-incident-service",
      title: "Service incident",
      unit: "networking",
      instruction:
        "The web Service has no endpoints. Apply the corrected Deployment and Service, then verify routing from the client.",
      scenario: scenario(
        {
          "fix.yaml": `${deploymentManifest("web", 3, "nginx:1.27")}---
apiVersion: v1
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
        [
          {
            kind: "Deployment",
            metadata: { name: "web" },
            spec: {
              replicas: 2,
              template: {
                labels: { app: "web" },
                containers: [{ name: "web", image: "nginx:1.25" }],
              },
            },
            status: { replicas: 2, readyReplicas: 2, updatedReplicas: 2, availableReplicas: 2 },
          },
          {
            kind: "Service",
            metadata: { name: "web" },
            spec: {
              type: "ClusterIP",
              selector: { app: "old" },
              ports: [{ port: 80, targetPort: 80 }],
              clusterIP: "10.96.0.200",
            },
          },
          {
            kind: "Pod",
            metadata: { name: "client" },
            spec: {
              nodeName: "node-1",
              containers: [{ name: "client", image: "curlimages/curl" }],
            },
            status: {
              phase: "Running",
              podIP: "10.244.0.200",
              conditions: [{ type: "Ready", status: "True" }],
            },
          },
        ],
      ),
      checks: [
        {
          type: "deployment",
          label: "Deployment repaired",
          name: "web",
          replicas: 3,
          image: "nginx:1.27",
        },
        get("Verified endpoints", "endpoints", "web"),
        {
          type: "command",
          label: "Tested the Service",
          verb: "exec",
          name: "client",
          command: "curl",
        },
      ],
    },
    {
      id: "cka-incident-ingress",
      title: "Ingress incident",
      unit: "networking",
      instruction:
        "The shop Ingress has no working backend. Repair the Deployment and Service, then verify HTTPS routing.",
      scenario: scenario(
        {
          "fix.yaml": `${deploymentManifest("web", 2, "nginx:1.27")}---
${serviceManifest("web")}`,
        },
        [
          {
            kind: "Deployment",
            metadata: { name: "web" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "web" },
                containers: [{ name: "web", image: "nginx:1.25" }],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
          {
            kind: "Service",
            metadata: { name: "web" },
            spec: {
              type: "ClusterIP",
              selector: { app: "old" },
              ports: [{ port: 80, targetPort: 80 }],
              clusterIP: "10.96.0.210",
            },
          },
          {
            kind: "Ingress",
            metadata: { name: "shop" },
            spec: {
              rules: [{ host: "shop.example.com", path: "/", serviceName: "web", servicePort: 80 }],
              tls: [{ hosts: ["shop.example.com"], secretName: "shop-tls" }],
            },
          },
          {
            kind: "Pod",
            metadata: { name: "client" },
            spec: {
              nodeName: "node-1",
              containers: [{ name: "client", image: "curlimages/curl" }],
            },
            status: {
              phase: "Running",
              podIP: "10.244.0.211",
              conditions: [{ type: "Ready", status: "True" }],
            },
          },
        ],
      ),
      checks: [
        {
          type: "deployment",
          label: "Deployment repaired",
          name: "web",
          replicas: 2,
          image: "nginx:1.27",
        },
        get("Verified endpoints", "endpoints", "web"),
        { type: "command", label: "Tested HTTPS", verb: "exec", name: "client", command: "curl" },
      ],
    },
    {
      id: "cka-incident-storage",
      title: "Storage incident",
      unit: "storage",
      instruction:
        "The data claim is Pending. Add a matching PersistentVolume, then verify that the consumer Pod runs.",
      scenario: scenario(
        {
          "pv.yaml": `apiVersion: v1
kind: PersistentVolume
metadata:
  name: data-volume
spec:
  capacity:
    storage: 5Gi
  accessModes:
    - ReadWriteOnce
  storageClassName: fast
  reclaimPolicy: Retain
`,
        },
        [
          {
            kind: "StorageClass",
            metadata: { name: "fast" },
            provisioner: "kubernetes.io/no-provisioner",
            reclaimPolicy: "Retain",
            volumeBindingMode: "Immediate",
          },
          {
            kind: "PersistentVolumeClaim",
            metadata: { name: "data" },
            spec: {
              accessModes: ["ReadWriteOnce"],
              resources: { requests: { storage: "5Gi" } },
              storageClassName: "fast",
            },
            status: { phase: "Pending" },
          },
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
      ),
      checks: [
        get("Claim bound", "persistentvolumeclaims", "data"),
        {
          type: "pod",
          label: "Consumer running",
          name: "consumer",
          image: "busybox",
          phase: "Running",
        },
      ],
    },
  ],
  ckad: [
    {
      id: "ckad-config",
      title: "Configuration injection",
      unit: "config",
      instruction: "Apply the ConfigMap and Deployment, then verify the environment injection.",
      scenario: scenario({
        "app.yaml": `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  MODE: prod
---
apiVersion: apps/v1
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
        envFrom:
          - configMapRef:
              name: app-config
`,
      }),
      checks: [
        { type: "configmap", label: "ConfigMap data", name: "app-config", data: { MODE: "prod" } },
        { type: "env", label: "Injected mode", deployment: "web", name: "MODE", value: "prod" },
      ],
    },
    {
      id: "ckad-secret",
      title: "Secret injection",
      unit: "config",
      instruction: "Apply the Secret and Deployment, then verify the injected value.",
      scenario: scenario({
        "app.yaml": `apiVersion: v1
kind: Secret
metadata:
  name: db-secret
stringData:
  password: s3cret
---
apiVersion: apps/v1
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
          - secretRef:
              name: db-secret
`,
      }),
      checks: [
        { type: "secret", label: "Secret keys", name: "db-secret", keys: ["password"] },
        {
          type: "env",
          label: "Injected password",
          deployment: "api",
          name: "password",
          value: "s3cret",
        },
      ],
    },
    {
      id: "ckad-ingress",
      title: "Ingress routing",
      unit: "services",
      instruction: "Apply the Service and Ingress, then test routing.",
      scenario: scenario(
        {
          "web.yaml": `${serviceManifest("web")}---
apiVersion: networking.k8s.io/v1
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
        [pod("web", { app: "web" }, "10.244.0.128"), pod("client", {}, "10.244.0.129")],
      ),
      checks: [
        get("Listed the Ingress", "ingresses", "shop"),
        { type: "command", label: "Tested routing", verb: "exec", name: "client", command: "curl" },
      ],
    },
    {
      id: "ckad-hpa",
      title: "Autoscaling",
      unit: "scheduling",
      instruction: "Inspect the HPA and its target Deployment.",
      scenario: scenario({}, [
        {
          kind: "Deployment",
          metadata: { name: "web" },
          spec: {
            replicas: 2,
            template: {
              labels: { app: "web" },
              containers: [
                { name: "web", image: "nginx", resources: { requests: { memory: "64Mi" } } },
              ],
            },
          },
          status: { replicas: 2, readyReplicas: 2, updatedReplicas: 2, availableReplicas: 2 },
        },
        {
          kind: "HorizontalPodAutoscaler",
          metadata: { name: "web" },
          spec: {
            minReplicas: 1,
            maxReplicas: 6,
            scaleTargetRef: { kind: "Deployment", name: "web" },
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
          status: { currentReplicas: 2, desiredReplicas: 3, currentMemoryUtilization: 150 },
        },
      ]),
      checks: [
        get("Listed the HPA", "horizontalpodautoscalers", "web"),
        describe("Read the HPA", "horizontalpodautoscalers", "web"),
      ],
    },
    {
      id: "ckad-job",
      title: "Batch Job",
      unit: "workloads",
      instruction: "Inspect the Job completion and the Pods it created.",
      scenario: scenario({}, [
        {
          kind: "Job",
          metadata: { name: "migrate" },
          spec: {
            completions: 1,
            parallelism: 1,
            template: {
              labels: { app: "migrate" },
              containers: [{ name: "migrate", image: "busybox" }],
            },
          },
          status: { active: 0, succeeded: 0, failed: 0 },
        },
      ]),
      checks: [
        get("Listed the Job", "jobs", "migrate"),
        describe("Read the Job", "jobs", "migrate"),
      ],
    },
    {
      id: "ckad-daemonset",
      title: "DaemonSet",
      unit: "workloads",
      instruction: "Inspect the DaemonSet and its per-node Pod.",
      scenario: scenario({}, [
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
      ]),
      checks: [
        get("Listed the DaemonSet", "daemonsets", "agent"),
        {
          type: "pod",
          label: "Node agent running",
          name: "agent-node-1",
          image: "busybox",
          phase: "Running",
        },
      ],
    },
    {
      id: "ckad-incident-config",
      title: "Configuration incident",
      unit: "config",
      instruction:
        "The API is reading the wrong mode. Apply the corrected ConfigMap and Deployment, then verify the injected value.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  MODE: prod
---
apiVersion: apps/v1
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
        env:
          - name: APP_MODE
            value: prod
        envFrom:
          - configMapRef:
              name: app-config
`,
        },
        [
          {
            kind: "ConfigMap",
            metadata: { name: "app-config" },
            data: { MODE: "dev" },
          },
          {
            kind: "Deployment",
            metadata: { name: "api" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "api" },
                containers: [
                  {
                    name: "api",
                    image: "nginx",
                    env: [{ name: "APP_MODE", value: "dev" }],
                    envFrom: [{ kind: "ConfigMap", name: "app-config" }],
                  },
                ],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
        ],
      ),
      checks: [
        {
          type: "configmap",
          label: "ConfigMap repaired",
          name: "app-config",
          data: { MODE: "prod" },
        },
        {
          type: "env",
          label: "API uses production mode",
          deployment: "api",
          name: "APP_MODE",
          value: "prod",
          sourceKind: "ConfigMap",
          sourceName: "app-config",
        },
      ],
    },
    {
      id: "ckad-incident-secret",
      title: "Secret incident",
      unit: "config",
      instruction:
        "The API still has the old database password. Apply the corrected Secret and Deployment, then verify the injected value.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: v1
kind: Secret
metadata:
  name: db-secret
stringData:
  password: new-secret
---
apiVersion: apps/v1
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
        env:
          - name: DB_PASSWORD
            value: new-secret
        envFrom:
          - secretRef:
              name: db-secret
`,
        },
        [
          {
            kind: "Secret",
            metadata: { name: "db-secret" },
            type: "Opaque",
            data: { password: "b2xkLXNlY3JldA==" },
          },
          {
            kind: "Deployment",
            metadata: { name: "api" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "api" },
                containers: [
                  {
                    name: "api",
                    image: "nginx",
                    env: [{ name: "DB_PASSWORD", value: "old-secret" }],
                    envFrom: [{ kind: "Secret", name: "db-secret" }],
                  },
                ],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
        ],
      ),
      checks: [
        get("Listed Secret", "secrets", "db-secret"),
        {
          type: "env",
          label: "Password updated",
          deployment: "api",
          name: "DB_PASSWORD",
          value: "new-secret",
          sourceKind: "Secret",
          sourceName: "db-secret",
        },
      ],
    },
    {
      id: "ckad-incident-ingress",
      title: "Application ingress incident",
      unit: "services",
      instruction:
        "The app Ingress has no endpoints. Repair the Service and Deployment, then verify HTTPS.",
      scenario: scenario(
        {
          "fix.yaml": `${deploymentManifest("app", 2, "nginx:1.27")}---
${serviceManifest("app")}`,
        },
        [
          {
            kind: "Deployment",
            metadata: { name: "app" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "app" },
                containers: [{ name: "app", image: "nginx:1.25" }],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
          {
            kind: "Service",
            metadata: { name: "app" },
            spec: {
              type: "ClusterIP",
              selector: { app: "old" },
              ports: [{ port: 80, targetPort: 80 }],
              clusterIP: "10.96.0.220",
            },
          },
          {
            kind: "Ingress",
            metadata: { name: "app" },
            spec: {
              rules: [{ host: "app.example.com", path: "/", serviceName: "app", servicePort: 80 }],
              tls: [{ hosts: ["app.example.com"], secretName: "app-tls" }],
            },
          },
          {
            kind: "Pod",
            metadata: { name: "client" },
            spec: {
              nodeName: "node-1",
              containers: [{ name: "client", image: "curlimages/curl" }],
            },
            status: {
              phase: "Running",
              podIP: "10.244.0.221",
              conditions: [{ type: "Ready", status: "True" }],
            },
          },
        ],
      ),
      checks: [
        {
          type: "deployment",
          label: "Application repaired",
          name: "app",
          replicas: 2,
          image: "nginx:1.27",
        },
        get("Verified endpoints", "endpoints", "app"),
        { type: "command", label: "Tested HTTPS", verb: "exec", name: "client", command: "curl" },
      ],
    },
  ],
  cks: [
    {
      id: "cks-cluster-rbac",
      title: "Cluster RBAC",
      unit: "security",
      instruction: "Verify the ClusterRoleBinding grants pod listing.",
      scenario: scenario({}, [
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
      ]),
      checks: [
        get("Listed ClusterRoles", "clusterroles"),
        {
          type: "command",
          label: "Verified access",
          verb: "auth",
          subjectVerb: "list",
          subjectResource: "pods",
          as: "system:serviceaccount:default:deploy-bot",
        },
      ],
    },
    {
      id: "cks-netpol",
      title: "Deny traffic",
      unit: "networking",
      instruction: "Inspect the deny-all policy and test the blocked request.",
      scenario: scenario({}, [
        pod("web", { app: "web" }, "10.244.0.130"),
        pod("client", {}, "10.244.0.131"),
        service("web", { app: "web" }, "10.96.0.130"),
        {
          kind: "NetworkPolicy",
          metadata: { name: "deny-all" },
          spec: { podSelector: {}, policyTypes: ["Ingress"], ingress: [] },
        },
      ]),
      checks: [
        get("Listed the policy", "networkpolicies", "deny-all"),
        { type: "command", label: "Tested traffic", verb: "exec", name: "client", command: "curl" },
      ],
    },
    {
      id: "cks-psa",
      title: "Restricted Pod Security",
      unit: "security",
      instruction: "Inspect the restricted Namespace and harden the Pod.",
      scenario: scenario({}, [
        {
          kind: "Namespace",
          metadata: {
            name: "restricted",
            labels: { "pod-security.kubernetes.io/enforce": "restricted" },
          },
          status: { phase: "Active" },
        },
      ]),
      checks: [
        get("Listed the Namespace", "namespaces", "restricted"),
        describe("Read the Namespace", "namespaces", "restricted"),
      ],
    },
    {
      id: "cks-secret",
      title: "Secret exposure",
      unit: "config",
      instruction: "Inspect the Secret and the consuming Deployment.",
      scenario: scenario({}, [
        {
          kind: "Secret",
          metadata: { name: "db-secret" },
          type: "Opaque",
          data: { password: "czNjcmV0" },
        },
        {
          kind: "Deployment",
          metadata: { name: "api" },
          spec: {
            replicas: 1,
            template: {
              labels: { app: "api" },
              containers: [
                { name: "api", image: "nginx", envFrom: [{ kind: "Secret", name: "db-secret" }] },
              ],
            },
          },
          status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
        },
      ]),
      checks: [
        get("Listed the Secret", "secrets", "db-secret"),
        describe("Inspected the Deployment", "deployments", "api"),
      ],
    },
    {
      id: "cks-tls",
      title: "TLS routing",
      unit: "services",
      instruction: "Inspect TLS Ingress and test HTTPS.",
      scenario: scenario({}, [
        pod("web", { app: "web" }, "10.244.0.132"),
        pod("client", {}, "10.244.0.133"),
        service("web", { app: "web" }, "10.96.0.132"),
        {
          kind: "Ingress",
          metadata: { name: "shop" },
          spec: {
            rules: [{ host: "shop.example.com", path: "/", serviceName: "web", servicePort: 80 }],
            tls: [{ hosts: ["shop.example.com"], secretName: "shop-tls" }],
          },
        },
      ]),
      checks: [
        get("Listed the Ingress", "ingresses", "shop"),
        { type: "command", label: "Tested HTTPS", verb: "exec", name: "client", command: "curl" },
      ],
    },
    {
      id: "cks-cni",
      title: "Traffic path",
      unit: "networking",
      instruction: "Inspect Pod IPs, Service endpoints, and DNS resolution.",
      scenario: scenario({}, [
        pod("web", { app: "web" }, "10.244.0.134"),
        pod("client", {}, "10.244.0.135"),
        service("web", { app: "web" }, "10.96.0.134"),
      ]),
      checks: [
        get("Listed Pods", "pods"),
        get("Listed endpoints", "endpoints", "web"),
        { type: "command", label: "Resolved DNS", verb: "exec", name: "client", command: "getent" },
      ],
    },
    {
      id: "cks-admission-control",
      title: "Admission control",
      unit: "security",
      instruction:
        "The restricted namespace rejects the unsafe Deployment. Apply the hardened Deployment, then verify Pods run.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: restricted
spec:
  replicas: 1
  template:
    labels:
      app: web
    spec:
      securityContext:
        runAsNonRoot: true
      containers:
        - name: web
          image: nginx
          securityContext:
            allowPrivilegeEscalation: false
`,
        },
        [
          {
            kind: "Namespace",
            metadata: {
              name: "restricted",
              labels: { "pod-security.kubernetes.io/enforce": "restricted" },
            },
            status: { phase: "Active" },
          },
          {
            kind: "Deployment",
            metadata: { name: "web", namespace: "restricted" },
            spec: {
              replicas: 1,
              template: { labels: { app: "web" }, containers: [{ name: "web", image: "nginx" }] },
            },
            status: { replicas: 0, readyReplicas: 0, updatedReplicas: 0, availableReplicas: 0 },
          },
        ],
      ),
      checks: [
        get("Listed Namespace", "namespaces", "restricted"),
        { ...get("Listed Deployment", "deployments", "web"), namespace: "restricted" },
        { ...get("Listed Web Pods", "pods"), namespace: "restricted" },
      ],
    },
    {
      id: "cks-runtime-security",
      title: "Runtime restart incident",
      unit: "observability",
      instruction:
        "The worker is crash-looping because of its liveness probe. Apply the corrected Pod and verify it runs.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: v1
kind: Pod
metadata:
  name: worker
spec:
  containers:
    - name: worker
      image: busybox
      livenessProbe:
        exec:
          command: ["true"]
`,
        },
        [
          {
            kind: "Pod",
            metadata: { name: "worker" },
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
            status: { phase: "Running", podIP: "10.244.0.230", reason: "CrashLoopBackOff" },
          },
        ],
      ),
      checks: [get("Checked worker", "pods", "worker"), describe("Read worker", "pods", "worker")],
    },
    {
      id: "cks-image-provenance",
      title: "Image provenance",
      unit: "containers",
      instruction:
        "The API uses a mutable image tag. Apply the digest-pinned Deployment, then verify the image reference.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: apps/v1
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
        image: nginx@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`,
        },
        [
          {
            kind: "Deployment",
            metadata: { name: "api" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "api" },
                containers: [{ name: "api", image: "nginx:latest" }],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
        ],
      ),
      checks: [
        {
          type: "deployment",
          label: "Digest pinned",
          name: "api",
          replicas: 1,
          image: "nginx@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
    },
    {
      id: "cks-supply-chain",
      title: "Supply chain secret",
      unit: "config",
      instruction:
        "The database password is still the old value. Apply the corrected Secret and Deployment, then verify the environment.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: v1
kind: Secret
metadata:
  name: db-secret
stringData:
  password: rotated
---
apiVersion: apps/v1
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
        env:
          - name: DB_PASSWORD
            value: rotated
        envFrom:
          - secretRef:
              name: db-secret
`,
        },
        [
          {
            kind: "Secret",
            metadata: { name: "db-secret" },
            type: "Opaque",
            data: { password: "b2xk" },
          },
          {
            kind: "Deployment",
            metadata: { name: "api" },
            spec: {
              replicas: 1,
              template: {
                labels: { app: "api" },
                containers: [
                  {
                    name: "api",
                    image: "nginx",
                    env: [{ name: "DB_PASSWORD", value: "old" }],
                    envFrom: [{ kind: "Secret", name: "db-secret" }],
                  },
                ],
              },
            },
            status: { replicas: 1, readyReplicas: 1, updatedReplicas: 1, availableReplicas: 1 },
          },
        ],
      ),
      checks: [
        get("Listed Secret", "secrets", "db-secret"),
        {
          type: "env",
          label: "Password rotated",
          deployment: "api",
          name: "DB_PASSWORD",
          value: "rotated",
          sourceKind: "Secret",
          sourceName: "db-secret",
        },
      ],
    },
    {
      id: "cks-node-hardening",
      title: "Node hardening",
      unit: "scheduling",
      instruction:
        "The secure node rejects the Pod. Add the required toleration, then verify the Pod runs.",
      scenario: scenario(
        {
          "fix.yaml": `apiVersion: v1
kind: Pod
metadata:
  name: worker
spec:
  tolerations:
    - key: dedicated
      operator: Equal
      value: secure
      effect: NoSchedule
  containers:
    - name: worker
      image: busybox
`,
        },
        [
          {
            kind: "Pod",
            metadata: { name: "worker" },
            spec: { containers: [{ name: "worker", image: "busybox" }] },
            status: { phase: "Pending" },
          },
        ],
        [
          {
            name: "node-1",
            cpu: "4",
            memory: "8Gi",
            taints: [{ key: "dedicated", value: "secure", effect: "NoSchedule" }],
          },
        ],
      ),
      checks: [
        get("Checked worker", "pods", "worker"),
        {
          type: "pod",
          label: "Worker scheduled",
          name: "worker",
          image: "busybox",
          phase: "Running",
        },
      ],
    },
  ],
};
