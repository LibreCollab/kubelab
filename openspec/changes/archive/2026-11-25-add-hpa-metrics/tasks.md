# Tasks

## 1. Simulator model

- [x] 1.1 Add Pod usage and container CPU request types.
- [x] 1.2 Use authored Pod usage in `kubectl top pods`.

## 2. HPA reconciliation

- [x] 2.1 Read a Resource CPU utilization target from HPA metrics.
- [x] 2.2 Compute desired replicas from usage/request and clamp to min/max.
- [x] 2.3 Preserve total demand across replica changes and update HPA status.
- [x] 2.4 Keep seeded desired replicas as the no-metrics fallback.
- [x] 2.5 Show utilization/target in `kubectl get hpa`.

## 3. Content and tests

- [x] 3.1 Update the autoscaling lesson to author metrics, requests, usage, and show `top`.
- [x] 3.2 Add unit tests for scale-up, clamping, stable post-scale demand, and fallback.
- [x] 3.3 Run `pnpm check`.

## 4. Specs

- [x] 4.1 Validate the change with `pnpm exec openspec validate add-hpa-metrics --changes --strict`.
- [x] 4.2 Archive the change and validate all specs.
