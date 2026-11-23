# Kubelab — Scaffolding & Planning Audit

> Date: 2026-11-23 · Status: **applied** — findings below were fixed in the
> scaffold or explicitly deferred with a trigger. Verification commands are
> listed at the end.

## Verdict

The scaffold matches the Lean v1 plan: pnpm workspace, Vite/React SPA, pure-TS
sim engine, YAML/Markdown content, Go API with embedded SPA, Envoy + Compose,
mise tasks, and CI. No new infrastructure was introduced.

**Fixed:** 39 findings. **Deferred:** 9, all phase- or trigger-gated. No
blocking issues.

A second round ran the real UI in Chromium. It caught a duplicate `<h1>`, an
xterm resize race on unmount, and the dev server binding only to IPv6 — all
fixed below.

## Findings fixed

| # | Finding | Fix |
|---|---|---|
| 1 | Lesson YAML checks were ignored; the UI hardcoded the `web` pod | Structured pod checks (namespace/name/labels/phase) + evaluator + tests; expression language removed from schema/docs |
| 2 | Lesson route statically imported xterm/marked, loading them on the landing page | Route is lazy (`lazyRouteComponent`); xterm/marked split out |
| 3 | `kubectl get -l/--selector` accepted but ignored | Selector parsing + filtering, with tests |
| 4 | `kubectl run` silently overwrote an existing Pod | Returns `AlreadyExists`, with test |
| 5 | Empty namespace message always said "default" | Uses the requested namespace or all-namespaces wording |
| 6 | Go API lacked baseline security headers | `nosniff`, frame deny, referrer policy, permissions policy; test |
| 7 | HTTP server had no read/write timeouts | 15 s read, 30 s write added |
| 8 | CI used three separate toolchain actions and broad default permissions | `jdx/mise-action`, `contents: read`, plus `gofmt` and `go vet` gates |
| 9 | Dockerfile copied only `go.mod` | `go.*` so `go.sum` is included automatically once deps exist |
| 10 | A thrown command handler would kill the terminal handler | Errors are caught and printed as `error: …` |
| 11 | Missing a11y basics | Skip-to-content link and screen-reader-only terminal heading |
| 12 | `mise run up` required a manually copied `.env` | Task copies `.env.example` on first run |
| 13 | Lesson `theory` paths could drift from the bundled file | Loader enforces `./<lesson-id>.md`; CI also runs `pnpm audit` |
| 14 | No end-to-end coverage of the real UI flow | Playwright suite: landing → lesson, terminal → checkpoint, mobile viewport, API health check through the Vite proxy; CI runs it |
| 15 | Vite bound only to IPv6 and the API proxy target was hardcoded | `host: 127.0.0.1`, `strictPort`, and `KUBELAB_API_PROXY` for an isolated E2E API port |
| 16 | Duplicate `<h1>` on the lesson page (page title + Markdown heading) | Removed the theory `h1` and the duplicated checkpoint section; page owns the heading |
| 17 | xterm `fit()` raced with unmount, throwing `dimensions` errors | Guarded `safeFit` with dispose/size checks; E2E now fails on any uncaught page error |
| 18 | Missing favicon caused a 404; Go static handler had no tests | Added `favicon.svg` and tests for SPA fallback + non-GET rejection |
| 19 | Checkpoint pass/pending state was visual only | Added screen-reader-only status text |
| 20 | E2E/typecheck config gaps | Root DOM lib for Playwright evaluate; mobile overflow test |
| 21 | Pod matching duplicated between the simulator and lesson checks | Shared `PodFilter`/`filterPods` selectors module |
| 22 | Class-name composition repeated in UI | Shared `cx` utility |
| 23 | `-o` output format cast was unchecked | Validated formats with parser tests |
| 24 | Dead Go config/env fields and duplicated test setup | Removed unused config; `slog.DiscardHandler` test helper |
| 25 | SPA re-read index per request; API declared an unused Postgres dependency | Pre-read index + helpers; removed false `depends_on` |
| 26 | Unknown `/api/*` paths returned SPA HTML and wrong methods bypassed 405 | JSON 404 for unknown API paths; 405 + `Allow` via `onlyMethod`; tests |
| 27 | E2E reused whatever occupied 5173/18081, masking a stale proxy | Dedicated E2E ports (5174/18081) and `reuseExistingServer: false` |
| 28 | Malformed label selectors/labels were silently accepted | Strict label parsing with parser tests |
| 29 | Unknown flags and extra positional args were ignored | Per-verb parsers reject both with tests |
| 30 | Label typos were invisible in the terminal, so a pending checkpoint looked wrong | Real `--show-labels` output, lesson hints, and an E2E typo test |
| 31 | Terminal scrolled out of view on long lessons | Sticky terminal on desktop with an E2E scroll test |
| 32 | Checkpoint status sat below the fold while using the sticky terminal, so a pending label looked accepted | Live “2/3 · Pending: Label app=web” strip inside the terminal panel with hints |
| 33 | Lessons did not check the container image, so a different image still passed | `image` predicate + lesson check + tests |
| 34 | Feedback/hints sat above the terminal | Moved the live checkpoint strip and hints below the terminal |
| 35 | Terminal input was append-only; paste/cursor editing could overwrite the prompt | `LineEditor` with readline keys, full-line redraw, paste handling, unit + E2E tests |
| 36 | `pod/web created` looked like success even with a wrong label/image | Every command prints `[checkpoint] … pending: …` in the terminal, with tests |
| 37 | Guided lessons still created a Pod from a mismatched `kubectl run` | Strict pre-execution guard rejects wrong name/namespace/labels/image; unit + E2E tests |
| 38 | State-only checks completed a lesson without the verification command | Command checks + engine command log; `kubectl get pods` is now required |
| 39 | Long joined “Pending: …” text in the sticky strip was hard to scan | Compact `Next:` item, remaining count, and progress meter |

