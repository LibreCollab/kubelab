# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Fidelity limits are explicit
The simulator SHALL present intentional simplifications as teaching aids and SHALL NOT claim unsupported production Kubernetes behavior.

#### Scenario: Unsupported behavior is not implied
- **WHEN** a lesson covers HPA metrics, probes, TLS Ingress, live log streaming, or complex Kustomize patches
- **THEN** the content labels the simplified or unavailable behavior

#### Scenario: HPA uses seeded intent
- **WHEN** an HPA has no CPU target or no usable Pod usage and requests
- **THEN** scaling follows the authored desired replica state rather than inventing a metric

#### Scenario: Logs follow is a snapshot
- **WHEN** a learner uses log-follow behavior
- **THEN** the output is a bounded snapshot rather than an indefinite stream
