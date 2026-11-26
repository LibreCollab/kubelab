Pods are ephemeral. A Service gives a stable virtual IP and DNS name to a set of Pods selected by labels.

- **ClusterIP** - internal virtual IP (default).
- **NodePort** - exposes a port on every node.
- **LoadBalancer** - asks the cloud for an external LB.
- Endpoints track the ready Pods behind the selector.

**Failure modes.** A Service with no endpoints is the classic failure. The selector may not match, the Pods may not be Ready, or the port names may not line up. A ClusterIP can exist and resolve while every request fails.

**Verify.** Verify the Service selector, the Pod labels, readiness, and the Endpoints object. Compare the Service port with the container port. For NodePort and LoadBalancer, check external reachability separately. A Service is working only when a client request reaches a ready backend.

**Evidence to capture.** Record the Service selector, Pod labels, readiness, and Endpoints object; a working ClusterIP alone proves nothing about traffic.
