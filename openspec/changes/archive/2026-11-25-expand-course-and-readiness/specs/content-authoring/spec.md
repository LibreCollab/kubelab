# Spec Delta

## ADDED Requirements

### Requirement: Complete quiz rationales
Every lesson quiz SHALL resolve to an authored explanation.

#### Scenario: Lesson quiz review
- **WHEN** any lesson quiz is loaded
- **THEN** its check contains an explanation

### Requirement: Readiness evidence metadata
The certification objective audit SHALL record the review date and the machine-readable domain source.

#### Scenario: Audit is reviewed
- **WHEN** a maintainer opens the objective audit
- **THEN** the review date, source catalog, domain weights, mapped tasks, and gaps are visible
