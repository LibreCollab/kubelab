StatefulSets give each replica a stable ordinal identity. `db` with two replicas
creates `db-0` and `db-1`, not random suffixes.

- Use StatefulSets for identity-sensitive workloads.
- Combine with a headless Service for stable discovery.
- Scaling down removes the highest ordinals first.

```bash
kubectl get statefulsets
kubectl get pods
```

**Failure modes.** StatefulSets fail when stable identity or storage does not match the workload. A Pending Pod can be waiting for a volume, a missing headless Service, or a node that cannot satisfy topology constraints. Ordered startup also makes one bad ordinal block later ones.

**Verify.** Verify the headless Service, volume claim templates, ordinal Pods, and their claims. Read events for volume and scheduling errors. Confirm the Pod reaches Ready before expecting the next ordinal to start. Stable identity is useful only when the application uses it correctly.

**Evidence to capture.** Record ordinal names, claim names, and start order; one blocked ordinal often explains why later replicas never appear.
