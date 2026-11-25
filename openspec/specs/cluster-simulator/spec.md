# cluster-simulator Specification

## Purpose

Provide a deterministic, browser-local Kubernetes practice environment whose command output, cluster state, lesson checks, and animations stay consistent.

## Requirements

### Requirement: Local deterministic engine
The simulator SHALL run entirely in the browser, advance through a virtual clock, and produce repeatable command and reconciliation results without a real cluster.

#### Scenario: No external cluster is required
- **WHEN** a learner runs a supported command
- **THEN** the response comes from in-memory state without contacting a Kubernetes API

#### Scenario: Reconciliation is clock-driven
- **WHEN** the virtual clock advances
- **THEN** controllers reconcile pending resources and emit observable state changes

### Requirement: Workload lifecycle
The simulator SHALL create and reconcile Pods, Deployments, ReplicaSets, scaling, image updates, rollbacks, and rolling-update strategies.

#### Scenario: Deployment creates replicas
- **WHEN** a Deployment is created with a replica count
- **THEN** matching ReplicaSets and Pods are reconciled toward that count

#### Scenario: Rollout respects strategy
- **WHEN** a Deployment template changes under a rolling or recreate strategy
- **THEN** old and new ReplicaSets are adjusted according to `maxSurge` and `maxUnavailable`

#### Scenario: HPA changes desired replicas
- **WHEN** an HPA targets a Deployment with a desired replica count
- **THEN** the Deployment is reconciled within the HPA minimum and maximum

### Requirement: Networking behavior
The simulator SHALL model Services, Endpoints, cluster DNS, Ingress routing, and NetworkPolicy admission for supported traffic checks.

#### Scenario: Service selects ready Pods
- **WHEN** a Service selector matches ready Pods
- **THEN** its endpoints include those Pod IPs and DNS resolves the Service address

#### Scenario: Readiness removes endpoints
- **WHEN** a selected Pod is not Ready
- **THEN** it is excluded from the Service endpoints

#### Scenario: NetworkPolicy denies traffic
- **WHEN** an ingress or egress policy selects the source or destination and no rule permits the peer
- **THEN** the simulated request is denied with a policy error

#### Scenario: Ingress routes by host and path
- **WHEN** a request matches an Ingress rule and its backend Service has ready endpoints
- **THEN** the response identifies the Service and backend Pod

### Requirement: Configuration and storage
The simulator SHALL support ConfigMaps, Secrets, environment injection, PV/PVC binding, StorageClasses, and dynamic volume provisioning.

#### Scenario: ConfigMap and Secret values reach containers
- **WHEN** a Deployment injects configuration from a ConfigMap or Secret
- **THEN** `exec` environment reads show the resolved values

#### Scenario: Claim binds to matching volume
- **WHEN** a PVC requests storage and access modes that match an available PV
- **THEN** the PVC and PV become Bound

#### Scenario: Dynamic class provisions storage
- **WHEN** a PVC references a provisioning StorageClass without a matching PV
- **THEN** a Bound PV is created for the claim

### Requirement: Security and observability commands
The simulator SHALL support RBAC authorization checks, Pod logs, events, resource descriptions, and node placement inspection.

#### Scenario: Unauthorized subject is denied
- **WHEN** `kubectl auth can-i` is evaluated for a subject without the required permission
- **THEN** the command reports denial

#### Scenario: Logs respect container selection
- **WHEN** a learner requests logs for a missing container
- **THEN** the command reports an error instead of returning unrelated output

### Requirement: Toolchain simulations
The simulator SHALL expose Helm release inspection and mutations, Kustomize rendering, Argo CD application status and sync, and custom resource reconciliation.

#### Scenario: Helm release can be upgraded
- **WHEN** a learner upgrades a seeded Helm release
- **THEN** its revision and values history change

#### Scenario: Argo application syncs
- **WHEN** a learner syncs an Application
- **THEN** its sync and health status become healthy

### Requirement: Command surface
The simulator SHALL support `get` tables, wide and YAML output, label selectors, `top`, `describe`, `apply` from files or directories, mutations, deletes, `exec`, logs, auth checks, and toolchain commands.

#### Scenario: YAML output is readable
- **WHEN** a learner requests a supported resource with `-o yaml`
- **THEN** the output is valid YAML for the stored resource

#### Scenario: Multiple manifests apply together
- **WHEN** an apply source contains multiple documents, comma-separated files, or a directory
- **THEN** every supported manifest is applied in order

### Requirement: Fidelity limits are explicit
The simulator SHALL present intentional simplifications as teaching aids and SHALL NOT claim unsupported production Kubernetes behavior.

