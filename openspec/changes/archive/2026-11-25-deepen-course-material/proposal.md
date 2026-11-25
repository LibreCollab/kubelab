# Proposal

## Why

The course is broad but still shallow in three places: answer feedback explains only
what was correct, capstone labs are mostly single-focus tasks, and learners have no
bridge from the simulator to a real cluster.

## What Changes

- Add optional answer explanations to knowledge questions and exam review.
- Add multi-step incident tasks to the CKA and CKAD task pools.
- Add an objective-coverage audit document that maps official domains to lessons,
  tasks, and known gaps.
- Add a real-cluster bridge guide using kind/k3d with drills and cleanup.
- Link the documentation from the README.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `certification`: answer rationales and incident-style practical tasks.
- `content-authoring`: authored explanations and objective coverage audit.
- `platform-delivery`: real-cluster bridge documentation.

## Impact

- Content schemas/exam data, certification task seeds, exam review UI.
- Documentation and tests.
