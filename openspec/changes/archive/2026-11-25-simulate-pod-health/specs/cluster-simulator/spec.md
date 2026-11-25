# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
