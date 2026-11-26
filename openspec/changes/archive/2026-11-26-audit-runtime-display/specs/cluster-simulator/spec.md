# Spec Delta

## ADDED Requirements

### Requirement: HPA defaults
An applied HorizontalPodAutoscaler SHALL receive initial status, and reads SHALL tolerate missing status.

#### Scenario: Apply an HPA
- **WHEN** a learner applies an HPA manifest without a status block
- **THEN** reconciliation and `kubectl get hpa` work without crashing
