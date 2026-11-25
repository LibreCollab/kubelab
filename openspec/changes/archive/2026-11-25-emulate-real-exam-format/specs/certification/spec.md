# Spec Delta

## ADDED Requirements

### Requirement: Real exam formats
Certification tracks SHALL declare either a knowledge or hands-on exam format matching their real counterpart.

#### Scenario: Knowledge track has 60 questions
- **WHEN** a learner starts KCNA or KCSA
- **THEN** the exam contains 60 questions and runs for 90 minutes

#### Scenario: Hands-on track has tasks only
- **WHEN** a learner opens CKA, CKAD, or CKS
- **THEN** the exam is hands-on-only with a 120-minute duration and no multiple-choice section

### Requirement: Real passing scores
Knowledge tracks SHALL pass at 75%, CKA/CKAD at 66%, and CKS at 67%.

#### Scenario: Score gate is applied
- **WHEN** an exam is graded
- **THEN** pass/fail uses the track's real passing score
