# Kubelab agent guide

Kubelab is a pnpm monorepo: React/Vite web app, deterministic TypeScript
Kubernetes simulator, typed lesson content, shared UI, and a small Go API. The
public preview is static; accounts, Postgres, and progress sync are not
implemented.

## Spec-driven development

This repository uses [OpenSpec](https://openspec.dev). Specs are the source of
truth for behavior, not chat history or implementation details.

Use `/openspec-propose "<idea>"` before implementing a material change, then:

1. Explore the existing code and constraints.
2. Propose `proposal.md`, delta `specs/`, optional `design.md`, and `tasks.md`.
3. Review and correct the plan before writing code.
4. Apply the change, checking off tasks as work lands.
5. Archive only after tests pass and every task is complete.

Material changes include user-visible features, new lessons or exams, simulator
semantics, content/schema changes, dependency additions, and cross-package
refactors. A typo, formatting-only edit, or one-line fix with no behavior change
does not need a change folder. If behavior is ambiguous, propose first.

OpenSpec artifacts live in:

- `openspec/config.yaml` — project context and workflow rules.
- `openspec/changes/<change>/` — active proposals, deltas, designs, tasks.
- `openspec/specs/` — archived source-of-truth capabilities.
- `openspec/changes/archive/` — completed change history.

Do not edit archived changes. Update the active change instead. Do not create
specs for work that has not been agreed; propose it first.

## Commands

- `pnpm dev` — web dev server.
- `pnpm check` — lint, typecheck, Vitest, and Go tests.
- `pnpm test:e2e` — Playwright; required for routes, terminal, lesson, exam, or responsive UI work.
- `pnpm build` — production build.
- `pnpm spec:list` — list active changes and specs.
- `pnpm spec:validate` — validate changes and specs.

Read `CONTRIBUTING.md` for lesson and simulator conventions. Check `git status`
before editing and keep unrelated worktree changes out of the task.

## Implementation constraints

- Keep TypeScript strict. Use CSS Modules/Sass and the existing dark blueprint
  design language; do not add Tailwind.
- Keep the simulator deterministic: use `VirtualClock`, no `Math.random` or real
  timers inside command/controller logic. Tests must be reproducible.
- Terminal output, lesson checks, and visualizations must share simulator state.
- Label intentional Kubernetes simplifications honestly in content and specs.
- Add tests with behavior. Simulator changes need Vitest coverage; browser flows
  need Playwright. Update docs for user-visible behavior.
- Do not commit, amend, push, or open a PR unless the user explicitly asks.
