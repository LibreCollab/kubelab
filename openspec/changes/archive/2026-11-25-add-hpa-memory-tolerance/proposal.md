# Proposal

## Why

The HPA slice supports CPU utilization only. Learners also need memory targets,
and real HPAs do not churn replicas for tiny deviations around the target.

## What Changes

- Support Resource memory utilization targets alongside CPU.
- Compute memory utilization from Pod memory usage against container memory requests.
- Add the default 10% scaling tolerance so in-range utilization keeps replicas stable.
- Show the metric resource and current/target percentage in HPA output.
- Update tests and autoscaling theory.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: expands HPA resource metrics and scale tolerance.

## Impact

- `packages/sim` HPA types, reconciliation, output, and tests.
- Autoscaling lesson theory.
- No new routes or dependencies.
