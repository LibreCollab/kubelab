# Spec Delta

## Purpose

Let learners read short theory, practice Kubernetes commands in context, see checkpoints react, and inspect the simulated cluster state behind each change.

## ADDED Requirements

### Requirement: Lesson content and objectives
A lesson page SHALL show the lesson title, unit, XP value, objectives, and authored theory while preserving navigation back to the roadmap.

#### Scenario: Learner opens a lesson
- **WHEN** a learner navigates to an unlocked lesson
- **THEN** the page shows its theory, objectives, XP, and current checkpoint state

### Requirement: Interactive and theory lesson modes
Lessons with non-quiz checks SHALL provide the simulated terminal; quiz-only lessons SHALL present knowledge checks without a terminal.

#### Scenario: Interactive lesson shows terminal
- **WHEN** a lesson contains a pod, command, deployment, service, configuration, DNS, ingress, or environment check
- **THEN** the lesson exposes the terminal and cluster controls

#### Scenario: Theory lesson stays quiz-only
- **WHEN** every check in a lesson is a quiz
- **THEN** the terminal is hidden and the quiz cards are available

### Requirement: Live checkpoints
The lesson SHALL re-evaluate checks after commands and simulator ticks, show passed and pending checks, and list the next unmet checkpoint.

#### Scenario: Checkpoint passes
- **WHEN** the learner creates the expected resource or runs the required command
- **THEN** the corresponding checkpoint becomes passed without a page reload

#### Scenario: Checkpoint remains pending
- **WHEN** the cluster state or command history does not satisfy a check
- **THEN** the checkpoint stays pending and the next-check indicator names it

### Requirement: Guided command validation
Guided lessons SHALL reject a mismatched `kubectl run` before it mutates the cluster when the pod name, namespace, labels, or image differ from the lesson requirement.

#### Scenario: Wrong pod image is rejected
- **WHEN** a learner runs a guided pod command with the wrong image
- **THEN** the terminal reports the mismatch and no Pod is created

#### Scenario: Read-only commands remain unaffected
- **WHEN** a learner runs a non-mutating command in a guided lesson
- **THEN** the command executes with normal simulator behavior

### Requirement: Hints and completion
Lessons SHALL provide authored hints while checks are pending and SHALL award the lesson XP exactly once when every check passes.

#### Scenario: Learner requests a hint
- **WHEN** pending checks exist and hints were authored
- **THEN** the hint disclosure is available

#### Scenario: Lesson completion is idempotent
- **WHEN** all checks pass for an incomplete lesson
- **THEN** the lesson is marked complete and its XP is awarded once

### Requirement: Cluster visualization
The lesson SHALL expose a cluster status control and a map view whose resources reflect the same simulator state used by terminal output and checks.

#### Scenario: Mutating command updates the scene
- **WHEN** a learner runs a successful mutating command
- **THEN** the cluster scene becomes available and can replay the change

#### Scenario: Read-only command does not open the scene
- **WHEN** a learner runs a read-only command
- **THEN** no change scene is opened

#### Scenario: Inspector is dismissible
- **WHEN** the learner opens the cluster status inspector
- **THEN** the learner can close it without losing lesson or terminal state
