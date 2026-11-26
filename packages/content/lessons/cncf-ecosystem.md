Kubernetes is one project in a wider cloud native ecosystem. The CNCF hosts projects spanning runtime, networking, observability, delivery, security, and storage. Knowing which layer solves which problem prevents adding tools that duplicate each other.

A practical map helps. Containers and runtimes provide execution. Kubernetes provides orchestration. Envoy and ingress or gateway controllers handle traffic. CoreDNS handles service discovery. Prometheus, OpenTelemetry, and log pipelines handle telemetry. Helm and Kustomize handle packaging and configuration. Argo CD and Flux handle GitOps delivery. Falco, Kyverno, and similar projects address runtime and policy concerns.

The CNCF also runs community programs, working groups, and conformance efforts. Project maturity levels describe adoption and governance, not whether a tool fits every cluster.

Failure modes include treating a sandbox project as production-ready, adding a service mesh before the network model is understood, and using overlapping tools for the same job. Verification: for each platform component, identify the problem it solves, the owner, and the signal that proves it is healthy. 