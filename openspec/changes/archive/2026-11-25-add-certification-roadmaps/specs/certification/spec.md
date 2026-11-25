# Spec Delta

## MODIFIED Requirements

### Requirement: Certification tracks
The platform SHALL offer KCNA, KCSA, CKA, CKAD, and CKS tracks, each with the exam modes supported by its real certification format.

#### Scenario: All tracks are selectable
- **WHEN** a learner views the certification area
- **THEN** all five tracks expose their supported exam modes

#### Scenario: Unknown track fails safely
- **WHEN** a learner opens an exam route with an unknown track id
- **THEN** the page reports that the track was not found and links back to the roadmap

### Requirement: Timed knowledge exams
A knowledge exam SHALL present 60 multiple-choice questions in pages of 10, count down from 90 minutes, submit automatically at zero, and withhold answer feedback until submission.

#### Scenario: Exam timer expires
- **WHEN** the countdown reaches zero
- **THEN** the exam submits the answers recorded so far

#### Scenario: Feedback appears after submission
- **WHEN** a learner submits before time expires
- **THEN** the review shows the score, pass state, correct answers, and selected answers

### Requirement: Hands-on lab exams
A lab exam SHALL select from its task pool, run 15 tasks in pages of five, keep checkpoints hidden until submission, and score every task check at the end.

#### Scenario: Lab starts with hidden checks
- **WHEN** a learner starts a lab exam
- **THEN** task instructions and terminals are available but checkpoint results are hidden

#### Scenario: Lab submission scores all tasks
- **WHEN** the learner submits or the lab timer expires
- **THEN** every selected task is evaluated against its checks and per-task results are shown

#### Scenario: Lab review identifies weak domains
- **WHEN** a lab task fails one or more checks
- **THEN** the review lists that task's unit as a focus area
