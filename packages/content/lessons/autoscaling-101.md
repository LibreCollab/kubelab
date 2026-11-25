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
