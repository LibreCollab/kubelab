# Spec Delta

## ADDED Requirements

### Requirement: Safe resource listing
The simulator SHALL list Secrets even when an applied Secret omits type or data.

#### Scenario: Typeless Secret
- **WHEN** a learner applies a Secret without a type
- **THEN** `kubectl get secrets` lists it as Opaque without crashing

### Requirement: Workload describe
The simulator SHALL describe built-in batch and workload controllers.

#### Scenario: Describe a CronJob
- **WHEN** a learner runs `kubectl describe cronjob report`
- **THEN** the simulator returns the stored object details
