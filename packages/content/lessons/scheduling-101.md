The scheduler filters nodes by resources, selectors, affinity, and taints/tolerations, then scores the remainder.

- `nodeSelector` is the simplest placement rule.
- Taints repel Pods; tolerations allow them.
- Affinity expresses richer preferences and constraints.

```bash
kubectl get nodes --show-labels
kubectl describe node node-2
kubectl get pods -o wide
```
