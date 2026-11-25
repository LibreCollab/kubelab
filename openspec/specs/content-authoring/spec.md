# content-authoring Specification

## Purpose

Keep lessons maintainable as typed, validated source files so curriculum, checks, scenarios, and theory stay consistent across the app.

## Requirements

### Requirement: Lesson source layout
Each lesson SHALL consist of a YAML spec and a Markdown theory file in the content lesson directory, discovered automatically at build time.

#### Scenario: Lesson is discovered
- **WHEN** a new lesson pair is added to the lesson directory
- **THEN** it appears in the loaded curriculum without editing a central lesson index

#### Scenario: Identity mismatch fails the build
- **WHEN** a lesson file name, lesson id, or theory path do not agree
- **THEN** content loading fails with a descriptive error

### Requirement: Required lesson metadata
A lesson spec SHALL define id, unit, title, XP, order, strictness, prerequisites, theory path, scenario, objectives, checks, hints, and a solution.

#### Scenario: Valid metadata loads
- **WHEN** a lesson includes all required fields and references a known unit
- **THEN** the lesson loads and participates in roadmap ordering

#### Scenario: Unknown unit is rejected
- **WHEN** a lesson references a unit that is not defined in the curriculum
- **THEN** content loading fails

#### Scenario: Empty scenario is rejected
- **WHEN** a lesson declares no scenario nodes
- **THEN** schema validation rejects the lesson

### Requirement: Check types
Lessons SHALL support pod, command, deployment, service, ConfigMap, Secret, environment, DNS, Ingress, and quiz checks.

#### Scenario: Supported checks evaluate
- **WHEN** a lesson uses any supported check type
- **THEN** the lesson player evaluates it against simulator state or command history

#### Scenario: Duplicate check labels are rejected
- **WHEN** two checks in one lesson share a label
- **THEN** content loading fails

#### Scenario: Invalid quiz is rejected
- **WHEN** a quiz answer index is out of range or options repeat
- **THEN** schema validation rejects the quiz

### Requirement: Scenario object validation
Seeded scenario objects SHALL use supported Kubernetes or teaching kinds and SHALL include the shape required by each kind.

#### Scenario: Pod scenario requires containers
- **WHEN** a seeded Pod omits `spec.containers`
- **THEN** validation rejects the scenario

#### Scenario: Namespace scenario requires a phase
- **WHEN** a seeded Namespace omits `status.phase`
- **THEN** validation rejects the scenario

### Requirement: Authoring quality rules
Authored lessons SHALL provide a worked solution, keep theory task-focused, and label behavior that differs from real Kubernetes.

#### Scenario: Solution is present
- **WHEN** a lesson is reviewed
- **THEN** it contains a real simulator-supported command or an explicit quiz-only explanation

#### Scenario: Simplification is honest
- **WHEN** a lesson demonstrates a simplified Kubernetes behavior
- **THEN** the theory or hints disclose the limitation instead of implying production parity

### Requirement: Curriculum integrity checks
Content validation SHALL reject missing or self-referential prerequisites and SHALL verify certification task pool integrity.

#### Scenario: Missing prerequisite is rejected
- **WHEN** a lesson references an unknown prerequisite
- **THEN** the content test fails

#### Scenario: Task pools are valid
- **WHEN** certification exams load
- **THEN** each pool exceeds its run size and task IDs are unique
