# Proposal

## Why

The core roadmap teaches Kubernetes, but certification cards only link to exams and
one readiness lesson. Learners cannot see how the curriculum maps to official exam
domains, where they are weak, or whether they are ready to book.

## What Changes

- Add a certification domain model for KCNA, KCSA, CKA, CKAD, and CKS.
- Map core lessons and certification tasks to exam domains.
- Add a per-cert preparation dashboard with weighted domain coverage, exam/task
  performance, weak areas, attempt trend, and readiness status.
- Add one primary "Cert roadmap" entry point from the core roadmap.
- Keep the core roadmap as the learning path; certification roadmaps are a lens,
  not duplicated lesson content.
- Correct stale certification spec wording for current exam formats as part of
  implementation hygiene.

## Capabilities

### New Capabilities

- `certification-roadmaps`: per-exam domain mapping, readiness scoring, weak-area
  guidance, and preparation dashboards.

### Modified Capabilities

- `learning-path`: certification cards gain a dedicated roadmap entry point.
- `certification`: correct stale exam-count wording to match the current real-format exams.

## Impact

- New certification domain metadata and mappings in `packages/content`.
- New readiness calculation and route in `apps/web`.
- Roadmap certification card actions.
- Tests, docs, and OpenSpec specs.
