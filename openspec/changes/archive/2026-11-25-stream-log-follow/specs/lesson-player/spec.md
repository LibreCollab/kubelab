# Spec Delta

## ADDED Requirements

### Requirement: Terminal log follow mode
The terminal SHALL enter follow mode for `kubectl logs -f`, display incoming lines, and ignore normal editing until cancelled.

#### Scenario: Follow starts
- **WHEN** a learner submits a follow command for a valid Pod
- **THEN** existing log lines appear and the terminal waits for more

#### Scenario: New lines appear
- **WHEN** the simulator emits new log lines during follow
- **THEN** the terminal appends them without a new command prompt

#### Scenario: Ctrl+C stops follow
- **WHEN** the learner presses Ctrl+C during follow
- **THEN** streaming stops and the terminal returns to the command prompt

#### Scenario: Non-follow commands are unchanged
- **WHEN** a learner submits a command other than log follow
- **THEN** the terminal executes it through the normal command path