#### Scenario: Unsupported behavior is not implied
- **WHEN** a lesson covers HPA metrics, TLS Ingress, live log streaming, or complex Kustomize patches
- **THEN** the content labels the simplified or unavailable behavior

#### Scenario: HPA uses seeded intent
- **WHEN** an HPA has no CPU target or no usable Pod usage and requests
- **THEN** scaling follows the authored desired replica state rather than inventing a metric

#### Scenario: Logs follow is a snapshot
- **WHEN** a learner uses log-follow behavior
- **THEN** the output is a bounded snapshot rather than an indefinite stream

#### Scenario: Probes use authored responses
- **WHEN** a lesson demonstrates an HTTP probe failure
- **THEN** the scenario authors the simulated status instead of running a real application server

### Requirement: Pod usage metrics
Simulated Pods SHALL expose optional CPU and memory usage, and `kubectl top pods` SHALL prefer authored usage over synthetic estimates.

#### Scenario: Authored usage is shown
- **WHEN** a Pod has authored CPU and memory usage
- **THEN** `kubectl top pods` reports those values for the Pod

#### Scenario: Usage is optional
- **WHEN** a Pod has no authored usage
- **THEN** `kubectl top pods` still returns a deterministic estimate

### Requirement: HPA CPU metric reconciliation
An HPA with a Resource CPU utilization target SHALL derive desired replicas from average Pod CPU usage relative to container CPU requests.

#### Scenario: Utilization above target scales up
- **WHEN** the HPA target is 50%, current replicas are 2, and average utilization is 80%
- **THEN** the desired replica count becomes 4 before min/max clamping

#### Scenario: Replica bounds are respected
- **WHEN** the metric calculation produces a count outside the HPA minimum or maximum
- **THEN** the desired count is clamped to the configured bounds

#### Scenario: Demand stays stable after scaling
- **WHEN** the HPA has already scaled to satisfy the same total CPU demand
- **THEN** the next reconciliation does not keep increasing replicas

#### Scenario: Metric output shows the target
- **WHEN** a learner lists the HPA
- **THEN** the targets column shows current CPU utilization against the configured target

### Requirement: Probe-driven health
The simulator SHALL evaluate readiness and liveness probes on the virtual clock using initial delay, period, and failure threshold settings.

#### Scenario: Readiness failure does not restart
- **WHEN** a readiness probe exceeds its failure threshold
- **THEN** the Pod is marked not Ready and its container restart count stays unchanged

#### Scenario: Readiness recovery restores traffic
- **WHEN** a previously failing readiness probe succeeds
- **THEN** the Pod becomes Ready and returns to eligible Service endpoints

#### Scenario: Liveness failure restarts the container
- **WHEN** a liveness probe exceeds its failure threshold
- **THEN** the container restart count increases, the Pod becomes not Ready, and a warning event is recorded

#### Scenario: Repeated restarts enter CrashLoopBackOff
- **WHEN** liveness failures cause repeated container restarts
- **THEN** the Pod reports `CrashLoopBackOff` and retries after a bounded backoff instead of restarting every tick

#### Scenario: Initial delay is respected
- **WHEN** a probe has not reached its initial delay
- **THEN** it is not evaluated and the Pod keeps its current readiness state

### Requirement: Probe simulation input
The simulator SHALL allow scenarios to author deterministic HTTP probe status codes, while defaulting HTTP probes to success and recognizing explicit failing exec commands.

#### Scenario: Authored HTTP failure
- **WHEN** a container authors a failing HTTP status for readiness
- **THEN** its readiness probe fails on the next due evaluation

#### Scenario: Default HTTP probe succeeds
- **WHEN** an HTTP probe has no authored response status
- **THEN** the simulated endpoint returns success

#### Scenario: Failing exec probe
- **WHEN** an exec probe runs `false` or exits non-zero
- **THEN** the probe fails

### Requirement: Probe status output
The simulator SHALL expose readiness, restart counts, and CrashLoopBackOff through existing Pod commands.

#### Scenario: Restart count is visible
- **WHEN** a container has restarted
- **THEN** `kubectl get pods` shows the accumulated restart count

#### Scenario: Crash status is visible
- **WHEN** a Pod is in CrashLoopBackOff
- **THEN** `kubectl get pods` shows `CrashLoopBackOff` in the STATUS column

#### Scenario: Warning event is visible
- **WHEN** a probe crosses its failure threshold
- **THEN** `kubectl get events` includes a warning for the affected Pod
