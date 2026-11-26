# certification-roadmaps Specification

## Purpose

Turn each certification track into an actionable preparation dashboard that maps the existing curriculum and exams to official exam domains.

## Requirements

### Requirement: Certification domain model
Each certification track SHALL define its official domains, domain weights, and the lessons and practical tasks that prepare a learner for each domain.

#### Scenario: Domain metadata exists
- **WHEN** a learner opens a certification roadmap
- **THEN** every domain for that certification is listed with its weight and mapped preparation content

#### Scenario: Content maps to multiple domains
- **WHEN** a lesson or task supports more than one domain
- **THEN** it contributes to each mapped domain without being duplicated in the core roadmap

#### Scenario: Unknown track fails safely
- **WHEN** a learner opens a certification roadmap with an unknown track id
- **THEN** the page reports that the track was not found and links back to the core roadmap

### Requirement: Domain coverage
The dashboard SHALL show completed lessons and practiced tasks for each domain.

#### Scenario: Domain has incomplete lessons
- **WHEN** mapped lessons are incomplete
- **THEN** the domain shows its completion count and a next lesson action

#### Scenario: Domain has no mapped practice
- **WHEN** a domain has no labs or exam attempts
- **THEN** the domain shows zero practical evidence rather than a fabricated score

### Requirement: Weighted readiness
The dashboard SHALL calculate readiness from weighted domain coverage and recent exam evidence, not from total lessons completed alone.

#### Scenario: Weighted domains determine readiness
- **WHEN** a certification has domains with different official weights
- **THEN** higher-weight domains contribute more to the overall readiness score

#### Scenario: No exam evidence
- **WHEN** the learner has no relevant exam attempts
- **THEN** readiness remains below "ready" even if every lesson is complete

#### Scenario: Readiness bands
- **WHEN** the weighted score is calculated
- **THEN** the dashboard classifies it as Not ready, Almost ready, or Ready to book using documented thresholds

### Requirement: Weak-area guidance
The dashboard SHALL identify the weakest domains from recent knowledge and hands-on attempts and recommend the next action.

#### Scenario: Weak domain is highlighted
- **WHEN** recent attempts score below the domain threshold
- **THEN** the domain is marked weak and links to its mapped lessons or practice

#### Scenario: Strong domain is acknowledged
- **WHEN** a domain has sufficient coverage and recent passing evidence
- **THEN** it is marked strong rather than weak

### Requirement: Exam and task evidence
The dashboard SHALL summarize the relevant knowledge-exam and hands-on-lab history for the track.

#### Scenario: Knowledge track shows mocks
- **WHEN** a learner views KCNA or KCSA
- **THEN** recent 60-question mock scores and per-domain accuracy are shown

#### Scenario: Hands-on track shows labs
- **WHEN** a learner views CKA, CKAD, or CKS
- **THEN** recent lab scores, task pass rates, and mapped domain performance are shown

### Requirement: Preparation actions
The dashboard SHALL provide direct actions for the next lesson, applicable exam, weak practice, and full exam history.

#### Scenario: Learner starts preparation
- **WHEN** the learner selects the next domain action
- **THEN** the app opens the mapped lesson or practice surface

#### Scenario: Learner starts the exam
- **WHEN** the track supports the selected exam mode
- **THEN** the dashboard links to that exam without exposing an unsupported mode

### Requirement: Readiness history
The dashboard SHALL show readiness trend from recent attempts.

#### Scenario: Readiness improves
- **WHEN** newer attempts score higher than older attempts
- **THEN** the trend indicates improvement without hiding the underlying scores

### Requirement: First readiness snapshot
The dashboard SHALL not present a single readiness snapshot as a multi-point trend.

#### Scenario: Only one snapshot exists
- **WHEN** a learner has one saved readiness snapshot
- **THEN** the dashboard shows the current score and explains that the trend starts after the next session

#### Scenario: Multiple snapshots exist
- **WHEN** at least two snapshots exist
- **THEN** the dashboard renders compact bars with the current score

### Requirement: New content is mapped
Every new cert-focused lesson and task SHALL map to at least one official domain.

#### Scenario: Roadmap coverage
- **WHEN** certification domains are loaded
- **THEN** new installation, troubleshooting, security, and delivery content contributes to the relevant domains

### Requirement: Honest knowledge evidence
Readiness SHALL count every question selected for an attempt and treat unanswered questions as incorrect.

#### Scenario: Partial submission
- **WHEN** a learner answers one question and leaves another blank
- **THEN** domain evidence reflects one correct answer out of two

#### Scenario: Rotated question
- **WHEN** an attempt includes a question outside the static 60-question set
- **THEN** readiness still resolves that question from the full bank
