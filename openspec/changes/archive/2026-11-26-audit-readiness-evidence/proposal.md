# Proposal

## Why

Readiness evidence only counted answered question IDs, so skipping questions
inflated readiness. It also resolved only the static 60-question exam set and
ignored the rotated 100-question pool.

## What Changes

- Store every attempted question ID with each knowledge attempt.
- Count unanswered questions as incorrect evidence.
- Resolve question metadata from the full pool.
- Add regression tests for both cases.

## Impact

- Exam attempt schema, readiness calculation, tests, audit docs.
