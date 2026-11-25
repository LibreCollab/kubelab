# Spec Delta

## ADDED Requirements

### Requirement: Readiness confidence
The certification dashboard SHALL show the amount of recent evidence behind readiness and a confidence level.

#### Scenario: No attempts
- **WHEN** a learner has no recent attempts
- **THEN** confidence is None and the evidence count is zero

#### Scenario: Multiple attempts
- **WHEN** a learner has multiple recent attempts
- **THEN** confidence increases with the sample size

### Requirement: Change since last attempt
The dashboard SHALL show the score change between the two most recent attempts of the selected format.

#### Scenario: Score improves
- **WHEN** the latest attempt scores higher than the previous one
- **THEN** the dashboard shows a positive point change

#### Scenario: First attempt
- **WHEN** only one attempt exists
- **THEN** no score-change comparison is shown
