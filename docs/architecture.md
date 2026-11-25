# Kubelab — Architecture & Tech Stack Plan

> Status: decisions locked; Phase 0 scaffold in progress (2026-11-23). Product: a
> gamified Kubernetes learning platform (Duolingo-style roadmap, longer lessons,
> interactive console, under-the-hood animations) that takes a learner from zero
> to certification-ready.
>
> Repo: `LibreCollab/kubelab`

## 1. Core loop

> Theory card → interactive exercise in a simulated cluster → console command →
> observe what happened under the hood → checkpoint passed → XP/streak → next
> node on the roadmap.

The single most important architectural decision: **one simulation engine is the
source of truth for the console, the lesson checks, and the animations.** Do not
build three separate systems.

## 2. System architecture

```
┌──────────────────── apps/web (Vite + React SPA) ────────────────────┐
│ Roadmap · Lesson player · Theory · Terminal · Visualizer · XP        │
│        │                  │                     │                    │
│  @kubelab/ui        viz (web/src/viz)    @kubelab/sim                │
│                                          (engine + kubectl parser)   │
└────────┼──────────────────┼─────────────────────┼───────────────────┘
         │                  │                     │
   @kubelab/content         └───── commands ──────┘
   (Markdown + YAML specs)              │
                                        ▼
        ┌──────────── simulation engine (pure TS) ────────────┐
        │  API server emulation → object store (resourceVersion)│
        │  MVP: Pod/Deployment/RS/Service/Endpoints, Scheduler, │
        │  Kubelet, DNS — driven by a virtual clock             │
        │  event bus (watch stream) + deterministic snapshot    │
        │  cert tracks add PV/PVC, Jobs, RBAC, NetworkPolicy    │
        └───────────────┬──────────────────────┬───────────────┘
                        ▼                      ▼
              terminal output          animations + lesson assertions

   apps/api (Go 1.27)  ◀── HTTPS/JSON ──  auth + progress sync only
   lessons and the simulator never touch the server
```

### Why simulated instead of real clusters

- **Zero infra cost**, instant start, unlimited concurrent users.
- **Deterministic and replayable** — required for teaching and for scrubbable
  animations.
- **Fault injection is trivial** (image pull failure, OOMKill, cordon,
  crashloop) — ideal for CKA-style troubleshooting lessons.
- Real clusters can be added later as an opt-in "Sandbox" — start with
  BYO-cluster (kind/k3d), then vcluster only if demand is proven — without
  touching the lesson engine.

Tradeoff: the sim mirrors real Kubernetes *behaviourally*, not fully. Target the
subset of commands/objects the curriculum and exams actually use, and label
fidelity limits honestly ("reality note" callouts).

## 3. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Language | TypeScript (web + packages) and **Go 1.27** (API) | Strict TS for the app; Go for the thin backend + future sandbox |
| Monorepo | pnpm workspaces (add Turborepo when builds slow), mise for toolchains + tasks | Sim engine is a standalone, testable package without tooling overhead |
| Frontend | **Vite + React 19 + TanStack Router** | SPA, no SSR framework; engine is fully client-side |
| Edge proxy | **Envoy** | TLS, HTTP/2, compression, routing at MVP; rate limits/tracing added when needed |
| Static serving | SPA embedded in the Go binary (`go:embed`) | Envoy does not serve static files; one less container than nginx/static-web-server |
| Styling | **CSS Modules + Sass**, CSS custom-property design tokens, **Radix** primitives | Zero-runtime scoped styles, full design control, contributor-friendly; no Tailwind/shadcn |
| Animation | `motion` (Framer Motion) + CSS micro-interactions; PixiJS only if a view needs 100+ elements | Layout animations keyed by object UID suit pod lifecycle |
| Cluster diagrams | `@xyflow/react` (React Flow) | Nodes/pods/edges, custom animated nodes |
| Terminal | xterm.js + fit/web-links addons | Real terminal feel in the browser |
| YAML editor | CodeMirror 6 + `@codemirror/lang-yaml` | Much lighter than Monaco, sufficient for manifests |
| CLI parsing | Custom tokenizer/parser module inside `@kubelab/sim` | Need a kubectl grammar subset, not shell exec; no extra package yet |
| YAML | `yaml` package + Zod schemas | Manifest validation with realistic errors |
| Content | Markdown first (MDX when interactive theory needs it); YAML lesson specs for scenarios/checks | Bundled at build time; content is data → lintable, contributable |
| Client state | TanStack Query (server state, Phase 2) + Zustand (UI); sim state lives in the engine | Keep engine framework-agnostic |
| Local persistence | IndexedDB via Dexie | Anonymous-first, offline progress |
| Backend | **Go 1.27**, stdlib `net/http` (or chi) | Small auth/progress API; `client-go` path for the future sandbox |
| DB | Postgres + `pgx` + `sqlc`, `goose` migrations | Typed queries, self-hostable |
| API contract | OpenAPI 3.1 as the contract; Orval codegen deferred (hand-written typed client at MVP) | Type-safe enough without a codegen pipeline for ~7 endpoints |
| Auth | GitHub OAuth (`x/oauth2`) + hashed opaque session tokens; anonymous play first | No signup wall |
| Observability | **OpenTelemetry** (Go, Envoy, browser) → OTel Collector / Grafana Alloy → Prometheus, Loki, Tempo, Grafana | Vendor-neutral; metrics first, logs/traces on trigger (§14) |
| Product analytics | **Self-hosted Umami/Plausible** (+ Grafana over Postgres) | Fully self-hosted, lightweight; PostHog's ClickHouse stack needs a dedicated ≥16 GB host |
| Testing | Vitest (engine, content, lesson checks), Playwright E2E, Go `testing`; Storybook when triggered | Engine correctness is the main risk; avoid test-tooling upfront |
| Tooling/CI | Biome, GitHub Actions, Docker Compose for self-host | Apache-2.0 license, CONTRIBUTING.md |

