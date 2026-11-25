# Spec Delta

## ADDED Requirements

### Requirement: Track-scoped hands-on pools
Each hands-on exam SHALL draw only from tasks belonging to its own certification.

#### Scenario: CKA run
- **WHEN** a CKA lab starts
- **THEN** every selected task has a CKA task id

#### Scenario: Pool rotation
- **WHEN** a learner retries a lab
- **THEN** task selection rotates within the same certification pool
