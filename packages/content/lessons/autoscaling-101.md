ResourceQuota limits namespace consumption; HorizontalPodAutoscaler changes replicas from metrics.

- Requests affect scheduling; limits affect runtime ceilings.
- HPA reads metrics and scales Deployments.
- Cluster Autoscaler adds nodes when Pods cannot schedule.
