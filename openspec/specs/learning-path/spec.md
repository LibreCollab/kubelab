# learning-path Specification

## Purpose

Give learners an ordered Kubernetes curriculum, visible completion state, and clear entry points into certification exams.

## Requirements

### Requirement: Roadmap catalog
The roadmap SHALL present twelve core units and five certification tracks, with each lesson exposing its title, XP value, and current access state.

#### Scenario: Learner opens the roadmap
- **WHEN** a learner opens the home route
- **THEN** the roadmap lists core units in curriculum order and shows certification tracks separately

#### Scenario: Progress is visible per lesson
- **WHEN** a learner has completed some lessons
- **THEN** completed, current, available, and locked lessons are visually distinguishable

### Requirement: Sequential lesson access
A lesson SHALL be unlocked when it is first in the curriculum, follows a completed lesson, has all prerequisites completed, or is already completed.

#### Scenario: First lesson is available
- **WHEN** a learner has no completed lessons
- **THEN** the first core lesson is available and marked current

#### Scenario: Later lessons are locked
- **WHEN** a prerequisite or the preceding lesson is incomplete
- **THEN** the dependent lesson is locked and is not rendered as a navigation link

#### Scenario: Completed lesson stays accessible
- **WHEN** a learner revisits a completed lesson
- **THEN** the lesson remains accessible even if later ordering changes

### Requirement: Continue and reset controls
The roadmap SHALL offer continuation into the current or most recently visited lesson and SHALL require confirmation before erasing local progress.

#### Scenario: Continue after returning
- **WHEN** a learner returns to the roadmap with saved progress
- **THEN** the primary action continues the current lesson, or the last visited lesson when no current lesson exists

#### Scenario: Reset is confirmed
- **WHEN** a learner confirms the reset prompt
- **THEN** lesson progress, XP, streaks, exam attempts, and review cards are cleared and the roadmap re-locks lessons

### Requirement: Certification entry points
Each certification track SHALL expose separate knowledge-exam and hands-on-lab entry points.

#### Scenario: Learner chooses an exam mode
- **WHEN** a learner views a certification track
- **THEN** the track offers links to its knowledge exam and hands-on lab

### Requirement: Expanded workload lessons
The curriculum SHALL include terminal lessons for Jobs, StatefulSets, DaemonSets, and init containers.

#### Scenario: Workload lesson is available
- **WHEN** a learner reaches the workloads unit
- **THEN** each new workload kind has an interactive lesson with checks

### Requirement: Governance and networking lessons
The curriculum SHALL include terminal lessons for PodDisruptionBudgets, ResourceQuota/LimitRange, affinity, TLS Ingress, and cluster-scoped RBAC.

#### Scenario: New feature has exercise
- **WHEN** a learner opens one of the new lessons
- **THEN** the lesson uses the corresponding simulator feature and has verification checks

### Requirement: No quiz-only core lessons
Every core unit lesson SHALL include at least one non-quiz checkpoint.

#### Scenario: Containers lesson is interactive
- **WHEN** a learner opens containers-101
- **THEN** they can run and verify a Pod in the terminal
