Jobs run batch work to completion. Unlike Deployments, they do not keep a
resident replica count.

- `completions` is the target number of successful Pods.
- `parallelism` limits how many run at once.
- Completed Job Pods enter `Succeeded`.

```bash
kubectl get jobs
kubectl describe job migrate
```
