# Spec Delta

## ADDED Requirements

### Requirement: Executable hints
Every command shown in a lesson hint SHALL execute successfully in that lesson's scenario.

#### Scenario: Hint audit
- **WHEN** the completability test runs a documented command
- **THEN** the simulator returns a successful result before checkpoints are evaluated
