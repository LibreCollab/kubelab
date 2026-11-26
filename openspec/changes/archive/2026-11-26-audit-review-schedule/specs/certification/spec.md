# Spec Delta

## ADDED Requirements

### Requirement: Spaced repetition progression
Correct review answers SHALL advance through the documented interval sequence.

#### Scenario: Repeated correct answers
- **WHEN** a learner answers the same card correctly over time
- **THEN** intervals progress through 3, 7, 14, and 30 days

#### Scenario: Incorrect answer
- **WHEN** a learner answers a due card incorrectly
- **THEN** the card returns quickly and its lapse count increases
