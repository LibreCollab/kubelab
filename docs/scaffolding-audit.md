# Kubelab - Scaffolding & Planning Audit

> Date: 2026-11-25 · Status: **applied** - findings below were fixed in the
> scaffold or explicitly deferred with a trigger. Verification commands are
> listed at the end.

## Verdict

The scaffold matches the Lean v1 plan: pnpm workspace, Vite/React SPA, pure-TS
sim engine, YAML/Markdown content, Go API with embedded SPA, Envoy + Compose,
mise tasks, and CI. No new infrastructure was introduced.

**Fixed:** 54 findings. **Deferred:** 9, all phase- or trigger-gated. No
blocking issues.

A second round ran the real UI in Chromium. It caught a duplicate `<h1>`, an
xterm resize race on unmount, and the dev server binding only to IPv6 - all
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
| 40 | Only one lesson and no certification entry points | 34 lessons across 12 units + 5 cert readiness checks; dynamic roadmap |
| 41 | Theory lessons had no way to complete | Quiz checks + knowledge-check UI |
| 42 | Deployment/Service theory pointed at unsupported terminal commands | Added Deployment/ReplicaSet/Service controllers and converted both lessons to interactive checkpoints |
| 43 | Quiz-only lessons showed a dead terminal | Terminal omitted entirely; single-column theory/quiz with inline feedback |
| 44 | CTA jumped into Unit 3 despite being labelled “first lesson” | CTA links to the actual first lesson (`containers-101`) |
| 45 | Theory lessons still showed clock controls and ticked the simulator | Clock controls hidden; engine starts only for interactive lessons |
| 46 | Theory repeated a “Knowledge check” heading above the quiz component | Removed the duplicate section from 27 lessons |
| 47 | Rounded soft roadmap cards still read as generic/Claude-like | Blueprint-style cards: numbered tabs, dashed lesson rows, hard shadows, separate cert accent |
| 48 | Lesson lists were bottom-aligned by `margin-top: auto`, so short units looked broken | Top-aligned lists with fixed title/description rows; E2E alignment test |
| 49 | No persistence, XP, streaks, or lesson unlocking | Dexie local progress, saved quiz answers, linear unlocks, continue/next, reset; E2E reload test |
| 50 | Pause/Resume clock was shown on command-only lessons where it had no visible effect | Clock controls only appear when a lesson has Pod/workload timing checks; E2E test |
| 51 | Lesson screen still used soft rounded cards and generic radio rows | Sharp briefing panel, A/B/C quiz keys, flat checkpoint rows, hard-shadow terminal |
| 52 | Favicon was crude and the header used a typed K | Shared filled-K SVG mark and favicon |
| 53 | Header K went to the roadmap instead of the primary lesson CTA | Brand link starts the first lesson |
| 54 | No public deployment path for the Kubelab subdomain | GitHub Pages workflow, CNAME, SPA 404 fallback, DNS docs |
| 55 | Landing page promised under-the-hood animations; lessons only showed text terminal output | Live cluster map for Nodes → Deployments → ReplicaSets → Pods and Services → Endpoints |
| 56 | DNS and Ingress lessons were quiz-only despite being core Unit 4 skills | Simulator now resolves Service DNS and routes HTTP through Ingress; both lessons are terminal checkpoints |
| 57 | ConfigMaps and Secrets were quiz-only despite being core Unit 5 skills | Added configmap/secret creation, envFrom wiring, env checks, and redacted Secret display |
| 58 | Units 6-10 were quiz-only despite covering core CKA/security/ops skills | Added seeded storage, scheduling, network policy, RBAC, event/log, and probe inspection scenarios with terminal checkpoints |
| 59 | Units 11-12 and certification tracks were quiz-only | Added Helm/Kustomize/GitOps/CRD terminal scenarios, timed knowledge and hands-on lab exams, scoring/review, history, and spaced repetition |
| 60 | Probes were static seeded conditions with no restart behavior | Added readiness/liveness evaluation, restarts, warning events, endpoint removal, and CrashLoopBackOff |
| 61 | Networking, storage, and RBAC lacked relationship depth | Added NetworkPolicy ports, headless/NodePort Services, PVC reclaim and delayed binding, and cluster-scoped RBAC |
| 62 | Only Deployments and ReplicaSets represented workload controllers | Added init containers, DaemonSets, StatefulSets, Jobs, CronJobs, scheduling, completion, and inspection |
| 63 | Scheduling stopped at node selectors and taints | Added affinity, topology spread, LimitRange defaults, ResourceQuota, and PDB status |
| 64 | `logs -f` was a one-shot snapshot | Added incremental log subscriptions and terminal follow mode with Ctrl+C cancellation |
| 65 | HPA only handled CPU and scaled on tiny deviations | Added memory targets and a 10% tolerance band |
| 66 | Remaining simulator fidelity gaps | Added TLS, ServiceAccount tokens, Pod Security, startup/gRPC probes, event expiry, external HPA, Kustomize patches, Helm lifecycle, Argo drift, and Widget children |
| 67 | New simulator features had no lessons and containers-101 stayed quiz-only | Added nine terminal lessons and converted the last quiz-only core lesson |
| 68 | Mock exams used a 10-question format for every track | Matched KCNA/KCSA 60-question knowledge and CKA/CKAD/CKS 15-task hands-on formats |
| 69 | A 60-question exam was one very long page | Added 10-question pages with Previous/Next and final-page Submit |
| 70 | Hands-on labs listed all 15 tasks in one sidebar | Added five-task pages with Previous/Next and final-page Submit |
| 71 | Residual XSS, CSP, question relevance, and audit gaps | Sanitized Markdown, added production CSP, tightened knowledge pools, and added axe/Lighthouse CI gates |
| 72 | Certification cards did not map curriculum to official exam domains | Added per-certification roadmaps with weighted readiness, weak areas, next actions, and local trends |
| 73 | Course feedback lacked rationales and practical incidents | Added authored answer explanations, multi-step CKA/CKAD incidents, objective audit, and real-cluster bridge |
| 74 | Several lessons listed incomplete or missing commands, so checkpoints could not be solved from the hints | Added every required command to hints and a completability gate that executes all documented commands for every teaching lesson |
| 75 | Hands-on exams mixed tasks from other certifications | Added enough per-track tasks and restricted every pool to its own CKA, CKAD, or CKS tasks |
| 76 | `kubectl get secrets` crashed for Secrets without a type, and CronJob describe was not simulated | Fixed Secret rendering and generic workload describe output, with task-level regression tests |
| 77 | A single readiness snapshot rendered as a solid green block | Replaced the stretched bar with a first-session summary and fixed-width trend bars |
| 78 | Cluster status accessible name did not contain its visible text, and scrollable code blocks were not keyboard reachable | Matched the accessible name to the visible summary and made code wrap instead of scroll |
| 79 | Content was too thin for five-certification prep: 38 short lessons, 60 pooled questions, 16 tasks per track | Expanded to 54 teaching lessons at 150-250 words, 100 domain-weighted questions per knowledge track, and 30 tasks per hands-on track |
| 80 | Three lesson hints contained prose that looked like executable kubectl commands | Rewrote the hints and made the completability gate require every documented command to succeed |
| 81 | Applying an HPA without status could crash reconciliation or `get hpa`, and lab suggestions stayed tied to the static question set | Initialized and guarded HPA status and derived lab links from the rotated session questions |
| 82 | The lab sidebar exposed per-task completion and a completed count before submission | Hid checkpoint state during the run and switched the header to review-ready only after submission |
| 83 | Knowledge review links used stale or missing lesson titles, and the lab timer could stretch when the tab was backgrounded | Resolved titles from lesson metadata and made the lab timer use an absolute deadline |
| 84 | Running knowledge and lab states lacked accessibility and mobile coverage | Added axe and overflow checks for both live exam states |

