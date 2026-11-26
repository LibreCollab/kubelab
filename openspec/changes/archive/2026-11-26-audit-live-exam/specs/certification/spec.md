# Spec Delta

## ADDED Requirements

### Requirement: Deadline-based lab timing
The hands-on timer SHALL be calculated from an absolute deadline rather than accumulated interval ticks.

#### Scenario: Backgrounded tab
- **WHEN** a learner backgrounds the lab tab
- **THEN** returning to the lab reflects elapsed wall-clock time

### Requirement: Current lesson titles
Knowledge review links SHALL use the current lesson title from the loaded curriculum.

#### Scenario: Review a missed question
- **WHEN** a learner opens review after a knowledge exam
- **THEN** the lesson link names the current lesson rather than a stale or internal id
