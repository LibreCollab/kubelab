# Spec Delta

## ADDED Requirements

### Requirement: Expanded workload lessons
The curriculum SHALL include terminal lessons for Jobs, StatefulSets, DaemonSets, and init containers.

#### Scenario: Workload lesson is available
- **WHEN** a learner reaches the workloads unit
- **THEN** each new workload kind has an interactive lesson with checks

### Requirement: Governance and networking lessons
The curriculum SHALL include terminal lessons for PodDisruptionBudgets, ResourceQuota/LimitRange, affinity, TLS Ingress, and cluster-scoped RBAC.

#### Scenario: New feature has exercise
- **WHEN** a learner opens one of the new lessons
- **THEN** the lesson uses the corresponding simulator feature and has verification checks

### Requirement: No quiz-only core lessons
Every core unit lesson SHALL include at least one non-quiz checkpoint.

#### Scenario: Containers lesson is interactive
- **WHEN** a learner opens containers-101
- **THEN** they can run and verify a Pod in the terminal
