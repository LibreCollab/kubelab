# Proposal

## Why

The observability lesson can show a Pod that was authored as unhealthy, but the
simulator does not evaluate probes, restart containers, or recover readiness. That
leaves a core CKA troubleshooting loop unmodeled: failing health checks, restart
counts, warning events, endpoint removal, and CrashLoopBackOff.

## What Changes

- Add readiness and liveness probe definitions to container specs.
- Evaluate probes on the virtual clock with initial delay, period, and failure
  threshold support.
- Remove unready Pods from Service endpoints without restarting them.
- Restart containers after liveness failures, increment restart counts, and emit
  warning events.
- Enter CrashLoopBackOff after repeated liveness restarts and retry with bounded
  backoff.
- Show `CrashLoopBackOff` in Pod status and real restart counts in `get pods`.
- Add a simulator-only authored probe response map for deterministic HTTP failures.
- Update the probes lesson to exercise the dynamic path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: adds probe evaluation, readiness transitions, liveness
  restarts, events, and CrashLoopBackOff; narrows the probe fidelity limitation.

## Impact

- `packages/sim` types, reconciliation, Pod output, and unit tests.
- `packages/content/lessons/probes-101.yaml` and theory.
- No new dependencies or routes.
