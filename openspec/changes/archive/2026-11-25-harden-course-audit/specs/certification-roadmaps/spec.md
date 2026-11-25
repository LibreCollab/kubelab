# Spec Delta

## ADDED Requirements

### Requirement: First readiness snapshot
The dashboard SHALL not present a single readiness snapshot as a multi-point trend.

#### Scenario: Only one snapshot exists
- **WHEN** a learner has one saved readiness snapshot
- **THEN** the dashboard shows the current score and explains that the trend starts after the next session

#### Scenario: Multiple snapshots exist
- **WHEN** at least two snapshots exist
- **THEN** the dashboard renders compact bars with the current score
