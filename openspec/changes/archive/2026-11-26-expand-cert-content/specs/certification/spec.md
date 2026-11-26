# Spec Delta

## ADDED Requirements

### Requirement: Certification-sized knowledge banks
KCNA and KCSA SHALL each expose 100 questions allocated to official domain weights.

#### Scenario: Bank size and quotas
- **WHEN** a knowledge bank is built
- **THEN** it has 100 questions and each domain contributes exactly its weight in questions

#### Scenario: Balanced options
- **WHEN** a bank is generated
- **THEN** correct answers are distributed across all four option positions

### Requirement: Broader hands-on pools
Each hands-on track SHALL expose at least 25 tasks for a 15-task exam.

#### Scenario: Track pool
- **WHEN** a CKA, CKAD, or CKS exam starts
- **THEN** it selects only from a 25-task pool for that certification
