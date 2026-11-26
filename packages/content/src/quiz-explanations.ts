export const quizExplanations: Record<string, string> = {
  "affinity-101:q1":
    "Required node affinity is a hard scheduling constraint; no matching node leaves the Pod Pending.",
  "autoscaling-101:q1":
    "The HPA compares metrics against targets and changes the Deployment replica count.",
  "cka-readiness:q1": "kubectl get nodes reports node readiness and status.",
  "cka-readiness:q2":
    "Scheduling failures usually come from taints, affinity, resource pressure, or unschedulable nodes.",
  "cka-readiness:q3":
    "etcd snapshots protect cluster state and should be stored outside the control plane.",
  "ckad-readiness:q1": "Readiness controls whether a Pod is included in Service endpoints.",
  "ckad-readiness:q2": "Deployment strategies include RollingUpdate and Recreate.",
  "ckad-readiness:q3":
    "ConfigMaps can be consumed as environment variables, envFrom imports, or mounted files.",
  "cks-readiness:q1":
    "Supply chain security covers images, registries, signing, provenance, and dependency trust.",
  "cks-readiness:q2":
    "Runtime security detects suspicious process, file, and network behavior after workloads start.",
  "cks-readiness:q3":
    "A default-deny policy blocks traffic unless another rule explicitly allows it.",
  "cluster-rbac-101:q1":
    "ClusterRoles are cluster-scoped and can grant permissions across namespaces.",
  "cni-101:q1":
    "The CNI plugin configures Pod network interfaces and routes between Pods and nodes.",
  "configmaps-101:q1": "ConfigMaps store non-sensitive configuration as keys and values.",
  "containers-101:q1":
    "An image is the template; a container is a running instance created from it.",
  "control-plane-101:q1": "etcd is the consistent key-value store for cluster state.",
  "daemonsets-101:q1": "DaemonSets place one Pod on every eligible node.",
  "deployments-101:q1":
    "A Deployment manages ReplicaSets and provides declarative rollouts and rollbacks.",
  "dns-101:q1": "A Service named web in namespace demo resolves as web.demo.svc.cluster.local.",
  "gitops-101:q1":
    "GitOps uses Git as the desired-state source and reconciles the cluster toward it.",
  "helm-101:q1": "A Helm chart is a packaged collection of Kubernetes templates and defaults.",
  "images-101:q1": "A digest reference is immutable and the most reproducible image choice.",
  "ingress-101:q1": "Ingress routes HTTP traffic by host and path to a Service.",
  "init-containers-101:q1": "App containers start only after every init container succeeds.",
  "jobs-101:q1": "A Job runs Pods until the requested completion count succeeds.",
  "kcna-readiness:q1": "A Pod is the smallest deployable Kubernetes unit.",
  "kcna-readiness:q2": "kube-scheduler chooses a node for each unscheduled Pod.",
  "kcna-readiness:q3":
    "KCNA covers Kubernetes and cloud-native fundamentals rather than only labs or security.",
  "kcsa-readiness:q1": "RBAC controls who can perform which actions on which resources.",
  "kcsa-readiness:q2": "Pod Security Standards levels are privileged, baseline, and restricted.",
  "kcsa-readiness:q3":
    "Secrets are base64-encoded by default, not encrypted at rest unless the cluster adds encryption.",
  "kustomize-101:q1":
    "Kustomize customizes YAML without templates, using bases, overlays, and patches.",
  "logs-events-101:q1":
    "kubectl logs shows container output; events show cluster-level lifecycle messages.",
  "network-policy-101:q1":
    "A default-deny policy selects Pods and provides no allow rules, so matching traffic is denied.",
  "nodes-101:q1": "Kubelet runs on every node and starts containers for assigned Pods.",
  "operators-101:q1":
    "An operator encodes application-specific operational knowledge in a controller and CRDs.",
  "orchestration-101:q1":
    "Kubernetes continuously reconciles actual state toward declared desired state.",
  "pdb-101:q1": "A PodDisruptionBudget constrains voluntary disruptions such as drains.",
  "persistent-volumes-101:q1": "A PVC requests storage capacity and access modes from the cluster.",
  "pod-security-101:q1": "Pod Security Standards levels are privileged, baseline, and restricted.",
  "probes-101:q1":
    "Readiness failure removes the Pod from Service endpoints without restarting it.",
  "rbac-101:q1":
    "A RoleBinding grants a Role's permissions to users, groups, or ServiceAccounts in a namespace.",
  "resource-quota-101:q1":
    "ResourceQuota limits aggregate namespace consumption such as Pod count or total requests.",
  "scheduling-101:q1":
    "A matching toleration lets a Pod tolerate a taint and schedule on that node.",
  "secrets-101:q1":
    "Secrets are base64-encoded API objects; enable encryption at rest for stronger protection.",
  "services-101:q1": "ClusterIP provides a stable virtual IP reachable inside the cluster.",
  "services-101:q2": "A Service selects Pods through label selectors.",
  "statefulsets-101:q1": "StatefulSets create stable ordinal Pod names starting at db-0.",
  "storageclasses-101:q1": "A StorageClass defines how volumes are dynamically provisioned.",
  "tls-ingress-101:q1": "The Ingress TLS section binds host names to a certificate Secret.",
  "audit-encryption:q1":
    "Audit logs record API requests and policy decisions; encryption at rest protects stored Secret data.",
  "certificates-kubeconfig:q1":
    "A kubeconfig context combines a cluster, user credentials, and a default namespace.",
  "cncf-ecosystem:q1": "The CNCF hosts open-source cloud native projects and community programs.",
  "config-secret-volumes:q1":
    "Projected ConfigMap volumes refresh after the kubelet sync period; subPath mounts do not update.",
  "dns-troubleshooting:q1":
    "A Service name can resolve to a ClusterIP while no ready endpoints exist, so requests still fail.",
  "etcd-backup-restore:q1":
    "Stop control plane components before restoring etcd, then restart them against the restored data directory.",
  "kubeadm-install:q1":
    "kubeadm init bootstraps control plane certificates and components and prints a join command for workers.",
  "multi-container-patterns:q1":
    "Containers in one Pod share a network namespace and any volumes declared for the Pod.",
  "node-control-plane-troubleshooting:q1":
    "A failed control plane component usually breaks API access cluster-wide before individual workloads fail.",
  "resource-requests-limits:q1":
    "The scheduler uses the sum of container requests; limits constrain runtime usage after placement.",
  "rollout-strategies:q1":
    "A Recreate strategy stops old Pods before starting replacements, accepting downtime.",
  "runtime-detection:q1":
    "Preserve logs and runtime evidence before deleting or recreating a suspicious workload.",
  "seccomp-apparmor:q1":
    "RuntimeDefault seccomp applies the container runtime's default syscall filter.",
  "storage-debugging:q1":
    "A claim referencing a missing StorageClass stays Pending until the class is created or the claim is corrected.",
  "supply-chain-security:q1":
    "A digest identifies immutable image content, unlike a tag that can be moved.",
  "threat-modeling-compliance:q1":
    "Threat modeling starts by identifying assets, actors, and trust boundaries before selecting controls.",
};
