# Spec Delta

## Purpose

Give learners timed knowledge checks and practical simulator exams with scoring, review, attempt history, and spaced repetition.

## ADDED Requirements

### Requirement: Certification tracks
The platform SHALL offer KCNA, KCSA, CKA, CKAD, and CKS tracks, each with a knowledge exam and a hands-on lab exam.

#### Scenario: All tracks are selectable
- **WHEN** a learner views the certification area
- **THEN** all five tracks expose their exam modes

#### Scenario: Unknown track fails safely
- **WHEN** a learner opens an exam route with an unknown track id
- **THEN** the page reports that the track was not found and links back to the roadmap

### Requirement: Timed knowledge exams
A knowledge exam SHALL present ten multiple-choice questions, count down from the authored duration, submit automatically at zero, and withhold answer feedback until submission.

#### Scenario: Exam timer expires
- **WHEN** the countdown reaches zero
- **THEN** the exam submits the answers recorded so far

#### Scenario: Feedback appears after submission
- **WHEN** a learner submits before time expires
- **THEN** the review shows the score, pass state, correct answers, and selected answers

### Requirement: Knowledge exam scoring and review
The system SHALL score answers against the passing threshold, identify weak units, persist the attempt, and link each question to its source lesson.

#### Scenario: Passing score is reached
- **WHEN** the earned percentage meets or exceeds the exam pass mark
- **THEN** the result is marked passed

#### Scenario: Weak units are reported
- **WHEN** one or more questions are incorrect
- **THEN** the review lists the corresponding units for focused study

### Requirement: Hands-on lab exams
A lab exam SHALL run three simulator tasks, shuffle task order per run, keep checkpoints hidden until submission, and score every task check at the end.

#### Scenario: Lab starts with hidden checks
- **WHEN** a learner starts a lab exam
- **THEN** task instructions and terminals are available but checkpoint results are hidden

#### Scenario: Lab submission scores all tasks
- **WHEN** the learner submits or the lab timer expires
- **THEN** every task is evaluated against its checks and per-task results are shown

#### Scenario: Lab review identifies weak domains
- **WHEN** a lab task fails one or more checks
- **THEN** the review lists that task's unit as a focus area

### Requirement: Attempt history
The practice page SHALL show recent knowledge and hands-on attempts with track, mode, score, pass state, and completion date.

#### Scenario: Both exam modes appear in history
- **WHEN** a learner has completed knowledge and lab attempts
- **THEN** recent history lists both modes separately

### Requirement: Spaced repetition
Missed knowledge questions SHALL enter a review queue, become due immediately, and be rescheduled after later answers using increasing intervals.

#### Scenario: Missed question is due
- **WHEN** a learner answers a question incorrectly or leaves it unanswered
- **THEN** the question appears in the due practice queue

#### Scenario: Correct review is deferred
- **WHEN** a learner answers a due review card correctly
- **THEN** its next due date moves forward instead of remaining immediately due
