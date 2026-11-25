# Design

## Context

See `proposal.md`. The engine already has a Pod scheduler, PodTemplate shape,
reconciliation loop, and generic get/describe/YAML paths. New controllers can
reuse those instead of introducing a second workload model.

## Goals / Non-Goals

**Goals:**

- Reconcile DaemonSets, StatefulSets, Jobs, and CronJobs using existing Pods.
- Keep generated Pods visible to normal scheduling and inspection commands.
- Delay Pod startup while init containers are pending.
- Keep tests deterministic and short.

**Non-Goals:**

- StatefulSet PVC templates, ordered rolling updates, or pod management policies.
- Job retries, backoff limits, TTL cleanup, or parallelism tuning after creation.
- Full cron parsing, time zones, deadlines, or concurrency policies.
- Kubernetes-grade init container logs or per-container lifecycle detail.

## Decisions

### Build managed Pods through one helper

All new controllers use the same Pod creation helper, which clones containers,
init containers, template labels, an optional node name, and emits `pod.created`.
Normal scheduling, readiness, and logging then apply automatically.

### Use owner labels for reconciliation

DaemonSet Pods carry `daemonset`, StatefulSet Pods carry `statefulset` and a pod
index, Job Pods carry `job-name`, and CronJob-created Jobs carry `cronjob`.
Controllers list and delete by those labels instead of maintaining child arrays.

### Complete Job Pods after a short deterministic run

Job Pods reach Running through normal scheduling, then become Succeeded after two
virtual ticks. Job status counts active and succeeded Pods and becomes Complete at
the requested completion count. This is deliberately simplified but observable.

### Simplify CronJob schedules

Support `@every Ns`, `@hourly`, `* * * * *`, and `*/N * * * *`. The simulator
converts them into tick intervals; invalid schedules fall back to one minute.

### Model init containers as an initialization gate

A scheduled Pod with init containers remains Pending for one reconciliation with
an `Init:0/N` message, then proceeds to Running. The gate is all-or-nothing and
does not execute real init commands.

## Risks / Trade-offs

- **Init containers are coarse** → Show progress and keep sequencing visible; do
  not imply real command execution.
- **Jobs complete without containers running** → Use a fixed two-tick runtime and
  document the simplification in the spec.
- **Cron parsing is narrow** → Support common teaching forms and fall back safely.
- **StatefulSets lack PVC templates** → Keep ordinal identity and scaling, and
  leave storage identity for a later change.
- **Generic get/describe output is minimal** → Add focused list tables for status
  without duplicating the object model.
