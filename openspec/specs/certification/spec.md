# certification Specification

## Purpose

Give learners timed knowledge checks and practical simulator exams with scoring, review, attempt history, and spaced repetition.

## Requirements

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

### Requirement: Dedicated task scenarios
Certification tasks SHALL define their own scenarios and checks instead of inheriting a lesson's full scenario.

#### Scenario: Task uses independent scenario
- **WHEN** a lab task is selected
- **THEN** its scenario and checks come from the certification task catalog

#### Scenario: Task overview is stable
- **WHEN** the task is displayed
- **THEN** it has a stable title, unit, instruction, and grading checks

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

### Requirement: Paginated knowledge exams
Knowledge exams SHALL display ten questions per page and SHALL preserve answers while navigating.

#### Scenario: First page shows ten questions
- **WHEN** a 60-question exam starts
- **THEN** page one shows ten questions and a page indicator

#### Scenario: Move forward and back
- **WHEN** the learner chooses Next or Previous
- **THEN** the page changes without losing selected answers

#### Scenario: Submit on final page
- **WHEN** the learner reaches the final page
- **THEN** the Submit exam action is available instead of Next

#### Scenario: Timer still auto-submits
- **WHEN** the countdown expires on any page
- **THEN** the exam submits all answers recorded so far
