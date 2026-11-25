# Spec Delta

## ADDED Requirements

### Requirement: HPA memory metrics
An HPA with a Resource memory utilization target SHALL derive replicas from average Pod memory usage relative to container memory requests.

#### Scenario: Memory above target scales up
- **WHEN** a memory target is configured and average utilization exceeds the target
- **THEN** desired replicas increase based on the utilization ratio

#### Scenario: Memory metric is reported
- **WHEN** a learner lists an HPA with a memory target
- **THEN** the targets column identifies memory and shows current/target percentages

### Requirement: HPA scaling tolerance
HPA reconciliation SHALL keep the current replica count when utilization is within ten percent of the target.

#### Scenario: Small deviation does not scale
- **WHEN** current utilization is within the tolerance band around the target
- **THEN** desired replicas remain unchanged

#### Scenario: Large deviation scales
- **WHEN** current utilization is outside the tolerance band
- **THEN** desired replicas follow the utilization ratio
