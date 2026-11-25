# Spec Delta

## ADDED Requirements

### Requirement: Init container sequencing
A Pod with init containers SHALL complete them before starting its application containers.

#### Scenario: Init containers delay Running
- **WHEN** a scheduled Pod has init containers that have not completed
- **THEN** the Pod remains Pending with an init progress message

#### Scenario: Init completes
- **WHEN** all init containers have completed
- **THEN** the Pod proceeds to Running on the next reconciliation

### Requirement: DaemonSet reconciliation
A DaemonSet SHALL maintain one Pod on every ready node.

#### Scenario: Pod per node
- **WHEN** a DaemonSet is seeded with two ready nodes
- **THEN** it reconciles two Pods, one assigned to each node

#### Scenario: Node count changes
- **WHEN** a ready node no longer exists
- **THEN** the DaemonSet Pod for that node is removed

### Requirement: StatefulSet reconciliation
A StatefulSet SHALL maintain the requested number of stable ordinal Pods.

#### Scenario: Ordinal Pod names
- **WHEN** a StatefulSet requests three replicas
- **THEN** it reconciles Pods named `<name>-0`, `<name>-1`, and `<name>-2`

#### Scenario: Scale down
- **WHEN** a StatefulSet replica count decreases
- **THEN** higher-ordinal Pods are removed

### Requirement: Job completion
A Job SHALL create Pods up to its completion target and report active and successful counts.

#### Scenario: Job completes
- **WHEN** Job Pods finish successfully
- **THEN** the Job reports its succeeded count and becomes complete at the target

#### Scenario: Duplicate Pods are avoided
- **WHEN** a Job already has sufficient active or succeeded Pods
- **THEN** no additional Pods are created

### Requirement: CronJob scheduling
A CronJob SHALL create a Job when its simulated schedule becomes due.

#### Scenario: Schedule fires
- **WHEN** the virtual clock reaches the next CronJob schedule
- **THEN** a Job is created from the CronJob template and the last schedule tick is updated

#### Scenario: Schedule is not yet due
- **WHEN** the clock has not reached the next schedule
- **THEN** no new Job is created

### Requirement: Workload inspection
The simulator SHALL list, describe, and render YAML for new workload kinds.

#### Scenario: List workload status
- **WHEN** a learner lists DaemonSets, StatefulSets, Jobs, or CronJobs
- **THEN** the output includes the resource and its controller status

#### Scenario: YAML output
- **WHEN** a learner requests YAML for a supported workload
- **THEN** the stored object is rendered
