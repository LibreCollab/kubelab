# Proposal

## Why

The simulator teaches Pods and Deployments but not the other workload controllers
that appear in CKA and CKAD tasks. Learners cannot inspect ordinal Pods, per-node
agents, batch completion, schedules, or init-container sequencing.

## What Changes

- Add Pod init containers and delay main containers until init work completes.
- Add DaemonSet reconciliation with one Pod per ready node.
- Add StatefulSet reconciliation with stable ordinal Pod names.
- Add Jobs with completions, active Pods, and successful completion.
- Add CronJobs that create Jobs on a simulated schedule.
- Add list/describe/YAML support for all new workload kinds.
- Seed generated Pods with owner labels and controller-managed status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: expands workload lifecycle coverage beyond Deployments and ReplicaSets.

## Impact

- `packages/sim` types, seed/apply validation, reconciliation, output, and tests.
- Content schema object kinds.
- No new routes or dependencies.
