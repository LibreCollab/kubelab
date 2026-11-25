# Design

## Context

See `proposal.md`. HPA reconciliation already computes CPU utilization and spreads
fixed demand across replicas. Pod usage and container requests include memory.

## Goals / Non-Goals

- Reuse the same demand model for CPU and memory.
- Keep the default HPA metric selection deterministic.
- Avoid replica churn inside the tolerance band.

**Non-Goals:**

- Custom/external metrics, multi-metric priority, or behavior policies.
- Real metrics-server aggregation or stabilization windows.

## Decisions

- Generalize the target to `{resource, target}` and read the first supported
  Resource CPU or memory utilization metric.
- Reuse `#averageUtilization` with either CPU millicores or memory bytes.
- Store the observed value in the matching status field.
- Keep replicas when utilization is within 10% of the target; otherwise use the
  existing ceiling ratio.

## Risks / Trade-offs

- **First metric wins** → Deterministic and documented; multi-metric priority is
  deferred.
- **Tolerance is fixed** → Matches the default teaching behavior but is not
  configurable yet.
- **Memory cost is static per Pod** → Demand spreading still uses the replica
  ratio from the CPU model.
