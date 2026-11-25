# Kubelab - Architecture Audit

> Date: 2026-11-23 · Status: **applied** - `architecture.md` §14 now encodes the
> Lean v1 + complexity triggers, and §15 records the locked decisions.
>
> Scope: `docs/architecture.md` reviewed for MVP fit, over-engineering, and risks
> at 10k registered users with a fully self-hosted deployment. Goal is not to
> shrink ambition, but to stop future-scale components from leaking into launch
> scope.

## Verdict

- The **core architecture is right**: one client-side simulation engine feeding
  terminal, checks, and animations; thin Go backend; static SPA; Postgres for
  auth/progress.
- **Scale is not the risk.** 10k registered users ≈ 1.5k DAU, 300-600 peak
  concurrent, 50-150 API rps, and most bytes are static. A single 16 GB VPS
  handles this.
- The **real risks are content throughput, simulator fidelity, and honest
  certification positioning** - none of them are infrastructure.
- Score: architecture **8/10**, MVP scoping **5/10**. Fix by adopting the Lean v1
  below plus explicit "add when" triggers.

## Keep (load-bearing, do not cut)

- Sim engine as the single source of truth.
- Pure-TS packages; Go API; Postgres; anonymous-first with IndexedDB.
- SPA embedded in the Go binary; Docker Compose; Envoy edge (your requirement).
- CSS Modules + tokens + Radix.
- YAML lesson specs + Zod + "solution passes its own checks" CI gate.
- Pod-lifecycle animation (the differentiator).
- Backups and restore drills.

## Over-engineering findings

| # | Finding | Severity | Verdict |
|---|---|---|---|
| 1 | Full Grafana stack (Prometheus + Loki + Tempo + Alloy) at launch | Medium | Start with metrics + uptime + file logs; add Loki/Tempo on first need |
| 2 | Two-VPS layout presented as the launch recommendation | Medium | Launch single-box; split only on a trigger |
| 3 | OpenAPI + Orval codegen for ~7 endpoints | Low-Med | Defer; hand-written typed client or `openapi-typescript` is enough |
| 4 | PgBouncer, read replica, partitioning, Redis "for 10k" | Medium | None needed at this scale; document triggers instead |
| 5 | Kubernetes/Envoy Gateway in Phase 2 | Medium | Stay on Compose VMs; K8s only for real multi-node need |
| 6 | vcluster real-cluster sandbox | High | Post-PMF; try "bring your own cluster" (kind/k3d) first |
| 7 | `lesson_runs` command-log telemetry + replay storage | Medium | Post-MVP; Umami events + Postgres aggregates suffice |
| 8 | 6 packages + Turborepo + Storybook from day one | Low-Med | 3 packages (`sim`, `content`, `ui`); add tools when they hurt |
| 9 | kubectl v1 breadth (patch/label/explain/top/config/cordon/drain) | Med-High | MVP subset only; add per certification track |
| 10 | Sim controller breadth in v1 (PV/PVC, Jobs, HPA, RBAC, NetworkPolicy) | High | Pod/Deployment/RS/Service/Endpoints/Scheduler/Kubelet/DNS first |
| 11 | Animation breadth (scrubber, request flow, rolling updates) | Medium | Pod lifecycle first; request flow next; scrubber later |
| 12 | Five cert tracks built simultaneously | High (scope) | KCNA + CKA first; CKAD/CKS later |
| 13 | Leaders/hearts/leagues/timed challenges | Low | XP + streak only |
| 14 | Service worker / offline play | Low | IndexedDB progress only; no SW yet |
| 15 | MDX from day one | Low | Plain Markdown first; MDX when interactive theory appears |
| 16 | Tail sampling, dashboards, SLO alerts before traffic | Low | Add after first real incident |

## Lean v1 (ship this)

**Host**: one VPS. Phase 1 (static only) CPX32 4 vCPU/8 GB; Phase 2 (API)
CPX42 8 vCPU/16 GB/320 GB. No second host at launch.

**Compose**: `envoy` + `api` (embedded SPA) + `postgres`; optional Umami;
optional Prometheus + Grafana; Uptime Kuma optional. Nothing else.

**Not in v1**: Redis, PgBouncer, read replica, partitioning, CDN, Loki, Tempo,
Alloy, Orval, Storybook, service worker, leaderboards, Kubernetes, vcluster.

**Packages**: `apps/web`, `apps/api`, `packages/sim` (includes the kubectl
parser), `packages/content`, `packages/ui`. Add `viz`, `kubectl`, `config` when
they have a second consumer.

**API**: GitHub OAuth, `/api/me`, `/api/me/progress`, `/api/healthz`. Drop
`/api/me/runs` until telemetry is justified.

**Tables**: `users`, `sessions`, `progress`, `xp_events`, `streaks`. Derive skill
unlocks from progress; add `lesson_runs` later.

**Simulator v1**: Pod, Deployment, ReplicaSet, Service, Endpoints, Scheduler,
Kubelet, DNS. Commands: `get`, `describe`, `apply -f`, `create`, `run`,
`delete`, `logs`, `exec`, `scale`, `rollout`.

