# Design

## Context

See `proposal.md`. Pods already carry static conditions, Service endpoints use
`isPodReady`, and the probes lesson seeds a failure. The engine needs a
deterministic probe loop without running real containers or HTTP servers.

## Goals / Non-Goals

**Goals:**

- Evaluate readiness and liveness on the virtual clock.
- Keep readiness and liveness consequences distinct.
- Make restart counts, warning events, and CrashLoopBackOff observable through
  existing commands.
- Preserve existing static scenarios that do not define probes.
- Keep the simulation deterministic and unit-testable.

**Non-Goals:**

- Startup probes, gRPC probes, named ports, or real container execution.
- Kubernetes' exact probe scheduling, jitter, or backoff algorithms.
- Multi-container readiness edge cases beyond independent container status.

## Decisions

### Store probe state on the Pod status

`containerStatuses` holds readiness and restart counts. `probeState` tracks the
last evaluation tick, consecutive failures, and successes per container/probe.
This keeps controller state serializable and visible in `-o yaml`.

Alternative considered: keep probe state in a side map in the engine. Rejected
because Pod state should survive a snapshot and remain inspectable.

### Add a simulator-only HTTP response map

Real probes need a running server. Lessons instead author
`simulator.probeStatus.readiness` or `.liveness`. Missing values default to HTTP
200. Exec probes recognize explicit `false` and `exit 1` commands. The spec and
lesson disclose that this is a simulation input, not a Kubernetes field.

Alternative considered: infer failures from paths such as `/fail`. Rejected
because it is hidden magic that authors cannot discover.

### Readiness and liveness have separate consequences

Readiness failures only change the Ready condition and Service eligibility.
Liveness failures increment the restart count, reset probe state, and emit
warning events. Three restarts enter CrashLoopBackOff with a bounded retry delay.

Alternative considered: restart on any probe failure. Rejected because it teaches
the wrong readiness semantics and breaks the existing lesson.

### Use existing Pod status output

`get pods` reads container readiness and restart totals, and reports
`status.reason` before phase. This makes CrashLoopBackOff visible without adding a
new command or route.

## Risks / Trade-offs

- **Probe scheduling differs from Kubernetes** → Use initial delay, period, and
  failure threshold only; disclose the simplification in the spec.
- **Authored HTTP status is non-standard** → Mark it as simulator-only in content
  and never imply a real application server exists.
- **Events could flood** → Emit on threshold transitions and backoff only, not on
  every failed evaluation.
- **Static scenarios might change** → Evaluate only Pods with probes and preserve
  existing conditions when no threshold has been crossed.