### Styling & design system

- `@kubelab/ui` owns the design system: one `*.module.scss` per component plus
  `src/styles/tokens.css` and `src/styles/reset.css`.
- Tokens are CSS custom properties (`--color-*`, `--space-*`, `--radius-*`,
  `--font-*`); theming via `[data-theme="light|dark"]` plus per-unit accents.
- Unstyled **Radix** primitives (dialog, dropdown, tooltip, tabs, toast) provide
  accessibility; we style them ourselves. shadcn/ui and Tailwind are not used.
- No runtime CSS-in-JS. Typed class names via `typescript-plugin-css-modules`;
  Sass is used for nesting, mixins (focus rings, truncation, elevation), and
  media queries.
- Conventions: one module per component, `composes` for shared styles, global CSS
  limited to reset/tokens/base; `stylelint` with `stylelint-config-standard-scss`
  in CI.
- Once Storybook is introduced (trigger in §14), it renders components against
  the real tokens, so visual review is part of UI PRs.

## 4. Repo layout

```
mise.toml             # toolchains (Node, Go, pnpm) + tasks
e2e/                  # Playwright end-to-end tests
apps/
  web/                # Vite + React SPA (roadmap, lessons, viz components)
  api/                # Go service: cmd/api, internal/{auth,progress,store,httpapi}
deploy/
  envoy/              # edge config: TLS, routes (rate limits/tracing added later)
  compose/            # docker-compose: envoy + api + postgres
packages/
  sim/                # engine + kubectl parser: store, controllers, clock, events
  content/            # Markdown/YAML lessons + Zod schemas + linter
  ui/                 # design system (CSS Modules + tokens), gamification components
docs/                 # architecture, audit, content authoring guide, ADRs
```

Grow to separate `viz`, `kubectl`, and `config` packages only when each gains a
second consumer (see §14).

## 5. Simulation engine design

Runs entirely client-side; the Go API never executes kubectl and never holds
cluster state.

- **Object store**: Map keyed by `kind/namespace/name` with `resourceVersion`,
  `generation`, `uid`.
- **Virtual clock + tick loop** (~100 ms ticks, speed 0.5×–10×, pause/step).
  Everything — image pull delays, backoff, probe failures — is scheduled on
  virtual time, so lessons are fast but realistic.
- **Controllers** (simplified but faithful):
  - **MVP**: Deployment → ReplicaSet → Pods with incremental rolling updates
    (one-surge at a time, old replicas retained until new ones are Ready);
    Scheduler (filter: resources, nodeSelector, taints/tolerations → score:
    spread, least-allocated → bind); Kubelet (image pull, lifecycle, probes,
    restart backoff, OOM/eviction); Service/Endpoints (ClusterIP/NodePort) and
    DNS (`svc.ns.svc.cluster.local`). Configurable `maxSurge`/`maxUnavailable`
    math remains deferred.
  - **Certification tracks**: PV/PVC + StorageClass, Job/CronJob, Ingress; later
    RBAC authorizer, NetworkPolicy, HPA.
- **Event sourcing**: every command and controller action is an event → enables
  in-browser replay for lessons and debugging. No server-side run storage until
  telemetry is triggered.
- **Determinism**: seeded RNG for name suffixes and scheduling ties.
- **Fault injection API**: scenario scripts can inject failures on a schedule.

### kubectl subset

**MVP**: `get` (wide/yaml/json, `-A`, `-n`, `-l`), `describe`, `apply -f`,
`create`, `run`, `delete`, `logs`, `exec`, `scale`, `rollout status/undo`.

**Added by certification tracks**: `set image`, `patch`, `label/annotate`,
`explain`, `top`, `cordon/uncordon/drain`, `config`. Realistic error strings
matter for teaching.

**Scaffold now**: object store, virtual clock, scheduler/kubelet stub, `get`
(table, wide, YAML, label selectors, `--show-labels`), `top pods|nodes`,
`describe`, `run`, `create deployment|ingress|configmap|secret`, `expose`,
`scale`, `set image|env`, `rollout`, `exec` for DNS/HTTP/environment checks,
`logs`, `auth can-i`, `apply -f/-k` with comma-separated files and directory
manifests, NetworkPolicy peer/egress evaluation, configurable rolling-update
strategies, seeded storage/RBAC/event inspection, `delete`, and `help`. Helm,
Argo CD, and Kustomize inspection are also simulated.

### Lesson validation

MVP checks are **structured predicates** — no expression language (that was
over-engineering for v1):

1. **Pod checks** — namespace, name, image, labels, and phase, with a
   human-readable label rendered in the checkpoint list.
2. **Command checks** — require that the learner actually executed a command
   (e.g. `kubectl get pods`) before the lesson can complete.
3. **Quiz checks** — multiple-choice knowledge checks for theory and
   certification readiness.
4. **Output assertions** (Phase 2) — regex/DOM checks on terminal output.

