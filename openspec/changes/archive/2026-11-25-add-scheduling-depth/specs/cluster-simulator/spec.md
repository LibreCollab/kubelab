# Spec Delta

## ADDED Requirements

### Requirement: Affinity scheduling
The scheduler SHALL enforce required node affinity, Pod affinity, and Pod anti-affinity terms before placing a Pod.

#### Scenario: Node affinity selects a matching node
- **WHEN** a Pod requires a node label expression and one node matches
- **THEN** the Pod schedules only on that node

#### Scenario: Node affinity rejects all nodes
- **WHEN** no node satisfies the required expression
- **THEN** the Pod remains Pending with an unschedulable message

#### Scenario: Anti-affinity separates Pods
- **WHEN** a required anti-affinity term conflicts with a matching Pod on a node topology
- **THEN** the scheduler chooses another topology or leaves the Pod Pending

### Requirement: Topology spread
The scheduler SHALL honor required topology-spread constraints when choosing a node.

#### Scenario: Spread preserves skew
- **WHEN** placing the Pod would exceed `maxSkew` for a topology value
- **THEN** the scheduler prefers another topology value

#### Scenario: Unsatisfiable spread remains Pending
- **WHEN** no node satisfies a required spread constraint
- **THEN** the Pod remains Pending

### Requirement: LimitRange defaults
A namespace LimitRange SHALL inject default container requests when a Pod omits them.

#### Scenario: CPU and memory defaults are applied
- **WHEN** a Pending Pod's container has no resource requests and a LimitRange provides defaults
- **THEN** the Pod is updated with those requests before scheduling

### Requirement: ResourceQuota enforcement
ResourceQuota SHALL limit the number of Pods and the sum of CPU and memory requests in a namespace.

#### Scenario: Pod quota is exhausted
- **WHEN** creating another Pod would exceed the hard Pod count
- **THEN** the Pod remains Pending with a quota message

#### Scenario: CPU request exceeds quota
- **WHEN** the new Pod's CPU requests would exceed the hard CPU total
- **THEN** the Pod remains Pending with a quota message

### Requirement: PodDisruptionBudget status
A PodDisruptionBudget SHALL report current healthy Pods and allowed disruptions.

#### Scenario: Healthy Pods satisfy the budget
- **WHEN** enough selected Pods are Ready to meet the minimum
- **THEN** the PDB reports allowed disruptions

#### Scenario: Budget blocks disruption
- **WHEN** selected healthy Pods are below the minimum
- **THEN** the PDB reports zero allowed disruptions

### Requirement: Governance inspection
The simulator SHALL list, describe, and YAML-render ResourceQuotas, LimitRanges, and PDBs.

#### Scenario: Governance resources are listed
- **WHEN** a learner lists any of the new resource types
- **THEN** the output shows the object and its key status
