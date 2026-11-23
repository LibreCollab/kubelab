# Kubelab

A gamified Kubernetes learning platform: a Duolingo-style roadmap, longer
interactive lessons, a simulated cluster console, and under-the-hood animations
that take a learner from zero to certification-ready.

> Status: pre-alpha scaffold. The simulation engine, curriculum, and Go API are
> being built. See [`docs/architecture.md`](docs/architecture.md) for the plan,
> [`docs/architecture-audit.md`](docs/architecture-audit.md) for scope
> decisions, [`docs/scaffolding-audit.md`](docs/scaffolding-audit.md) for the
> scaffold review, and [`docs/code-review.md`](docs/code-review.md) for the
> design/Go review.

## Stack

- **Web**: Vite + React 19 + TanStack Router, strict TypeScript, CSS Modules +
  Sass design tokens, xterm.js terminal.
- **Simulation**: pure TypeScript engine (`@kubelab/sim`) with a virtual clock,
  object store, and kubectl parser subset.
- **Content**: YAML lesson specs + Markdown theory (`@kubelab/content`),
  validated with Zod.
- **API**: Go 1.27, stdlib HTTP, SPA embedded in the binary, Postgres.
- **Edge**: Envoy. **Hosting**: self-hosted Hetzner Cloud (see docs).

## Repo layout

```
apps/web            React SPA (lessons, terminal, roadmap)
apps/api            Go API + embedded SPA
packages/sim        simulation engine + kubectl parser
packages/content    lessons, schemas, validation
packages/ui         design system (CSS Modules + tokens)
e2e                 Playwright end-to-end tests
deploy/envoy        edge proxy config
deploy/compose      local/prod compose stack
docs                architecture, audits, ADRs
```

## Prerequisites

- [mise](https://mise.jdx.dev/) — installs Node 24, Go 1.27, and pnpm 11 from
  [`mise.toml`](mise.toml)
- Docker (optional, for the full stack)

Without mise: Node.js 24+, pnpm 11+, Go 1.27+; run the same underlying
`pnpm`/`go` commands listed below.

## Quickstart

```bash
mise install
mise run install
mise run dev        # web at http://localhost:5173
mise run api-dev    # Go API at http://localhost:8080 (separate terminal)
```

The web dev server proxies `/api` to the Go API. The lesson page shows the
simulated terminal; Phase 1 works fully client-side.

### Full stack

```bash
mise run up
# http://localhost:8080 (set ENVOY_PORT if 8080 is taken)
# creates .env from .env.example on first run
```

## Scripts

| Command | Description |
|---|---|
| `mise run dev` | Vite dev server |
| `mise run build` | Build the web app |
| `mise run lint` | Biome + Stylelint |
| `mise run typecheck` | Type-check every workspace package |
| `mise run test` | Vitest (sim, content, lesson checks) |
| `mise run e2e` | Playwright E2E (install browsers once with `mise run e2e-install`) |
| `mise run api-dev` | Run the Go API |
| `mise run api-test` | Go tests |
| `mise run check` | lint + typecheck + tests + Go tests |
| `mise run up` | Full Compose stack |

## Current scaffold

- One sample lesson (`pods-101`) with YAML spec + Markdown theory and
  structured checkpoint checks.
- Simulated `kubectl get nodes`, `get pods` (including `-l` selectors and
  `--show-labels`), `run`, `describe`, `delete`, and `help`, with virtual-clock
  pod updates.
- Readline-style terminal editing: paste, insert at cursor, backspace/delete,
  Home/End, arrow keys, Ctrl/Alt word navigation, Ctrl+A/E/U/K/W, and ↑/↓ history.
- Checkpoints stay pending on wrong values (name, labels, image, phase). Guided
  lessons also reject a `kubectl run` that does not match the required pod
  name/namespace/labels/image **before** creating anything, and require the
  verification command (e.g. `kubectl get pods`) before completion.
- The terminal stays sticky beside the theory on desktop while the lesson scrolls,
  with a live checkpoint counter and the exact pending checks in the terminal
  panel.
- Terminal UI, roadmap landing page, and a lazy-loaded lesson route.
- Playwright E2E covering landing → lesson, terminal → checkpoint, and the API
  health check through the dev proxy.
- Go API with `/api/healthz`, SPA embedding, graceful shutdown.
- Envoy + Compose config and a CI workflow.

## License

Apache-2.0. See [`LICENSE`](LICENSE).
