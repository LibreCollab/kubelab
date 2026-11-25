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