Checks run after each command and tick; hints stay in the lesson spec.

Guided lessons (`strict: true`, the default) also run a **pre-execution guard**
for `kubectl run`: a mismatched pod name, namespace, label, or image is rejected
with the expected vs. actual value, and nothing is created. Non-run commands and
lessons with `strict: false` keep real kubectl behavior.

## 6. Animation system

One renderer over the event stream + snapshots.

**MVP ships only the cluster map + pod lifecycle.** The lifecycle scrubber,
request-flow view, and rolling-update view follow in Phase 2/3; they must not
delay the first vertical slice.

- **Cluster map** (MVP): React Flow graph; pods enter a "Pending" tray and fly to
  a node on scheduling, spinner → pulse on `Running`, ghost fade on terminate.
  Key `motion` layout animations by object `uid` so the same pod smoothly moves.
- **Lifecycle timeline** (Phase 2): scrubber showing derive → schedule → pull →
  start → probe, with reconcile-loop decision text ("desired 3, actual 1 →
  create pod").
- **Request flow** (Phase 2): Service → kube-proxy → Endpoint → Pod; Ingress/DNS
  paths; animated packets along SVG paths.
- **Rolling update view** (Phase 2/3): old/new ReplicaSet bars, surge/unavailable
  constraints visualized.

Because animations are a pure function of `(snapshot, events)`, they are
scrubbable, replayable, and testable.

## 7. Curriculum & roadmap

Skill tree (prereq graph) with unit gates:

1. Containers & why orchestration (docker basics, images, namespaces/cgroups)
2. Cluster anatomy (control plane, nodes, etcd, kubelet)
3. Pods → Deployments → ReplicaSets → rolling updates
4. Services & DNS
5. ConfigMaps/Secrets, env, volumes
6. Storage (PV/PVC/StorageClass)
7. Scheduling (affinity, taints, quotas, HPA)
8. Networking deep dive (CNI, Ingress, NetworkPolicy, service types)
9. Security (RBAC, ServiceAccounts, PSA)
10. Observability & troubleshooting (logs, events, probes, metrics)
11. Helm/Kustomize
12. GitOps & operators
13. **Certification tracks** — see [Certification targets](#certification-targets).

**Content now spans units 1–12 plus five certification readiness checks.**
Units 1–12 include interactive terminal lessons (workloads, services/DNS/Ingress,
configuration, storage, scheduling, networking, RBAC, observability, Helm,
Kustomize, GitOps, and operators) with a live cluster map and toolchain
simulators. Certification tracks include timed knowledge exams, hands-on lab
exams, weak-area review, exam history, and spaced repetition. Conceptual
container and control-plane theory still starts from quiz checkpoints.

### Certification targets

Core tracks (full product), matching the official CNCF/Linux Foundation path.
**Launch order: KCNA first, then CKA; KCSA/CKAD/CKS follow.**

| Cert | Format | Length / pass mark | Fee | Role in Kubelab |
|---|---|---|---|---|
| **KCNA** | Multiple choice (60 Q) | 90 min / 75% | $250 | Foundations; first credential, theory-heavy |
| **KCSA** | Multiple choice (60 Q) | 90 min / 75% | $250 | Security foundations; before CKS |
| **CKA** | Hands-on, 15–20 tasks | 2 h / 66% | $445 | Administrator endgame; centerpiece |
| **CKAD** | Hands-on, 15–20 tasks | 2 h / 66% | $445 | Developer branch after services/networking |
| **CKS** | Hands-on, 15–20 tasks | 2 h / 67% | $445 | Security specialist; requires CKA |

Verified against CNCF/LF pages, October–November 2026:

- Official pathways: **KCNA → CKA → CKS** and **KCNA → CKAD**.
- Professional exams are proctored, performance-based, open to the official docs
  only, and re-versioned with Kubernetes (pages currently cite v1.35–v1.37;
  exams track the latest minor within ~4–8 weeks).
- All five credentials are valid **2 years** (CKA/CKAD earned before Apr 1, 2024
  keep 3). The **CARE program** auto-extends KCNA when CKA/CKAD is earned
  (since Jan 2026), and KCSA/CKA when CKS is earned (since Jun 18, 2026).
- Holding all five active at once makes a **Kubestronaut** — a natural in-app
  endgame badge and a good renewal story (refresh content before expiry).

Curriculum mapping:

- **KCNA**: Kubernetes fundamentals 44%, container orchestration 28%, cloud
  native application delivery 16%, cloud native architecture 12%.
- **CKA**: cluster architecture/install/config 25%, workloads & scheduling 15%,
  services & networking 20%, storage 10%, **troubleshooting 30%**.
- **CKAD**: application design/build 20%, deployment 20%, observability &
  maintenance 15%, environment/config/security 25%, services & networking 20%.
- **CKS**: cluster setup, hardening, system hardening, microservice
  vulnerabilities, supply chain security, monitoring/logging/runtime security.
- Pin each track to the current CNCF curriculum PDF in
  `packages/content/curriculum/` with the exam's Kubernetes version, and add a
  CI check that flags a stale curriculum.

Mock exams: 15–20 timed tasks, 2 hours, scored against state assertions (same
engine as lessons). Sim-based mocks ship first and are labelled **"simulated"**;
exam-realistic practice needs real clusters — offer BYO-cluster first, and add a
vcluster sandbox only if demand is proven.

Complementary tracks (post-launch, optional): **PCA** (Prometheus), **CCA**
(Cilium), **ICA** (Istio), **CAPA** (Argo), **CGOA** (GitOps), **OTCA**
(OpenTelemetry), **KCA** (Kyverno) — each maps onto an existing unit
(observability, networking, GitOps, security).

### Lesson format (YAML spec + Markdown theory)

```yaml
id: pods-101
unit: fundamentals
xp: 20
strict: true
prereqs: [containers-102]
theory: ./pods-101.md
scenario:
  nodes: [{ name: node-1, cpu: 4, memory: 8Gi }]
  objects: []
objectives:
  - Create a pod running nginx
  - Verify it with kubectl get pods
checks:
  - type: pod
    name: web
    label: "Pod web exists"
  - type: pod
    name: web
    labels:
      app: web
    label: "Label app=web"
  - type: pod
    name: web
    image: nginx
    label: "Image is nginx"
  - type: pod
    name: web
    phase: Running
    label: "Phase is Running"
  - type: command
    verb: get
    resource: pods
    label: "Run kubectl get pods"
  - type: quiz
    id: q1
    label: "Deployment role"
    question: "What does a Deployment manage?"
    options: ["ReplicaSets and Pods", "Nodes", "Services"]
    answer: 0
hints:
  - "Try kubectl run …"
  - "Add --labels=app=web"
solution: kubectl run web --image=nginx --labels=app=web
```

Content is validated against the schema in CI. The "solution passes its own
checks" gate lands when the lesson-check evaluator is shared between the web app
and CI (Phase 1), so a lesson cannot merge with a solution that fails its own
checks.

## 8. Backend (Go) & data model

The API is deliberately small: auth and progress sync only (telemetry is
post-MVP). Lessons are bundled into the web build; there is no CMS and no
server-side command execution. Phases 0–1 ship with **no backend at all**
(IndexedDB only); the Go service arrives in Phase 2 with accounts.

**MVP endpoints**

| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/github` → `/auth/github/callback` | OAuth login |
| POST | `/auth/logout` | Clear session |
| GET | `/api/me` | Profile + streak summary |
| GET | `/api/me/progress` | All lesson states |
| PUT | `/api/me/progress` | Batch upsert (lesson, status, xp deltas) |
| GET | `/api/healthz` | Liveness |

Post-MVP: `POST /api/me/runs` for telemetry.

**MVP tables**: `users`, `sessions`, `progress(user_id, lesson_id, status,
attempts, last_seen)`, `xp_events`, `streaks`. Skill unlocks are derived from
progress. **Post-MVP**: `lesson_runs`, `skill_unlocks`, replay blobs.

Anonymous users: Dexie local store, merged on account creation (event-log merge,
last-write-wins per lesson).

**Go service shape**: stdlib `net/http` router, `pgx` + `sqlc` for typed queries,
`goose` migrations, `slog` logging, distroless binary. The built SPA is embedded
with `go:embed` and served by the same binary (SPA fallback for client routes).
Estimated ~1–2k LOC for MVP. When the real-cluster sandbox lands, this service
grows into the vcluster/kubectl proxy (`client-go`), which is why Go is a good
long-term choice.

**Deployment shape**: Envoy as the only edge process. MVP config is deliberately
small: TLS termination, HTTP/2, compression, security headers, routing. Rate
limits, retries/circuit breaking, access-log pipelines, and OTel traces are added
per the triggers in §14. Routes:

- `/api/*`, `/auth/*` → Go API (5 s timeout)
- everything else → Go SPA handler (`/`), long-cached immutable assets

`docker compose` runs `envoy` + `api` + `postgres` on one VPS. TLS certificates
via lego/certbot + Envoy SDS (Envoy Gateway on Kubernetes only if we ever move
there).

The current public preview is the static SPA on GitHub Pages at
`kubelab.librecollab.org` (see `docs/deployment.md`). The Hetzner/Envoy stack
remains the plan for the API, auth, and Postgres.

## 9. Gamification

Duolingo-inspired, not cloned. **Implemented locally:** XP per completed
lesson, daily streak, saved quiz answers, linear lesson/unit unlocking,
completion state, continue/next navigation, and reset — persisted in IndexedDB
via Dexie. **Later:** streak freezes, timed debug challenges, leagues, and
account sync; no hearts.

Mobile: theory + quizzes + tap-the-correct-manifest exercises are
mobile-friendly; the real terminal is desktop-first (offer a simplified command
picker on small screens).

## 10. Build phases

- **Phase 0 — spike (1–2 wks)**: sim core + terminal + one lesson + pod-lifecycle
  animation. Proves the whole bet.
- **Phase 1 — MVP (4–6 wks)**: roadmap UI, XP/streaks, local progress
  (IndexedDB, no backend), static build behind Envoy on a single 8 GB VPS. The
  content scaffold covers all core units and cert readiness checks; interactive
  depth now spans workloads, networking, storage, security, toolchains, and
  observability.
- **Phase 2**: Go API + Postgres on a single VPS (accounts, sync); request-flow +
  rolling-update visualizations; fault-injection debugging lessons;
  expanded spaced repetition.
- **Phase 2.5 (triggered)**: split observability onto its own host when the
  trigger fires.
- **Phase 3**: expand the current task-based KCNA/KCSA/CKA lab exams into full
  CKAD/CKS banks and longer randomized sessions; fault-injection labs; i18n
  scaffolding.
- **Phase 4 (optional)**: BYO-cluster practice first (kind/k3d); vcluster sandbox
  only after demand is proven; leaderboards only if retention data asks.

## 11. Scaling (growth path)

This is the growth path, not launch scope. Launch runs one box per §12 (CPX32
for static-only Phase 1, CPX42 once the API exists); every item here is gated by
a trigger in §14. At 10k registered users the sim runs in the browser, so the
backend stays thin: auth and progress only, and static assets dominate traffic.

**Assumptions**: 10k registered users, ~10–15% DAU (1–1.5k), peak concurrency
~300–600, API ~50–150 rps, a few batched writes per active learner per minute.
The 10k-*concurrent* interpretation is at the end.

### Edge

- Static assets are immutable and content-hashed: serve from Envoy/Go with
  `cache-control: public, max-age=31536000, immutable`; `index.html` no-cache.
  Add a CDN only on the bandwidth/latency trigger (§14).
- One Envoy instance at launch; a second only when HA is required.
- No service worker at launch; add one only if offline repeat visits are
  measured as a retention problem.

### App tier

- One Go process handles launch traffic. Horizontal replicas (and HPA on k8s)
  only when CPU/RPS triggers fire.
- Sessions: hashed-token lookup with an in-process LRU + indexed Postgres row.
  Redis only when rate limiting or lookup-latency triggers fire.
- Batch progress client-side (debounce + IndexedDB queue, flush on idle /
  `visibilitychange`); one upsert per batch. Offline writes sync later.
- Telemetry is post-MVP; if added, buffer it client-side and consume it
  asynchronously so it never blocks gameplay.

### Data tier

- One Postgres primary is enough for launch. PgBouncer, a read replica, and
  partitioning are all trigger-gated.
- Indexes from day one: unique `progress(user_id, lesson_id)`,
  `xp_events(user_id, created_at)`, `sessions(token_hash)`.
- Backups via pgBackRest/WAL archiving with tested restores.

### HA, observability, load tests

- HA (two Envoy instances, 2+ API replicas, Postgres failover) is a growth-tier
  concern, not a launch requirement.
- Metrics first; Loki/Tempo and SLO alerting land on trigger. Target SLOs once
  live: API p95 < 150 ms, error rate < 0.5%, progress write success > 99.9%.
- k6 load test at 3× peak as a release gate; add chaos tests alongside HA.
- Degradation: if the API is unreachable, the app stays usable offline and
  syncs when it returns.

### If "10k" means concurrent

Still feasible: ~1.5–2k API rps needs ~8–12 Go replicas, PgBouncer, a tuned
Postgres, and Redis for sessions/rate limits. The architecture does not change;
only those components become mandatory.

### Core stack footprint

| Process | RAM |
|---|---|
| OS + Docker | 0.5–1 GB |
| Envoy | 100–250 MB |
| Go API | 100–300 MB |
| Postgres (shared_buffers ~1 GB) | 1–2 GB |
| Page cache / headroom | rest |

An 8 GB host covers Phase 1 (static) and a core-only API setup, but the
recommended launch for API + the Phase 2 metrics stack is **16 GB** (§12).
Operational requirements: 2 GB swap, pgBackRest backups with restore drills,
disk retention policy, no CI/load tests on the host, and accepting a single
point of failure until HA is triggered.

### Rollout path

1. **Phase 1**: one 8 GB VM, static SPA behind Envoy, no CDN.
2. **Phase 2**: one 16 GB VM running Compose (`envoy` + `api` with embedded SPA
   + `postgres`). Split the observability host only when its trigger fires.
3. **Phase 3+**: replicas, partitioning, Redis, and Kubernetes only when the
   triggers in §14 fire — never upfront.

## 12. Hosting, VPS sizing & cost (Hetzner)

**Chosen: Hetzner Cloud in the EU** (Falkenstein/Nuremberg/Helsinki). Everything
except DNS and Hetzner runs on our own hosts: Envoy, Go API, Postgres, the
Grafana observability stack, and product analytics. No Cloudflare, no Grafana
Cloud, no PostHog Cloud, no AWS.

Why Hetzner over the alternatives:

- Best price/performance for this workload; **20 TB traffic included** (AWS
  charges $0.09/GB after 100 GB).
- EU regions by default (GDPR) and predictable network quality.
- Shared-vCPU CPX for launch, **dedicated-vCPU CCX** when Postgres p95 needs it.
- Storage Box for offsite backups at a few euros per month.

What we accept: we run ACME/TLS ourselves, own backups/restores and DDoS
exposure, and do all upgrades. In exchange, no SaaS bills and no learner data
leaves our infrastructure.

**At a glance:** Phase 1 = **CPX32** (4 vCPU / 8 GB / 160 GB, static only);
Phase 2 = **CPX42** (8 vCPU / 16 GB / 320 GB, core stack). The 2-host layout is
the growth step, not the launch config.

### Resource sizing (lean v1)

| Component | RAM | CPU | Disk |
|---|---|---|---|
| OS + Docker + images | 0.5–1 GB | ~0 | 10–15 GB |
| Envoy | 100–250 MB | < 0.25 vCPU | — |
| Go API (embedded SPA) | 100–300 MB | < 0.25 vCPU | — |
| Postgres | 1–2 GB (1 GB shared_buffers) | 1–2 vCPU under load | 5–10 GB/yr + 1–2 GB WAL |
| Umami | 100–250 MB | < 0.25 vCPU | ~1 GB |
| Prometheus + Grafana | 0.5–1 GB | < 0.5 vCPU | 2–5 GB (90 d) |
| Loki + Tempo (trigger) | +0.5–1 GB | +0.5 vCPU | +10–20 GB |

**Totals**

- **Phase 1 (static):** 2 GB minimum, 4 GB comfortable; 1–2 vCPU; 20–40 GB disk.
- **Phase 2 (API + metrics):** 8 GB comfortable; 2–4 vCPU; **80 GB minimum,
  160 GB comfortable**.
- **Full observability (triggered):** 16 GB; 4–8 vCPU; 160–320 GB.
- **Growth:** DB stays under ~10 GB/year at 10k users; logs ~2–10 GB per 30 days;
  Docker/build images ~10 GB; local backup staging ~10–20 GB.

**CPU guidance:** this is I/O-bound, not CPU-bound. **2 vCPU is enough to
start; 4 is comfortable.** Avoid 1 vCPU for Postgres + Envoy + Go. Prefer
fixed-performance cores (dedicated CCX, m7g/c7g) over burstable t4g once the DB
is busy; t4g is fine for Phase 1 and early Phase 2 with credit monitoring.
ARM64 (Graviton; Hetzner CAX if preferred) is fine — build multi-arch images.

**Example CPUs**

| Host | CPU | vCPU / RAM | Notes |
|---|---|---|---|
| Hetzner CPX32 | Shared AMD EPYC | 4 / 8 GB | Phase 1–2 core, 160 GB |
| Hetzner CPX42 | Shared AMD EPYC | 8 / 16 GB | Single-box launch, 320 GB |
| Hetzner CCX23 | Dedicated EPYC Milan/Genoa | 4 / 16 GB | Predictable Postgres p95 |
| AWS t4g.large | Graviton2, burstable | 2 / 8 GB | Cheapest EC2 fit, credits can throttle |
| AWS m7g.large | Graviton3, fixed | 2 / 8 GB | Better for sustained Postgres |
| AWS m7g.xlarge | Graviton3, fixed | 4 / 16 GB | Single-box EC2 equivalent |
| AWS c7g.large | Graviton3, compute | 2 / 4 GB | Phase 1 static only |
| AWS m7i.large | Xeon Sapphire Rapids | 2 / 8 GB | x86 option |
| AWS c7a.large | EPYC Genoa | 2 / 4 GB | x86 Phase 1 option |

Chosen path: **Hetzner CPX32 → CPX42 → 2× CPX32**, with CCX23 as the dedicated
upgrade. AWS rows are reference only.

### Alternative considered: AWS (not chosen)

Kept for reference only. AWS is not used in v1: Lightsail is ~20–25% more than
Hetzner for the same box, EC2 is ~2.5× once EBS/IPv4/snapshots/egress are
counted, and egress has no 20 TB allowance.

On-demand list prices, excluding tax. The egress column assumes **≈500 GB/mo
outbound (~400 GB billable** after the 100 GB free allowance; static assets
without a CDN); storage is EBS gp3 for EC2, included SSD for Lightsail.

| Setup | Compute | Storage | IPv4 | Snapshots | Egress | Approx. total |
|---|---|---|---|---|---|---|
| **Lightsail 8 GB** | $44 (2 vCPU) | 160 GB included | included | ~$8 | 5 TB included | **~$52** |
| **Lightsail 16 GB** | $84 (4 vCPU) | 320 GB included | included | ~$16 | 6 TB included | **~$100** |
| EC2 t4g.large (2/8) | $49 | $12.80 | $3.65 | ~$8 | ~$36 | **~$110** |
| EC2 m7g.large (2/8) | $59.60 | $12.80 | $3.65 | ~$8 | ~$36 | **~$120** |
| EC2 t4g.xlarge (4/16) | $98.10 | $25.60 | $3.65 | ~$16 | ~$36 | **~$179** |
| EC2 m7g.xlarge (4/16) | $119.10 | $25.60 | $3.65 | ~$16 | ~$36 | **~$200** |

Hetzner equivalents: **CPX42 ≈ €70 (~$76) + Storage Box ~$5 ≈ $81**, with
**20 TB** included traffic; growth 2× CPX32 ≈ €72 (~$78) + storage. So:

- **Lightsail 16 GB ≈ $100/mo vs Hetzner ≈ $81/mo** — closest like-for-like,
  ~20–25% more, much simpler AWS integration.
- **EC2 m7g.xlarge ≈ $200/mo** — roughly 2.5× Hetzner once EBS, IPv4,
  snapshots, and egress are counted.
- **Egress is the AWS wildcard:** $0.09/GB after 100 GB, so an extra 1 TB adds
  ~$90. Hetzner includes 20 TB. Savings Plans cut compute ~30–40%, not storage
  or egress.
- AWS Free Tier / new-account credits help for a month or two, not at 10k users.

**Decision:** **Hetzner is the chosen provider.** If the project is ever forced
into AWS (credits, IAM, organizational mandate), use **Lightsail 16 GB** rather
than raw EC2, and budget egress explicitly.

### Growth layout (2 VPS + backups)

**Launch on the single-box option below.** Move here only when the
observability host trigger fires (RSS > 2 GB or > 1k DAU) or Postgres and
observability start competing for page cache.

| Host | Spec | Runs |
|---|---|---|
| **app** | 4 vCPU, 8 GB RAM, 160 GB NVMe | Envoy, Go API (embedded SPA), Postgres, PgBouncer |
| **obs** | 4 vCPU, 8 GB RAM, 160 GB NVMe | Grafana, Prometheus, Loki, Tempo, Alloy, Umami/Plausible |
| **backup** | Storage Box (1 TB) or 1–2 vCPU / 2 GB VPS with MinIO | pgBackRest + WAL archive, replay blobs, offsite copies |

- EU region (Germany/Finland) for GDPR and price. Hetzner **CPX32**
  (4 vCPU / 8 GB / 160 GB, 20 TB traffic) is ~€36/mo each excluding VAT and
  IPv4 as of Nov 2026; plus a Storage Box (~€4–10/mo). Budget **~€80–100/mo**.
- Dedicated-vCPU alternative for the DB/API host: **CCX23** (4 dedicated vCPU /
  16 GB / 160 GB) ~€86/mo — only if shared-vCPU noise hurts p95 latency.
- Prices rose sharply during 2026, especially in US regions (roughly 2–3× the EU
  price). Re-check Hetzner's current page before ordering. Alternatives:
  Netcup, OVHcloud, Scaleway; avoid heavily oversold budget hosts for Postgres.

### Launch: single-box (recommended)

**8 vCPU / 16 GB RAM / 320 GB NVMe** (Hetzner **CPX42**, ~€70/mo) running the
whole Compose stack. Recommended launch configuration; fine to roughly 1k DAU.
It is a single point of failure, and observability competes with Postgres for
page cache — split into the two-host layout before real growth.

### Do not launch the full stack on 8 GB

8 GB is fine for Phase 1 (static SPA only) or for the core app with no
observability stack. Envoy + Go + Postgres + Grafana + Prometheus + Loki + Tempo
+ analytics on 8 GB is OOM-prone at 10k users. Use **16 GB minimum** for a single
host, or the 2-host layout above.

### What "fully self-hosted" changes

- **CDN**: none. Envoy/Go serve content-hashed assets with immutable caching;
  10k users fit comfortably in 20 TB of included traffic. Optional later: a
  small Varnish edge VPS.
- **TLS**: lego/certbot + Envoy SDS, renewed by a systemd timer; HSTS; TLS 1.2+.
- **Analytics**: self-host **Umami** (lightweight, Postgres) or Plausible CE.
  PostHog self-host only on a dedicated ≥16 GB host (ClickHouse + Kafka) if we
  later need its depth — never co-located.
- **Observability**: metrics first (Prometheus + Grafana); Loki and Tempo land on
  trigger, with short retention (metrics 90 d, logs 30 d, traces 14 d). On the
  growth layout they live on the obs VPS; at launch everything shares the single
  box.
- **Backups**: pgBackRest → backup host/MinIO; 7 daily, 4 weekly, 1 monthly;
  restore drill monthly. Backups are the one thing that must leave the app host.
- **DDoS**: provider mitigation + Fail2ban at launch; Envoy rate limits on
  trigger. If targeted, put a filtering proxy VPS in front — still self-hosted.
- **Uptime**: **Uptime Kuma** on a tiny separate VPS (or the obs host at growth)
  probing the public endpoint; we are our own status page.
- **Updates**: unattended-upgrades, pinned image tags, Renovate for dependency
  PRs, quarterly Postgres minor upgrades.
- **Secrets**: SOPS/age or Docker secrets; never `.env` in git.

## 13. Observability & analytics

Two different jobs, two different tools — don't try to make one do both.

- **Operational observability** (is the service healthy?) → OpenTelemetry +
  Grafana stack.
- **Product/learning analytics** (are learners succeeding?) → self-hosted
  Umami/Plausible plus SQL over Postgres. (PostHog only on its own dedicated
  ≥16 GB host if we need it later.)

### Pipeline

Target pipeline. At launch only Uptime Kuma + stdout logs run; metrics arrive in
Phase 2 and the collector/logs/traces are enabled by triggers in §14.

```
browser (Faro / OTel JS, traceparent) ─┐
Envoy (access logs, OTel spans) ───────┼─▶ OTel Collector / Grafana Alloy ─┬─▶ Prometheus (metrics)
Go API (otel-go, slog, /metrics) ──────┘   batch · sample · scrub PII       ├─▶ Loki (logs)
node_exporter · postgres_exporter · cAdvisor ──▶ Prometheus                ├─▶ Tempo (traces)
                                                                           └─▶ Grafana (dashboards, alerts)
```

### Instrumentation

- **Go API**: `otel-go` SDK, OTLP/gRPC export, `prometheus/client_golang`
  `/metrics`; `slog` JSON to stdout with `trace_id`/`span_id` injected (log ↔
  trace correlation).
- **Envoy**: OTel tracer, access logs to stdout, `admin /stats/prometheus`;
  propagates W3C `traceparent` from the browser so a slow lesson check produces
  one end-to-end trace (browser → Envoy → Go → Postgres).
- **Browser**: Grafana Faro Web SDK (lighter than full OTel JS) for errors, Core
  Web Vitals, route/lesson timings, and trace propagation. Keep it behind a
  dynamic import so it doesn't touch initial bundle size.
- **Host/data**: `node_exporter`, `postgres_exporter`, cAdvisor (Compose),
  Envoy stats; scraped by Prometheus.

### Sampling & retention

- Once traces are enabled: head-based sampling (e.g. 10%), **tail sampling in the
  Collector** keeps 100% of errors and slow requests (> 500 ms) and 10% of the
  rest.
- Retention: metrics 90 days (downsampled), logs 30 days, traces 7–14 days.
  Raw `lesson_runs` only if telemetry is ever added (90 days, aggregates kept).
- Scrub PII in the Collector (drop `email`, query strings on auth routes) before
  anything is persisted.

### Dashboards & alerts

- Golden signals: request rate, error rate, p50/p95/p99 latency, saturation;
  Envoy upstream 5xx, Go panic count, Postgres connections/locks, disk and
  memory.
- Business: signups, lesson completion rate, hint usage, streak retention, API
  sync failures — from `progress`/`xp_events` via Grafana's Postgres datasource.
- SLOs: API p95 < 150 ms, error rate < 0.5%, progress write success > 99.9%.
  Alerts via Grafana Alerting → email/Discord/Slack; keep alerts few and
  actionable.

### Footprint & hosting

Self-hosting the full Grafana stack (Grafana + Prometheus + Loki + Tempo +
Alloy) adds roughly **1–1.5 GB RAM** and tens of GB of disk. On the growth
layout (§12) it lives on the **obs** host; on a single host use **16 GB
minimum**. Copy the retention policy above so disk does not creep.

PostHog's self-hosted stack (ClickHouse + Kafka + Redis) needs its own
**≥16 GB** machine; use **Umami** for launch and keep PostHog self-hosting as a
later, separate host if its depth is needed.

Grafana/OTLP endpoints must **not** be publicly exposed: keep OTLP on the
private network, put Grafana behind Envoy with OIDC/basic auth and an IP
allowlist.

### Rollout

- **Phase 1**: Uptime Kuma + stdout logs; no metrics stack yet.
- **Phase 2**: Prometheus + Grafana + node/postgres exporters; Umami for product
  analytics.
- **Phase 3**: OTel tracing (Envoy + Go + browser), Loki, Tempo, and SLO
  dashboards — on trigger.

## 14. MVP scope & complexity budget

Full audit: [`docs/architecture-audit.md`](./architecture-audit.md).

**Ship (Lean v1)**: one VPS (8 GB static-only Phase 1; 16 GB with the API in
Phase 2), Compose (`envoy` + `api` + `postgres`), 3 packages (`sim` incl.
kubectl parser, `content`, `ui`), GitHub OAuth + `/me` + `/progress` +
`/healthz`, 34 lessons across 12 core units + 5 certification readiness checks,
pod-lifecycle visualization, Vitest + Playwright E2E.

**Explicitly deferred**: Redis, PgBouncer, read replica, partitioning, CDN,
Loki, Tempo, Alloy, Orval, Storybook, service worker, leaderboards, Kubernetes,
vcluster sandbox, `lesson_runs` telemetry, MDX (Markdown first).

**Rule: no new infrastructure without a measured trigger.**

| Component | Add when |
|---|---|
| PgBouncer | DB connections > 70% of max, or pool-contention p95 > 50 ms |
| Second host | observability RSS > 2 GB, or > 1k DAU, or noisy-neighbor latency |
| Partitioning | `xp_events` > 10M rows or ~50 GB |
| Redis | global rate limiting, session-cache latency, or leaderboards |
| Loki / Tempo | first incident needing cross-service log/trace search |
| CDN | > 10 TB/mo or measurable global latency complaints |
| Kubernetes | > 3 app hosts or genuine multi-service topology |
| Real-cluster sandbox | cert-track demand validated; BYO-cluster mode shipped first |
| Orval | > 15 endpoints or a second API client |
| Storybook | > 15 UI components or repeated visual regressions |

Default answer to "should we add X now?" is **no** until its trigger is met.

## 15. Locked decisions

1. **Sim-first**, real clusters later as an optional sandbox.
2. **Anonymous-first** with optional accounts (no signup wall).
3. **Frontend: Vite + React 19 + strict TypeScript** — no Next.js/SSR
   framework. Marketing/docs can be prerendered separately if needed.
4. **Backend: Go 1.27 + Postgres (`pgx`/`sqlc`)**, introduced in Phase 2;
   self-hostable via Docker Compose.
5. **Edge: Envoy** (no nginx) — TLS and routing at MVP; rate limiting and
   tracing added on trigger. The SPA is embedded in the Go binary.
6. **Styling: CSS Modules + Sass** with CSS custom-property tokens and Radix
   primitives — no Tailwind, no shadcn, no runtime CSS-in-JS.
7. **Observability: OpenTelemetry-ready**, metrics first (Prometheus +
   Grafana); logs/traces on trigger; **Umami** for product analytics.
8. **Hosting: Hetzner Cloud (EU), fully self-hosted** (no SaaS, no AWS):
   Phase 1 on **CPX32** (4 vCPU / 8 GB, static only); Phase 2 on one **CPX42**
   (8 vCPU / 16 GB); grow to **2× CPX32** (app + obs) plus Storage Box backups
   when triggered.
9. **Certifications: KCNA, KCSA, CKA, CKAD, CKS** as core tracks, aligned to the
   current CNCF curricula. Launch order: **KCNA → CKA**; CKAD/CKS next.
10. **Lean v1 & complexity budget**: ship the §14 scope; add infrastructure only
    when its documented trigger fires.
11. **License: Apache-2.0.**
