# certification Specification

## Purpose

Give learners timed knowledge checks and practical simulator exams with scoring, review, attempt history, and spaced repetition.

## Requirements

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

### Requirement: Knowledge exam scoring and review
The system SHALL score answers against the passing threshold, identify weak units, persist the attempt, and link each question to its source lesson.

#### Scenario: Passing score is reached
- **WHEN** the earned percentage meets or exceeds the exam pass mark
- **THEN** the result is marked passed

#### Scenario: Weak units are reported
- **WHEN** one or more questions are incorrect
- **THEN** the review lists the corresponding units for focused study

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

### Requirement: Paginated hands-on tasks
Hands-on exams SHALL display five task buttons per page and SHALL preserve terminal state while changing task pages.

#### Scenario: Five tasks per page
- **WHEN** a 15-task lab starts
- **THEN** the sidebar shows tasks 1-5 and indicates three pages

#### Scenario: Move between task pages
- **WHEN** the learner chooses Next or Previous
- **THEN** the sidebar shows the next/previous five tasks and selects the first task on that page

#### Scenario: Submit on final page
- **WHEN** the learner reaches the final task page
- **THEN** Submit lab exam replaces Next page

#### Scenario: Timer still auto-submits
- **WHEN** the lab timer expires on any page
- **THEN** all selected tasks are scored

### Requirement: Answer rationales
Knowledge questions SHALL support an authored explanation, and exam review SHALL show it when present.

#### Scenario: Explanation is available
- **WHEN** a learner reviews a question with an authored explanation
- **THEN** the review shows why the correct answer is correct

#### Scenario: Explanation is absent
- **WHEN** a question has no authored explanation
- **THEN** the review still shows the correct answer and lesson link

### Requirement: Incident-style practical tasks
Hands-on task pools SHALL include multi-step incident tasks that require diagnosing and correcting more than one related resource.

#### Scenario: Broken service path
- **WHEN** a CKA learner starts the service incident task
- **THEN** they must correct workload and routing state before the checks pass

#### Scenario: Broken configuration
- **WHEN** a CKAD learner starts the configuration incident task
- **THEN** they must correct the ConfigMap and workload consumption before the checks pass

### Requirement: Readiness confidence
The certification dashboard SHALL show the amount of recent evidence behind readiness and a confidence level.

#### Scenario: No attempts
- **WHEN** a learner has no recent attempts
- **THEN** confidence is None and the evidence count is zero

#### Scenario: Multiple attempts
- **WHEN** a learner has multiple recent attempts
- **THEN** confidence increases with the sample size

### Requirement: Change since last attempt
The dashboard SHALL show the score change between the two most recent attempts of the selected format.

#### Scenario: Score improves
- **WHEN** the latest attempt scores higher than the previous one
- **THEN** the dashboard shows a positive point change

#### Scenario: First attempt
- **WHEN** only one attempt exists
- **THEN** no score-change comparison is shown

### Requirement: Track-scoped hands-on pools
Each hands-on exam SHALL draw only from tasks belonging to its own certification.

#### Scenario: CKA run
- **WHEN** a CKA lab starts
- **THEN** every selected task has a CKA task id

#### Scenario: Pool rotation
- **WHEN** a learner retries a lab
- **THEN** task selection rotates within the same certification pool

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

### Requirement: Session lab suggestions
The exam intro SHALL derive suggested labs from the current rotated question set.

#### Scenario: Retake with rotation
- **WHEN** a learner retakes a knowledge exam
- **THEN** the suggested labs match the questions selected for that attempt

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

### Requirement: Spaced repetition progression
Correct review answers SHALL advance through the documented interval sequence.

#### Scenario: Repeated correct answers
- **WHEN** a learner answers the same card correctly over time
- **THEN** intervals progress through 3, 7, 14, and 30 days

#### Scenario: Incorrect answer
- **WHEN** a learner answers a due card incorrectly
- **THEN** the card returns quickly and its lapse count increases
