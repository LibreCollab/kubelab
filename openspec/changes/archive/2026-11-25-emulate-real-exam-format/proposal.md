# Proposal

## Why

The current mock exams are 10 questions for every track. Real KCNA/KCSA exams are
60-question, 90-minute knowledge exams, while CKA/CKAD/CKS are 120-minute hands-on
exams with 15–20 tasks and no multiple-choice section.

## What Changes

- Add exam format metadata: knowledge vs hands-on.
- Set KCNA/KCSA to 60 questions, 90 minutes, 75% passing.
- Set CKA/CKAD/CKS to hands-on-only, 15 tasks, 120 minutes, 66/67% passing.
- Build larger cross-track technical task pools for hands-on exams.
- Hide knowledge-exam entry points for hands-on-only tracks.
- Update the exam runner and E2E tests.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `certification`: real-format durations, counts, pass marks, and exam modes.
- `lesson-player`: hands-on-only exam messaging and durations.

## Impact

- Content exam metadata and task pools.
- Roadmap links, exam/lab pages, tests.
