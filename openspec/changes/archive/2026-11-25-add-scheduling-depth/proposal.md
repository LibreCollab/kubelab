# Proposal

## Why

Scheduling currently covers node selectors and taints only. CKA/CKAD tasks also
require affinity, topology spread, namespace resource governance, default
requests, and disruption budgets. The simulator should make those constraints
observable through placement and existing commands.

## What Changes

- Add required node affinity match expressions.
- Add required Pod affinity and anti-affinity with topology keys.
- Add required topology-spread constraints.
- Add LimitRange default requests for containers.
- Add ResourceQuota limits for Pod count, CPU requests, and memory requests.
- Add PodDisruptionBudget status reconciliation and inspection.
- Add list/describe/YAML support for quota, limit range, and PDB resources.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: expands scheduling and namespace-governance behavior.

## Impact

- `packages/sim` types, scheduler filters, quota/defaulting, PDB status, and tests.
- Content scenario kinds.
- No new routes or dependencies.
