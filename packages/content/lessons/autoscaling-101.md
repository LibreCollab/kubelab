ResourceQuota limits namespace consumption; HorizontalPodAutoscaler changes replicas from metrics.

- Requests affect scheduling; limits affect runtime ceilings.
- HPA compares current CPU or memory utilization with its target and changes replicas.
- Small deviations inside the 10% tolerance do not cause a scale event.
- `kubectl top` shows the Pod usage feeding the metric calculation.
- Cluster Autoscaler adds nodes when Pods cannot schedule.

```bash
kubectl get hpa
kubectl describe hpa web
kubectl top pods
```

**Failure modes.** HPA failures often come from missing metrics, unstable targets, or a scale target that cannot grow. A Deployment at max replicas may be resource-starved while the HPA looks healthy. A minimum replica count can also hide a broken workload.

**Verify.** Verify the target reference, current and desired replicas, metric values, and events. Check that Pods have resource requests when using CPU or memory metrics. Confirm the nodes can schedule the new replicas. Autoscaling is useful only when the added capacity actually becomes Ready.
