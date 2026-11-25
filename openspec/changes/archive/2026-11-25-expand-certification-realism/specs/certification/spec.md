# Spec Delta

## ADDED Requirements

### Requirement: Expanded task pools
Each certification track SHALL expose a task pool larger than the number of tasks used in one run.

#### Scenario: Run selects a subset
- **WHEN** a track has more pooled tasks than its run size
- **THEN** a run uses only the configured number of tasks

#### Scenario: Randomized selection
- **WHEN** a learner starts a retake
- **THEN** the selected task subset/order can differ from the previous run

### Requirement: Dedicated task checks
Certification tasks SHALL be able to define their own checks instead of inheriting every lesson checkpoint.

#### Scenario: Override is used
- **WHEN** a task provides an explicit check list
- **THEN** grading uses that list

### Requirement: Larger rotating question bank
Knowledge exams SHALL draw ten questions from a larger pool using deterministic track-based rotation.

#### Scenario: Different tracks see different questions
- **WHEN** two tracks share an eligible unit pool
- **THEN** their exam question sets can differ

### Requirement: Lab pass gate
Hands-on exams SHALL pass when the earned checkpoint percentage meets the track passing score.

#### Scenario: Partial score passes
- **WHEN** the lab percentage meets the passing score
- **THEN** the attempt is marked passed even if some tasks are incomplete

### Requirement: Domain trends
The practice page SHALL summarize weak domains from recent lab attempts.

#### Scenario: Weak domain is shown
- **WHEN** recent lab attempts contain failed tasks
- **THEN** the practice page lists the affected domains
