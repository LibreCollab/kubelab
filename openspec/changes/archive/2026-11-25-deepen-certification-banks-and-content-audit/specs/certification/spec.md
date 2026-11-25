# Spec Delta

## ADDED Requirements

### Requirement: Dedicated task scenarios
Certification tasks SHALL define their own scenarios and checks instead of inheriting a lesson's full scenario.

#### Scenario: Task uses independent scenario
- **WHEN** a lab task is selected
- **THEN** its scenario and checks come from the certification task catalog

#### Scenario: Task overview is stable
- **WHEN** the task is displayed
- **THEN** it has a stable title, unit, instruction, and grading checks
