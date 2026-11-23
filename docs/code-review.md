# Kubelab — Code & Design Review

> Date: 2026-11-23 · Scope: the TypeScript simulator/web packages and the Go API,
> reviewed for duplication, SOLID fit, design patterns, and Go idioms. Refactors
> were applied; this file records what changed and what was deliberately left
> alone.

## Design decisions reviewed

- **One simulation engine is still the source of truth.** Terminal output,
  lesson checks, and future animations all read the same store. No parallel
  state was introduced.
- **Layer boundaries hold.** `@kubelab/sim` knows kubectl and cluster state;
  `@kubelab/content` knows lesson specs; the web app composes them. Go owns HTTP,
  embedding, and middleware only.
- **Lean v1 holds.** No queue, cache, registry, DI container, ORM, or state
  library was added. The refactors reduce code rather than add architecture.
- **Pragmatic SOLID.** Interfaces are introduced only where there is more than
  one implementation or a real test seam (constructor options for the clock,
  `http.Handler` for middleware). Single implementations stay concrete.

## Refactors applied

| Area | Finding | Fix |
|---|---|---|
| Simulator | Pod matching (namespace/name/labels/phase) duplicated between `get pods` and lesson checks | New `selectors.ts` (`PodFilter`, `filterPods`, `matchesLabels`) used by both; semantics can no longer drift |
| Simulator | Repeated NotFound/not-simulated error construction | `notFound` / `notSimulated` helpers |
| Parser | `-o <format>` was cast without validation, so `-o json` silently behaved like `table` | Explicit `parseOutput` validation; supports `-o`, `--output`, `-o=`, `--output=`; tests added |
| Web/UI | `[...].filter(Boolean).join(" ")` repeated in Button, Card, landing | Single `cx` utility exported from `@kubelab/ui` |
| Go | `DatabaseURL` / `SessionSecret` config fields and compose env were dead | Removed until Phase 2 actually wires the DB/auth |
| Go | SPA handler re-read `index.html` per request and repeated header logic | Index pre-read once; `cacheControl` / `writeHTML` helpers |
| Go | Repeated test logger setup; `io.Discard` boilerplate | `newTestHandler` helper using `slog.DiscardHandler` |
| Go/Compose | API declared a dependency on Postgres it does not use yet | Removed the false `depends_on`; Postgres remains provisioned for Phase 2 |
| Go | Unknown `/api/*` paths fell through to the SPA and wrong methods bypassed `405` | JSON `404` for unknown API paths, explicit `405` + `Allow` via `onlyMethod`; tests added |
| E2E | Mobile test did not fail on uncaught page errors | Page-error tracking added for consistency |

## SOLID / patterns check

- **SRP**: parser, engine, selectors, lesson checks, HTTP handlers, middleware,
  and embedding each have one reason to change.
- **OCP**: kubectl verbs dispatch through a discriminated union + switch. A
  command registry was considered and rejected — with five verbs it would add
  indirection without reducing change cost.
- **LSP**: all command results share one `CommandResult` contract; union members
  are exhaustively handled.
- **ISP**: `PodFilter`, `CheckResult`, `SimEngineOptions`, and `LessonCheck` are
  narrow and purpose-built; no god interfaces.
- **DIP**: the engine accepts clock configuration and exposes events rather than
  reaching into the UI; the API accepts `http.Handler` middleware. Full
  interface-based repositories would be speculative for one in-memory store and
  one Postgres implementation.
- **Patterns in use**: strategy-like command dispatch, event bus, virtual clock
  (determinism/testability), adapter around xterm, middleware chain (Go),
  composition over inheritance, pure selector/check functions.

## Go idioms

- `net/http` method patterns, `http.Handler` middleware, `slog`, `embed` +
  `fs.Sub`, `FileServer`, table-free focused tests, `httptest`.
- Errors are returned/handled; JSON encoding errors are explicitly ignored where
  the response is already committed.
- `gofmt` and `go vet` run in CI; the binary is static, non-root, and distroless.
- Config stays a small value type with one responsibility (port).

## Intentional non-abstractions

- **Clock and event bus** both keep listener sets, but their semantics differ
  (time vs. domain events). A shared emitter would save ~10 lines and couple two
  unrelated concepts.
- **Test fixtures** for pods are duplicated across `selectors.test.ts` and
  `checks.test.ts`; sharing them would add a test-utility package for two files.
- **mise tasks vs package scripts**: mise is the entrypoint, pnpm scripts remain
  the underlying commands. The duplication is a thin, conventional indirection.
- **UI components** stay small and local; extracting a hook for the lesson
  engine would hide a linear lifecycle behind another layer.

## Remaining (deferred) improvements

- Content is parsed with Zod/YAML at runtime, which keeps authors on YAML but
  ships both parsers. A build-time content pipeline is the next bundle-size win.
- The lesson-check evaluator still lives in the web app; move it beside the
  simulator when the CI "solution passes its own checks" gate lands.
- Revisit a command registry when the kubectl surface passes ~8 verbs.
- Add Storybook when the UI surface stabilizes (trigger in architecture §14).

## Verification

`mise run lint`, `typecheck`, 21 Vitest tests, Go tests, `gofmt`, `go vet`,
`mise run build`, and 4 Playwright E2E tests all pass.