Also fixed during the scaffold verification: Postgres 18 volume path, pnpm 11
build-script allowlist, gitignore excluding the embedded placeholder, Rollup
chunk-size warning, Biome/Stylelint configuration, and stale Taskfile/Playwright
references in the docs.

## Deferred (with trigger)

| Item | Why deferred | Trigger |
|---|---|---|
| `-o yaml` | Not used by current lessons; faking output would teach wrong behavior | First lesson that needs it |
| Configurable rollout math (`maxSurge`/`maxUnavailable`) and complete revision history UI | The simulator now rolls incrementally with bounded surge and retains ReplicaSet history; exposing strategy knobs can wait | Lesson that teaches surge math |
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
  honest certification positioning remain the real risks - not infrastructure.
- **Next milestone.** Public beta launch readiness: production TLS, rate limits,
  backups, monitoring, content QA, and feedback instrumentation. Accounts and
  progress sync remain Phase 2 until beta retention justifies the backend.

## Verification

- `mise run lint` - Biome + Stylelint clean.
- `mise run typecheck` - all four TS packages clean.
- `mise run test` - 359 Vitest tests pass, including every lesson's documented
  commands, every certification task, readiness math, progress, guards, and the
  simulator.
- `mise run e2e` - 44 Playwright tests pass. Every lesson is rendered and checked
  with axe, the full lesson set has no serious accessibility violations, and the
  main terminal, exam, lab, roadmap, mobile, and API flows are covered.
- `mise run api-test` - Go tests pass, including SPA fallback and method
  rejection; `gofmt` and `go vet` clean.
- `mise run build` - Vite build clean; no chunk-size warning.
- `pnpm audit --prod` - no known vulnerabilities.
- Lighthouse performance, accessibility, best-practices, and SEO assertions pass.
- Docker image builds; Compose stack serves `/api/healthz`, `/`, and
  `/lesson/pods-101` through Envoy; SPA embed + fallback verified; security
  headers confirmed at the edge.
