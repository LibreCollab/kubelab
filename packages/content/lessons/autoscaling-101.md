ResourceQuota limits namespace consumption; HorizontalPodAutoscaler changes replicas from metrics.

- Requests affect scheduling; limits affect runtime ceilings.
- HPA compares current CPU utilization with its target and changes replicas.
- `kubectl top` shows the Pod usage feeding the metric calculation.
- Cluster Autoscaler adds nodes when Pods cannot schedule.

```bash
kubectl get hpa
kubectl describe hpa web
kubectl top pods
```
