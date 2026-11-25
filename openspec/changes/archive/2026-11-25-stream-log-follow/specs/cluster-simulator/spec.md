# Spec Delta

## ADDED Requirements

### Requirement: Incremental log following
The simulator SHALL expose a log-follow subscription that emits current Pod logs and then newly appended lines until stopped.

#### Scenario: Existing logs are emitted
- **WHEN** a learner follows logs for a Pod with existing output
- **THEN** the subscription emits the existing lines immediately

#### Scenario: New logs are emitted
- **WHEN** the Pod's log output grows while follow is active
- **THEN** the next clock tick emits only the new lines

#### Scenario: Stop cancels updates
- **WHEN** a follow subscription is stopped
- **THEN** later Pod log changes emit nothing

#### Scenario: Invalid follow target
- **WHEN** follow is requested for a missing Pod or invalid container
- **THEN** the subscription reports the same error as a one-shot log command