Also fixed during the scaffold verification: Postgres 18 volume path, pnpm 11
build-script allowlist, gitignore excluding the embedded placeholder, Rollup
chunk-size warning, Biome/Stylelint configuration, and stale Taskfile/Playwright
references in the docs.

## Deferred (with trigger)

| Item | Why deferred | Trigger |
|---|---|---|
| `apply`, `logs`, `exec`, `scale`, `rollout`, `-o yaml` | Not used by lesson 1; faking output would teach wrong behavior | First lesson that needs it |
| Deployment/ReplicaSet/Service controllers | Simulator scope is pod lifecycle first | Unit 2 content |
| OAuth, Postgres schema, XP/streak persistence | Phase 2; anonymous-first IndexedDB comes first | Phase 2 |
| Envoy TLS, rate limits, tracing, access logs | Local scaffold runs plain HTTP; minimal config by design | Deployment to Hetzner |
| CSP | xterm injects inline styles; needs nonces/hashes, not a blind header | Before public launch |
| Markdown sanitization | Lesson content is in-repo and reviewed | User-authored content |
| Storybook | No stable design-system surface yet; E2E is now in place | Trigger table in architecture §14 |
| Pinned action SHAs / image digests | Supply-chain hardening not blocking pre-alpha | Public release |
| Multi-arch images | Current host is x86_64 | ARM deployment |

## Planning audit

- **Scope stays Lean v1.** No Redis, read replica, CDN, Loki/Tempo, Kubernetes,
  or real-cluster sandbox leaked into the scaffold.
- **Docs now match code.** The architecture doc distinguishes the Phase 1 target
  from what the scaffold implements; the lesson format uses structured checks;
  mise replaced Taskfile; testing claims were corrected.
- **Unchanged risks.** Simulator fidelity, content authoring throughput, and
  honest certification positioning remain the real risks — not infrastructure.
- **Next milestone.** Finish Phase 0 with the cluster map/pod-lifecycle
  animation, then wire XP/progress into IndexedDB before Phase 1 content.

## Verification

- `mise run lint` — Biome + Stylelint clean.
- `mise run typecheck` — all four TS packages clean.
- `mise run test` — 47 Vitest tests pass (sim, selectors, history, line editor,
  content, lesson checks, lesson guard).
- `mise run e2e` — 9 Playwright tests pass (navigation, correct + mistyped labels,
  wrong image, paste/cursor editing, sticky terminal, history recall, mobile
  viewport, API proxy), with no page errors.
- `mise run api-test` — Go tests pass, including SPA fallback and method
  rejection; `gofmt` and `go vet` clean.
- `mise run build` — Vite build clean; no chunk-size warning.
- `pnpm audit --prod` — no known vulnerabilities.
- Docker image builds; Compose stack serves `/api/healthz`, `/`, and
  `/lesson/pods-101` through Envoy; SPA embed + fallback verified; security
  headers confirmed at the edge.
