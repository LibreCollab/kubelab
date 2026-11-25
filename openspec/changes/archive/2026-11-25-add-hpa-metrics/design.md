# Design

## Context

See `proposal.md`. The simulator already reconciles seeded HPA desired replicas
and exposes synthetic `top` values. It has no per-Pod usage model and container
specs have no resource requests. The autoscaling lesson currently states that
metrics drive scaling without simulating the calculation.

## Goals / Non-Goals

**Goals:**

- Keep the engine deterministic and backward compatible for scenarios without metrics.
- Use the same Pod usage data for `top` and HPA calculations.
- Make one scale-up and one stable post-scale tick observable in unit tests.
- Keep production Kubernetes semantics recognizable.

**Non-Goals:**

- Full Metrics Server, custom metrics, memory targets, or external metrics.
- HPA stabilization windows, tolerance, or multi-metric priority.
- Probe behavior, restart backoff, or cluster autoscaling.

## Decisions

### Add optional usage and requests instead of a metrics subsystem

`Pod.status.usage` carries CPU millicores and memory bytes. Container
`resources.requests.cpu` provides the utilization denominator. Both are optional;
missing data disables metric-based scaling rather than fabricating it.

Alternative considered: infer usage from Pod names. Rejected because HPA math
would be untraceable and tests would encode arbitrary hashes.

### Preserve total CPU demand when replicas change

The first metric tick computes utilization from Pod usage and requests. Later
ticks adjust utilization by the ratio of previous to current replicas, modeling
the same total workload spread across more Pods. This prevents an HPA from
scaling to max on every tick after a successful scale-up.

Alternative considered: keep utilization fixed after scaling. Rejected because
it creates runaway growth and teaches incorrect control-loop behavior.

### Use a narrow HPA metric shape

Read the first Resource CPU `averageUtilization` target from `spec.metrics`.
Fall back to seeded `status.desiredReplicas` when the target is absent or no Pod
has both usage and a CPU request. This preserves existing lesson scenarios and
the current fidelity disclosure.

### Keep the command surface familiar

`kubectl get hpa` shows `current%/target%` in TARGETS. `kubectl top pods` uses
authored usage, otherwise its existing deterministic estimate. No new commands.

## Risks / Trade-offs

- **Scenarios encode load indirectly** → Keep usage and requests authored in the
  lesson/test scenario so the calculation is inspectable.
- **HPA can still differ from production** → State fallback and simplified demand
  behavior in the capability spec and lesson.
- **Existing seeded HPA lessons may change** → Only use metrics when explicitly
  authored; otherwise retain the old desired replica path.
- **Memory targets are not yet supported** → Treat them as out of scope and keep
  disclosure explicit.
