# Spec Delta

## ADDED Requirements

### Requirement: Capstone tasks
Every hands-on track SHALL include multi-resource capstone tasks with at least four checks.

#### Scenario: Capstone selection
- **WHEN** a learner starts a CKA, CKAD, or CKS exam
- **THEN** the pool includes capstone incidents covering more than one related resource

### Requirement: Thirty-task pools
Every hands-on track SHALL expose at least 30 tasks.

#### Scenario: Pool size
- **WHEN** a hands-on track is loaded
- **THEN** its task pool has at least 30 unique tasks from that certification

### Requirement: Knowledge question rotation
Knowledge exams SHALL select a different weighted 60-question set on each attempt while preserving domain quotas.

#### Scenario: Retake
- **WHEN** a learner retakes KCNA or KCSA
- **THEN** the selected question set changes and domain counts remain weighted
