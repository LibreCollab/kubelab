# Spec Delta

## ADDED Requirements

### Requirement: Documented lesson solutions
Every interactive lesson SHALL be completable by executing the commands shown in its hints.

#### Scenario: Lesson audit runs
- **WHEN** the content test suite seeds a lesson and runs its documented commands
- **THEN** every checkpoint passes

#### Scenario: Lesson starts
- **WHEN** an interactive lesson loads before learner input
- **THEN** it is not already complete
