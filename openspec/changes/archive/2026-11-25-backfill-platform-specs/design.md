# Design

## Context

See `proposal.md` for motivation. The repository already has shipped behavior,
prose documentation, unit tests, and Playwright coverage, but no OpenSpec
capabilities. Future changes need a stable baseline without forcing a rewrite or
changing runtime behavior.

## Goals / Non-Goals

**Goals:**

- Capture the system as it exists today at a behavior level.
- Create capability boundaries that future roadmap work can extend with deltas.
- Preserve intentional simulator simplifications in the baseline.
- Make `openspec validate --strict` and existing checks pass.

**Non-Goals:**

- Change application code, lesson content, dependencies, or deployment.
- Document every lesson, command flag, or UI detail.
- Convert the remaining roadmap into active changes yet.
- Replace `README.md`, `CONTRIBUTING.md`, or architecture docs.

## Decisions

### Split the baseline into seven capabilities

Use `learning-path`, `lesson-player`, `cluster-simulator`, `certification`,
`learner-progress`, `content-authoring`, and `platform-delivery` instead of one
catch-all spec. Each owns a distinct behavior boundary and can evolve without
rewriting unrelated requirements.

Alternative considered: one `platform` capability. Rejected because future
changes would mix unrelated requirements and make deltas noisy.

### Backfill through one baseline change

The normal rule is one capability per change. This one-time baseline uses a
single change so the initial archive records a coherent snapshot of the shipped
system. Future changes should follow the normal one-capability-per-change rule.

Alternative considered: seven separate changes. Rejected as unnecessary
process overhead for a read-only documentation backfill.

### Describe behavior, not implementation

Specs use observable outcomes, routes, commands, and limitations. Internal
module names, React structure, and library choices stay in code and design docs.
This keeps future implementation refactors from forcing spec edits.

Alternative considered: mirror the package structure. Rejected because package
layout is an implementation detail that can change independently of behavior.

### Make simplifications part of the contract

The simulator spec explicitly states seeded HPA intent, snapshot log-follow,
pre-rendered Kustomize, and other limits. This prevents future lessons or
proposals from presenting them as production parity.

Alternative considered: keep limitations only in lesson prose. Rejected because
future changes might miss them and overclaim behavior.

## Risks / Trade-offs

- **Specs drift from code** → Require deltas for material behavior changes and
  validate specs in CI; update specs when implementation changes.
- **Baseline becomes too detailed** → Keep requirements at observable behavior
  level; leave per-lesson and per-command detail in code, tests, and content.
- **Capability boundaries need revision** → Use future deltas or a dedicated
  rename/removal change rather than rewriting archived baseline history.
- **Roadmap remains outside specs** → Treat future roadmap items as separate
  proposals; specs describe only what has shipped.

## Migration Plan

1. Add the baseline change artifacts.
2. Validate the change in strict mode.
3. Archive it so the capability specs become the source of truth.
4. Plan future work as deltas against those specs.
5. No runtime rollback is needed because this change ships documentation only.
