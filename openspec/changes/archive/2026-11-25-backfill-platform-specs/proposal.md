# Proposal

## Why

Kubelab has grown through many shipped milestones, but OpenSpec currently has no
capability specs. Without a baseline, future proposals cannot distinguish new
behavior from existing contracts, and reviewers must reconstruct intent from
code and prose docs. This one-time backfill records what is already shipped
before the next roadmap change is planned.

## What Changes

- Add source-of-truth specs for the current learning path, lesson player,
  cluster simulator, certification system, learner progress, content authoring,
  and delivery platform.
- Describe shipped behavior only. No runtime behavior, content, or UI changes.
- Record intentional simulator simplifications so future changes do not present
  them as complete Kubernetes behavior.
- Establish capability boundaries for future roadmap proposals.

## Capabilities

### New Capabilities

- `learning-path`: the roadmap, curriculum catalog, cert entry points, lesson
  locking, and continue/reset controls.
- `lesson-player`: theory, terminal lessons, checkpoints, hints, completion,
  and the live cluster view.
- `cluster-simulator`: deterministic in-browser Kubernetes behavior, supported
  commands, reconciliation, and explicit fidelity limits.
- `certification`: knowledge exams, hands-on lab exams, scoring, history, and
  spaced-repetition practice.
- `learner-progress`: local persistence, XP, streaks, answers, exam attempts,
  review cards, and reset behavior.
- `content-authoring`: typed YAML lesson specs, Markdown theory, schema
  validation, and authoring constraints.
- `platform-delivery`: static SPA delivery, Go API, build/test checks, and
  GitHub Pages deployment.

### Modified Capabilities

None.

## Impact

- Adds specs and a design record under `openspec/`.
- No application packages, APIs, dependencies, lesson content, or deployed
  behavior change.
- Future material changes will use deltas against these capabilities.
