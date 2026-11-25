# Design

## Context

See `proposal.md`. The simulator already has most object models and controller
loops. This change fills documented gaps with deterministic, inspectable behavior
using existing stores and commands.

## Decisions

- HTTPS routes only when a matching Ingress TLS host exists.
- ServiceAccount token files are projected into supported `cat` commands using
  Pod namespace, service account name, and UID.
- Namespace Pod Security enforce labels block restricted Pods from scheduling
  unless `runAsNonRoot` and privilege-escalation rules are satisfied.
- Startup probes gate readiness/liveness. gRPC probes use the same authored
  probe-status map.
- Events older than 300 ticks are omitted from list output.
- HPA supports External average-value metrics and honors a scale-down stabilization
  window from `behavior`.
- Kustomize renders resources and simple strategic-merge patches from seeded
  files; `apply -k` reuses the same renderer.
- Helm install/upgrade records history and applies a seeded chart manifest;
  rollback appends a deployed revision.
- Argo CD compares source hashes after sync and reports drift; sync applies the
  source manifest and records the new hash.
- Widget reconciliation creates a managed ConfigMap child.

## Non-Goals

- Real TLS termination, certificate validation, or secrets.
- Full projected-volume semantics.
- Full Pod Security standards or exemptions.
- Exact Metrics Server, custom metrics adapters, or HPA behavior policies.
- Full Kustomize transformers or Helm template rendering.
- Real Argo reconciliation or operator controller generation.

## Risks / Trade-offs

- **Simplified security and toolchains** → Label limits in specs and docs.
- **Hash-only Argo drift** → Detects seeded source changes, not cluster edits.
- **TLS host check only** → Teaches routing, not certificate handling.
