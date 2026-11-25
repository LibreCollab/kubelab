StatefulSets give each replica a stable ordinal identity. `db` with two replicas
creates `db-0` and `db-1`, not random suffixes.

- Use StatefulSets for identity-sensitive workloads.
- Combine with a headless Service for stable discovery.
- Scaling down removes the highest ordinals first.

```bash
kubectl get statefulsets
kubectl get pods
```
