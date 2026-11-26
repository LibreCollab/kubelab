Multi-container Pods are for tightly coupled processes that must share a lifecycle. The main patterns are sidecar, adapter, ambassador, and init. A sidecar adds supporting behavior such as log shipping or a proxy. An adapter normalises output. An ambassador brokers outbound communication. Init containers run before app containers and must finish.

Containers in one Pod share a network namespace, so they reach each other over localhost. They can also share volumes. They do not share a filesystem by default, and they do not restart independently as separate workloads would.

Failure modes include putting unrelated services in one Pod, hiding a startup dependency in an init container that never exits, and forgetting that a failing sidecar can affect Pod readiness. Resource requests are summed across containers, so a heavy sidecar changes scheduling.

Verification: inspect every container with `kubectl describe pod`, read one container's logs with `kubectl logs -c`, and confirm readiness reflects the whole Pod, not only the main process. 