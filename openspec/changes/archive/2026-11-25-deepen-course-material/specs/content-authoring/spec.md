# Spec Delta

## ADDED Requirements

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
