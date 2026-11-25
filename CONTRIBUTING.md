# Contributing to Kubelab

Thanks for helping build Kubelab. This project is Apache-2.0 and welcomes
contributions of code, lessons, and design.

## Setup

```bash
mise install
mise run install
mise run check    # lint + typecheck + tests + Go tests + spec validation
mise run dev      # web at http://localhost:5173
```

mise installs Go 1.27, Node 24, and pnpm 11 from [`mise.toml`](mise.toml).
Docker is optional.

## Spec-driven changes

Material behavior changes start in OpenSpec, not code:

```bash
pnpm spec:list
# In an agent session: /openspec-propose "add ..."
pnpm spec:validate
```

Write the proposal, delta specs, design (when needed), and tasks first. Review
the plan before implementation, then archive the change after every task and
test is complete. Read [`AGENTS.md`](AGENTS.md) and
[`openspec/config.yaml`](openspec/config.yaml) for the repository rules.

Typo, formatting, and one-line fixes with no behavior change do not need a
change folder.

## Before opening a PR

- `mise run lint`, `mise run typecheck`, `mise run test`, and
  `mise run api-test` must pass.
- UI changes should also pass `mise run e2e` (install browsers once with
  `mise run e2e-install`) and include a screenshot or short recording.
- Keep PRs focused. One concern per PR.
- Material changes must have an OpenSpec change folder; archive it when complete.
- New lessons must validate and include a solution (see below).

## Writing lessons

Lessons live in `packages/content/lessons/` as a YAML spec plus Markdown theory:

- `lesson-id.yaml` — objectives, scenario, checks, hints, solution.
- `lesson-id.md` — theory shown in the lesson player.

Rules:

- The YAML must validate against `lessonSpecSchema` in
  `packages/content/src/schema.ts`.
- Lessons are auto-discovered from `packages/content/lessons/`; no index edit is
  needed. The `unit` must exist in `packages/content/src/curriculum.ts`.
- Checks may be `pod` (cluster state), `command` (must be executed), or `quiz`
  (multiple-choice knowledge check). Quiz `id`s and check labels must be unique
  per lesson.
- The solution must be a real command the simulator supports, or a short
  explanation for quiz-only lessons.
- Keep theory short and task-focused; the terminal is the teacher for interactive
  lessons.
- Simulated behavior must be labelled honestly when it diverges from Kubernetes.
- Run `mise run test`; the loader validates every lesson and its theory file.

## Simulator changes

- Every behavior change needs a Vitest test in `packages/sim`.
- Keep the engine deterministic: no `Date.now()`, `Math.random()`, or real
  timers inside command/controller logic — use the `VirtualClock`.
- Emit events for anything the animations or checks need to observe.
- Prefer adding to the MVP subset before widening the kubectl surface.

## Commits

- Conventional, imperative subject lines: `feat: add service endpoints`,
  `fix: handle empty pod list`.
- Reference issues where relevant.
- Do not commit secrets, build output, or `.env` files.

## Governance

By contributing you agree to license your contribution under Apache-2.0.