**Content**: 4 units / 12-15 lessons. Cert tracks after the loop is validated.

**Tests**: Vitest for the engine; 2-3 Playwright smoke tests. No Storybook.

## Complexity triggers - add only when the trigger fires

| Component | Add when |
|---|---|
| PgBouncer | DB connections > 70% of max, or pool-contention p95 > 50 ms |
| Read replica | analytics/leaderboard p95 > 200 ms, or DB CPU > 70% sustained |
| Partitioning | `xp_events`/`lesson_runs` > 10M rows or ~50 GB |
| Redis | global rate limiting, session-cache latency, or leaderboards needed |
| Second host | observability RSS > 2 GB, or > 1k DAU, or noisy-neighbor latency |
| Loki | need cross-service log search during an incident |
| Tempo / tail sampling | first cross-service latency investigation |
| CDN | > 10 TB/mo or measurable global latency complaints |
| Kubernetes | > 3 app hosts or a genuine multi-service topology |
| vcluster sandbox | cert-track demand validated; BYO-cluster mode shipped first |
| Orval | > 15 endpoints or a second API client |
| Turborepo | cold CI build > 5 min or > 4 packages |
| Storybook | > 15 UI components or repeated visual regressions |
| PostHog | Umami + SQL can't answer funnel/cohort questions |
| Leaderboards | DAU > 1k and retention data shows demand |
| Service worker | offline repeat visits measured as a retention problem |

## Under-specified - bigger risk than infrastructure

1. **Simulator conformance**: golden-file tests capturing real `kubectl` output;
   a command/object coverage matrix; pinned Kubernetes version per content
   release; honest "reality note" callouts.
2. **Content pipeline**: lesson template, review checklist, and an effort
   estimate (12-15 lessons ≈ 60-120 authoring hours). Content is the moat.
3. **Certification honesty**: simulated mocks must be labelled; CKA/CKAD/CKS
   need real-cluster practice; never imply guaranteed exam success.
4. **Learning analytics taxonomy**: activation, completion, drop-off, hint use,
   time-on-task; privacy/GDPR note for EU learners.
5. **Security basics**: OAuth `state`/PKCE, CSRF/origin checks, session rotation,
   auth-endpoint rate limits, CSP, dependency scanning.
6. **Accessibility**: keyboard alternative to the terminal, `prefers-reduced-motion`
   for all animations, screen-reader-friendly roadmap.
7. **Ops runbook**: restore drill, upgrade policy, incident basics, monthly cost
   review.
8. **Governance**: Apache-2.0, DCO/CLA, Code of Conduct, maintainer list.

## Revised rollout

- **Phase 0**: sim core + terminal + one lesson + pod animation (unchanged).
- **Phase 1**: static SPA on one 8 GB VPS; 4 units; no backend.
- **Phase 2**: Go API + Postgres on one 16 GB VPS; accounts; metrics + uptime
  only.
- **Phase 2.5**: split observability host, add Loki/Tempo - only when triggered.
- **Phase 3**: KCNA + CKA tracks and mock exams; then CKAD/CKS.
- **Phase 4**: sandbox only after demand is proven; BYO-cluster first.

## Cost

| Stage | Setup | Approx. monthly |
|---|---|---|
| Phase 1 | 1× CPX32 (4/8/160) | ~€36 + backups |
| Lean Phase 2 | 1× CPX42 (8/16/320) | ~€70 + backups |
| Growth | 2× CPX32 + Storage Box | ~€80-100 |

EU Hetzner prices, excluding VAT/IPv4, Nov 2026; US regions cost roughly 2-3×.

## Scorecard

Pre-fix ratings; §14 and §15 of `architecture.md` close the scoping and trigger
gaps.

| Area | Rating | Note |
|---|---|---|
| Core product architecture | 9/10 | Sim-as-source-of-truth is the right bet |
| MVP scoping | 5/10 | Too many future components on the launch path |
| Scaling plan | 8/10 | Correct numbers; triggers missing |
| Content pipeline | 5/10 | Template/lint planned; effort and review under-specified |
| Observability | 6/10 | Good pipeline, too much at launch |
| Certification strategy | 7/10 | Accurate research; too broad for v1 |
| Deployment | 7/10 | Fully self-hosted is viable; single-box should be default |

## Decisions (approved 2026-11-23)

1. **Lean v1 + complexity-trigger model** - approved and documented in
   `architecture.md` §14.
2. **Single-box launch** - one 16 GB VPS; split only on a trigger.
3. **Certification order** - KCNA + CKA first, then CKAD/CKS.
4. **Envoy** - kept, with a minimal MVP config (TLS + routes).
5. **Hosting - Hetzner Cloud (EU)**: CPX32 for Phase 1, CPX42 for Phase 2,
   2× CPX32 for growth. AWS considered and rejected (cost + egress).
6. **License** - Apache-2.0.
