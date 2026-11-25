# Spec Delta

## ADDED Requirements

### Requirement: Curriculum integrity checks
Content validation SHALL reject missing or self-referential prerequisites and SHALL verify certification task pool integrity.

#### Scenario: Missing prerequisite is rejected
- **WHEN** a lesson references an unknown prerequisite
- **THEN** the content test fails

#### Scenario: Task pools are valid
- **WHEN** certification exams load
- **THEN** each pool exceeds its run size and task IDs are unique
