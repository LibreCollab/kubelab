ResourceQuota limits aggregate namespace consumption. LimitRange supplies
defaults or bounds for individual containers.

- Quotas can count Pods, CPU, memory, and object kinds.
- LimitRange defaults requests before quota checks.
- Exhausted quotas block or delay new workloads.

```bash
kubectl get resourcequota
kubectl describe resourcequota team-quota
kubectl get limitrange
```

**Failure modes.** Quota failures appear at admission time or as Pending Pods. A namespace can reject a new object because the quota is exhausted, or a LimitRange can inject defaults that change scheduling. Requests that look small in one manifest can exceed the aggregate limit.

**Verify.** Verify quota hard and used values, LimitRange defaults, and the offending object's requests and limits. Read events for admission denials. Confirm the workload fits both the namespace quota and node capacity. Quotas are working when they constrain consumption without silently blocking legitimate deploys.

**Evidence to capture.** Capture quota hard and used values plus the rejected object request; aggregate math explains most admission failures.
