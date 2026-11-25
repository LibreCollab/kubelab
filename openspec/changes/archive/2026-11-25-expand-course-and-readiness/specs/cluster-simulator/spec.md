# Spec Delta

## ADDED Requirements

### Requirement: Standard PodTemplate apply
The simulator SHALL normalize standard Kubernetes Deployment, Job, StatefulSet, DaemonSet, and CronJob `template.metadata`/`template.spec` manifests.

#### Scenario: Standard Deployment manifest
- **WHEN** a learner applies a Deployment with `template.metadata.labels` and `template.spec.containers`
- **THEN** the simulator stores a working pod template and creates Pods

#### Scenario: Standard envFrom references
- **WHEN** a workload manifest uses `configMapRef` or `secretRef` under `envFrom`
- **THEN** the simulator normalizes them into its environment source model
