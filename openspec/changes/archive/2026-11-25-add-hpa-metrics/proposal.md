# Proposal

## Why

The autoscaling lesson says an HPA scales from metrics, but the simulator currently
follows the authored `status.desiredReplicas` value. That teaches the right command
surface while hiding the actual control loop. This change makes the first HPA slice
observable: CPU usage, requests, utilization, target, and resulting replica count.

## What Changes

- Add optional CPU and memory usage to simulated Pod status.
- Add optional container resource requests so CPU utilization has a denominator.
- Read a resource CPU target from HPA metrics and reconcile replicas from average
  utilization against requests.
- Keep the authored desired replica fallback when a scenario has no metric source.
- Show the live HPA target/utilization in `kubectl get hpa`.
- Make `kubectl top pods` prefer authored Pod usage.
- Update the autoscaling lesson to demonstrate the metric path.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: HPA scaling uses simulated CPU metrics when available, and
  the fidelity limit changes from "seeded intent only" to an explicit fallback.

## Impact

- `packages/sim` types, reconciliation, `top`, HPA output, and unit tests.
- `packages/content/lessons/autoscaling-101.yaml` and theory.
- No new dependencies or browser routes.
