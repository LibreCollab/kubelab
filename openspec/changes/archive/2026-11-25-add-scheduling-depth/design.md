# Design

## Context

See `proposal.md`. The scheduler already handles node selectors, taints, and
least-loaded node choice. It does not inspect affinity, topology, namespace
defaults, quotas, or disruption budgets.

## Goals / Non-Goals

**Goals:**

- Enforce required placement constraints deterministically.
- Reuse Pod/Node stores and status for all decisions.
- Keep unschedulable Pods visible with actionable messages.
- Add basic namespace governance without admission-webhook complexity.

**Non-Goals:**

- Preferred affinity, weight scoring, or inter-namespace affinity.
- Full label-selector operators or topology domains beyond node labels.
- Eviction API or actual PDB enforcement.
- Quota scopes, object-count quotas beyond Pods, or LimitRange max/min.

## Decisions

### Extend the scheduler filter

`#podFitsNode` checks node affinity, required Pod affinity/anti-affinity,
topology spread, existing node selectors, and taints. It uses placed Pods and
node labels from the same in-memory store. When no node fits, the existing
Pending message is updated to mention affinity.

### Apply LimitRange before quota checks

Pending Pods receive missing CPU/memory requests from namespace LimitRange
defaults first. Quota calculations and placement then use the normalized Pod.
This mirrors the useful ordering without implementing admission.

### Treat quota exhaustion as unschedulable

A Pod that exceeds namespace Pod/CPU/memory hard limits stays Pending with an
`exceeded quota` message. Real Kubernetes rejects it at admission; the simulator
keeps it visible so learners can inspect the cause.

### PDB is status-only

PDB reconciliation computes healthy Pods, desired healthy count, and allowed
disruptions. No eviction command exists, so the object is observational.

## Risks / Trade-offs

- **Affinity selectors are equality-only** → Document and test the supported
  subset; do not imply full Kubernetes selector semantics.
- **Topology spread uses node labels** → Good for hostname/zone teaching; no
  arbitrary topology domains.
- **Quota keeps over-limit Pods Pending** → More inspectable than silent rejection,
  but differs from admission.
- **LimitRange defaults only requests** → Limits and min/max are deferred.
