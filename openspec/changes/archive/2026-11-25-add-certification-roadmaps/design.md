# Design

## Context

See `proposal.md` and `specs/certification-roadmaps/spec.md`. Kubelab already has
core lessons, a 60-question KCNA/KCSA exam format, 15-task hands-on exams, local
attempt history, and weak-unit reporting. It lacks an official-domain model and a
per-cert preparation view.

## Goals / Non-Goals

**Goals:**

- Make each certification card open a preparation dashboard.
- Map existing lessons and tasks to official domains without duplicating lessons.
- Show weighted readiness, domain coverage, evidence, weak areas, and next action.
- Keep readiness honest when there is no exam evidence.
- Reuse local attempt history and stay backend-free.

**Non-Goals:**

- Official certification claims or booking integration.
- New lesson content for every domain gap.
- Server-side analytics or cross-device readiness history.
- Replacing the core roadmap with five separate curricula.

## Decisions

### One certification-domain catalog

Add a typed `certificationRoadmaps` catalog in `packages/content`:

```ts
interface CertificationDomain {
  id: string;
  trackId: string;
  title: string;
  weight: number;
  lessonIds: string[];
  taskIds: string[];
  questionUnits: string[];
}
```

The catalog is the only source of domain names, weights, and mappings. Domain
weights are authored from the current CNCF candidate handbooks and validated to
sum to 100 per track. Tests fail if a mapping references an unknown lesson or task.

Alternative considered: derive domains from lesson units automatically. Rejected
because official domains cut across units and weights matter.

### Readiness is coverage plus recent evidence

For each domain:

```text
coverage = completed mapped lessons / mapped lessons
evidence = recent three relevant attempts:
  knowledge: per-domain question accuracy
  hands-on: mapped-task pass rate
domainScore = round(45% coverage + 55% evidence)
overall = weighted average of domain scores
```

If there is no evidence, evidence is zero, so finishing every lesson cannot make a
track "ready". Readiness bands:

- `0-64`: Not ready
- `65-84`: Almost ready
- `85-100`: Ready to book

Weak domains are below 65; strong domains are 85 or above.

### Evidence mapping stays explicit

Knowledge questions already carry a unit, so domains declare `questionUnits` for
accuracy aggregation. Hands-on tasks are assigned by task ID. A task can contribute
to multiple domains only when explicitly mapped.

### Dashboard is a lens, not a second curriculum

The dashboard shows domain cards, coverage, evidence, weak/strong state, and a
direct next action (lesson, lab task, or exam). The core roadmap remains the
authoritative lesson sequence.

### Local readiness snapshots

Add a Dexie `readinessSnapshots` table keyed by `id` with `trackId`, `dateKey`, and
score. The dashboard writes at most one snapshot per track per day, then uses the
last five snapshots for trend. No backend migration is required.

## UI plan

Route: `/certification/$trackId`

- Header: track name, format, exam counts/durations/pass mark, readiness band.
- Primary card: weighted readiness, last evidence, next best action.
- Domain grid: weight, lesson completion, recent accuracy or task pass rate,
  weak/strong label, links to mapped lessons/practice.
- Evidence panel: last five knowledge/lab scores and readiness trend.
- Exam actions: only the supported mode for that track.

Core roadmap cert cards gain `Certification roadmap ->` and retain supported exam
actions.

## Risks / Trade-offs

- **Domain weights drift** -> Central catalog plus validation and a documented
  source/date for each weight set.
- **Small samples look authoritative** -> Label evidence as recent local practice,
  not an official prediction.
- **Domain mapping is judgment-heavy** -> Explicit lesson/task IDs and tests for
  unknown references; allow multiple domain mappings.
- **Readiness history starts empty** -> Trend appears after daily dashboard visits;
  show "not enough history" until then.
- **Mastery is not certification** -> Keep the existing disclaimer that mocks are
  practice, not guarantees.

## Migration plan

1. Add domain metadata and tests.
2. Add pure readiness functions and tests.
3. Add Dexie version 4 for readiness snapshots.
4. Add dashboard route and roadmap link.
5. Add unit/E2E/axe coverage.
6. Validate specs, archive, and push.

No production data migration is needed because all progress is local.
