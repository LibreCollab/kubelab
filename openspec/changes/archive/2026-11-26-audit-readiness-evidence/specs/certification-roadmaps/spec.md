# Spec Delta

## ADDED Requirements

### Requirement: Honest knowledge evidence
Readiness SHALL count every question selected for an attempt and treat unanswered questions as incorrect.

#### Scenario: Partial submission
- **WHEN** a learner answers one question and leaves another blank
- **THEN** domain evidence reflects one correct answer out of two

#### Scenario: Rotated question
- **WHEN** an attempt includes a question outside the static 60-question set
- **THEN** readiness still resolves that question from the full bank
