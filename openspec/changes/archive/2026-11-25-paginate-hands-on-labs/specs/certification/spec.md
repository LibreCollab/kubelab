# Spec Delta

## ADDED Requirements

### Requirement: Paginated hands-on tasks
Hands-on exams SHALL display five task buttons per page and SHALL preserve terminal state while changing task pages.

#### Scenario: Five tasks per page
- **WHEN** a 15-task lab starts
- **THEN** the sidebar shows tasks 1–5 and indicates three pages

#### Scenario: Move between task pages
- **WHEN** the learner chooses Next or Previous
- **THEN** the sidebar shows the next/previous five tasks and selects the first task on that page

#### Scenario: Submit on final page
- **WHEN** the learner reaches the final task page
- **THEN** Submit lab exam replaces Next page

#### Scenario: Timer still auto-submits
- **WHEN** the lab timer expires on any page
- **THEN** all selected tasks are scored
