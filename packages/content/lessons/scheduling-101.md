The scheduler filters nodes by resources, selectors, affinity, and taints/tolerations, then scores the remainder.

- `nodeSelector` is the simplest placement rule.
- Taints repel Pods; tolerations allow them.
- Affinity expresses richer preferences and constraints.
