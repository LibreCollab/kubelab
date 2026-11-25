# Proposal

## Why

Certification labs still reuse lesson checkpoints, always run three tasks in a
fixed pool, and pass only when every task is perfect. The knowledge pool is also
small, so exams repeat the same questions.

## What Changes

- Add larger per-track task pools and randomized task selection.
- Add longer CKA/CKAD/CKS sessions and dedicated KCNA/KCSA task choices.
- Allow explicit task check overrides so exam tasks are not identical to lesson checks.
- Expand the certification question bank and rotate questions deterministically.
- Gate lab pass/fail on the exam passing percentage instead of requiring every task.
- Surface weak-domain trends from recent lab attempts.
- Update tests and E2E expectations.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `certification`: task pools, randomization, bank size, pass gates, and trends.
- `lesson-player`: updated lab-runner task count and duration.

## Impact

- `packages/content` exam/task builder and question bank.
- `apps/web` lab exam and practice pages.
- Tests, E2E, docs.
