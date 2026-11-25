# Spec Delta

## ADDED Requirements

### Requirement: TLS Ingress routing
HTTPS requests SHALL require a matching Ingress TLS host, while HTTP routing remains available without TLS.

#### Scenario: TLS host routes
- **WHEN** HTTPS targets a host listed in an Ingress TLS section with a healthy backend
- **THEN** the request succeeds

#### Scenario: TLS host is missing
- **WHEN** HTTPS targets an Ingress host not covered by its TLS section
- **THEN** the request fails with a TLS error

### Requirement: ServiceAccount token projection
Pods SHALL expose projected ServiceAccount token, namespace, and CA files to supported exec commands.

#### Scenario: Token file is readable
- **WHEN** a learner reads the standard ServiceAccount token path
- **THEN** a simulated token is returned

#### Scenario: Namespace file is readable
- **WHEN** a learner reads the namespace file
- **THEN** the Pod namespace is returned

### Requirement: Pod Security admission
The scheduler SHALL enforce namespace `pod-security.kubernetes.io/enforce` levels for privileged, baseline, and restricted Pods.

#### Scenario: Restricted Pod is rejected
- **WHEN** a restricted namespace receives a Pod without the required security context
- **THEN** the Pod remains Pending with a Pod Security message

#### Scenario: Privileged namespace accepts the Pod
- **WHEN** the namespace enforces privileged
- **THEN** Pod Security does not block scheduling

### Requirement: Startup and gRPC probes
The probe engine SHALL evaluate startup probes before readiness/liveness and SHALL support gRPC probe targets.

#### Scenario: Startup failure blocks other probes
- **WHEN** a startup probe is failing
- **THEN** readiness and liveness are not evaluated

#### Scenario: gRPC probe succeeds
- **WHEN** a gRPC probe has no authored failure
- **THEN** it succeeds

### Requirement: Event expiry
Events SHALL disappear from `kubectl get events` after a bounded age.

#### Scenario: Old event is hidden
- **WHEN** an Event is older than the retention window
- **THEN** it is omitted from list output

### Requirement: External HPA metrics and stabilization
HPA SHALL support external average-value metrics and SHALL delay scale-down inside a configured stabilization window.

#### Scenario: External metric scales
- **WHEN** an external metric exceeds its target
- **THEN** replicas increase from the ratio

#### Scenario: Scale-down waits
- **WHEN** scale-down is inside the stabilization window
- **THEN** current replicas remain

### Requirement: Kustomize rendering
`kubectl kustomize` SHALL render referenced resources and apply simple strategic merge patches from seeded files.

#### Scenario: Patch changes a resource
- **WHEN** a kustomization references a Deployment and a patch changes replicas or image
- **THEN** rendered YAML contains the patched values

### Requirement: Helm lifecycle and rendering
Helm install/upgrade/rollback SHALL record release history and SHALL apply seeded chart manifests.

#### Scenario: Install applies a chart
- **WHEN** a chart manifest is available in seeded files
- **THEN** install applies its resources and creates a release

#### Scenario: Rollback restores status
- **WHEN** a release is rolled back
- **THEN** its history/status reflect the rollback

### Requirement: Argo drift detection
Argo Applications SHALL report OutOfSync when seeded source content differs from the last applied content, and sync SHALL apply and mark it Synced.

#### Scenario: Drift is detected
- **WHEN** source content changes after a sync
- **THEN** the Application becomes OutOfSync

#### Scenario: Sync applies drift
- **WHEN** a learner syncs an OutOfSync Application
- **THEN** its manifests are applied and status returns to Synced

### Requirement: Operator child reconciliation
The Widget operator SHALL reconcile a child ConfigMap and report observed status.

#### Scenario: Widget creates a child
- **WHEN** a Widget exists without its managed ConfigMap
- **THEN** the operator creates the ConfigMap from the Widget spec
