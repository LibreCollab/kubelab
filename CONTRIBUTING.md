# Contributing to Kubelab

Thanks for helping build Kubelab. This project is Apache-2.0 and welcomes
contributions of code, lessons, and design.

## Setup

```bash
mise install
mise run install
mise run check    # lint + typecheck + tests + Go tests
mise run dev      # web at http://localhost:5173
```

mise installs Go 1.27, Node 24, and pnpm 11 from [`mise.toml`](mise.toml).
Docker is optional.

## Before opening a PR

- `mise run lint`, `mise run typecheck`, `mise run test`, and
  `mise run api-test` must pass.
- UI changes should also pass `mise run e2e` (install browsers once with
  `mise run e2e-install`) and include a screenshot or short recording.
- Keep PRs focused. One concern per PR.
- New lessons must validate and include a solution (see below).

## Writing lessons

Lessons live in `packages/content/lessons/` as a YAML spec plus Markdown theory:

- `lesson-id.yaml` — objectives, scenario, checks, hints, solution.
- `lesson-id.md` — theory shown in the lesson player.

Rules:

- The YAML must validate against `lessonSpecSchema` in
  `packages/content/src/schema.ts`.
- The solution must be a real command the simulator supports.
- Keep theory short and task-focused; the terminal is the teacher.
- Add the lesson to `packages/content/src/index.ts` and a test that loads it.
- Simulated behavior must be labelled honestly when it diverges from Kubernetes.

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
