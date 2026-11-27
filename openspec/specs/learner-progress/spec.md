# learner-progress Specification

## Purpose

Persist a learner's local lesson, XP, streak, exam, and review state so progress survives reloads without an account.

## Requirements

### Requirement: Local persistence
Learner progress SHALL persist in browser storage and SHALL remain available after a reload without requiring a backend account.

#### Scenario: Progress survives reload
- **WHEN** a learner reloads the app after completing a lesson
- **THEN** the lesson remains complete and its XP remains counted

#### Scenario: Storage upgrades preserve data
- **WHEN** a learner opens a newer app version with an older local database
- **THEN** existing lessons, attempts, and review cards remain readable

### Requirement: Lesson state
The system SHALL store each lesson's in-progress or completed status, quiz answers, XP, completion time, and last update time.

#### Scenario: Quiz answers are saved
- **WHEN** a learner selects answers in a lesson
- **THEN** the latest answers are stored with that lesson

#### Scenario: Completion records activity
- **WHEN** a lesson is completed for the first time
- **THEN** its completion timestamp and activity date are recorded

### Requirement: XP and completion totals
The system SHALL count XP only for completed lessons and SHALL expose total completed lessons and total XP to the roadmap.

#### Scenario: Incomplete lesson does not earn XP
- **WHEN** a lesson is started but not completed
- **THEN** its XP is excluded from the total

### Requirement: Daily streaks
The system SHALL compute a streak from consecutive activity dates, allowing today's activity or yesterday's chain to keep the streak active.

#### Scenario: Consecutive days continue streak
- **WHEN** a learner completes lessons on consecutive calendar days
- **THEN** the streak count increases across those days

#### Scenario: Missed day breaks streak
- **WHEN** neither today nor yesterday has recorded activity
- **THEN** the current streak is zero

### Requirement: Combined reset
Resetting progress SHALL clear lessons, metadata, knowledge attempts, lab attempts, review cards, and readiness snapshots after explicit confirmation.

#### Scenario: Reset clears certification data
- **WHEN** a learner confirms a full reset
- **THEN** lesson progress, both exam histories, review cards, and readiness snapshots are empty
