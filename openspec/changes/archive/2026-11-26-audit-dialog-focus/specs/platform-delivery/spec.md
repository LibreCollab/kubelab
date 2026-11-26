# Spec Delta

## ADDED Requirements

### Requirement: Stable dialog focus
Cluster dialog focus SHALL remain on the learner's chosen control while live cluster state updates.

#### Scenario: Dialog open during a tick
- **WHEN** the engine advances while the cluster dialog is open
- **THEN** focus does not jump back to the dialog close button
