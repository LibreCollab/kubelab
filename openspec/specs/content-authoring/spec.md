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

### Requirement: Authored explanations
Quiz checks and certification-only questions SHALL accept an optional explanation distinct from the prompt and answer options.

#### Scenario: Explanation schema
- **WHEN** content authors add an explanation
- **THEN** it is preserved through content loading and exam construction

### Requirement: Objective coverage audit
The repository SHALL document each certification's official domains, mapped lessons and tasks, and known content gaps.

#### Scenario: Audit is available
- **WHEN** a maintainer reviews certification coverage
- **THEN** a single document lists domain weights, mapped content, and identified gaps

### Requirement: Complete quiz rationales
Every lesson quiz SHALL resolve to an authored explanation.

#### Scenario: Lesson quiz review
- **WHEN** any lesson quiz is loaded
- **THEN** its check contains an explanation

### Requirement: Readiness evidence metadata
The certification objective audit SHALL record the review date and the machine-readable domain source.

#### Scenario: Audit is reviewed
- **WHEN** a maintainer opens the objective audit
- **THEN** the review date, source catalog, domain weights, mapped tasks, and gaps are visible

### Requirement: Documented lesson solutions
Every interactive lesson SHALL be completable by executing the commands shown in its hints.

#### Scenario: Lesson audit runs
- **WHEN** the content test suite seeds a lesson and runs its documented commands
- **THEN** every checkpoint passes

#### Scenario: Lesson starts
- **WHEN** an interactive lesson loads before learner input
- **THEN** it is not already complete

### Requirement: Teaching depth
Every teaching lesson SHALL contain between 150 and 250 words.

#### Scenario: Lesson review
- **WHEN** the content depth test runs
- **THEN** every non-readiness lesson passes the word range

### Requirement: Certification coverage
The teaching set SHALL cover cluster installation, etcd recovery, certificates,
troubleshooting, multi-container design, runtime hardening, supply chain,
threat modeling, and the CNCF ecosystem.

#### Scenario: Expanded curriculum
- **WHEN** the curriculum is loaded
- **THEN** at least 54 teaching lessons are available

### Requirement: Executable hints
Every command shown in a lesson hint SHALL execute successfully in that lesson's scenario.

#### Scenario: Hint audit
- **WHEN** the completability test runs a documented command
- **THEN** the simulator returns a successful result before checkpoints are evaluated
