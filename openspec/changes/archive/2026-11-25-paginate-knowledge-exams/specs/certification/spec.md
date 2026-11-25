# Spec Delta

## ADDED Requirements

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
