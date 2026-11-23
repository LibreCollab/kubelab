Pods are ephemeral. A Service gives a stable virtual IP and DNS name to a set of Pods selected by labels.

- **ClusterIP** — internal virtual IP (default).
- **NodePort** — exposes a port on every node.
- **LoadBalancer** — asks the cloud for an external LB.
- Endpoints track the ready Pods behind the selector.
