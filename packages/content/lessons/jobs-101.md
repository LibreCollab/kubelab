Jobs run batch work to completion. Unlike Deployments, they do not keep a
resident replica count.

- `completions` is the target number of successful Pods.
- `parallelism` limits how many run at once.
- Completed Job Pods enter `Succeeded`.

```bash
kubectl get jobs
kubectl describe job migrate
```

**Failure modes.** Jobs fail when completions are unreachable, backoff limits are exhausted, or a Pod is rejected by scheduling. A Job can report a failed Pod while continuing retries, so reading only Pod status is misleading. CronJobs add schedule and concurrency problems.

**Verify.** Verify Job completions, active Pods, failed attempts, and conditions. Read Pod logs to separate application failure from infrastructure failure. For CronJobs, check the schedule, last schedule time, and whether a previous run is still active.

**Evidence to capture.** Capture completions, backoff limit, and the failed Pod logs; retries can hide the first real failure.

Record the Job conditions and the first failed Pod UID so a retry is not confused with the original failure.
