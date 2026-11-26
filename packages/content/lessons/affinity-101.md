Affinity expresses placement preferences and requirements. Required rules block
scheduling when they cannot be met; preferred rules only influence scoring.

- Node affinity matches node labels.
- Pod affinity groups Pods by topology.
- Anti-affinity spreads Pods apart.
- Topology spread controls skew across zones or hosts.

```bash
kubectl get pod web
kubectl describe pod web
```

**Failure modes.** Affinity failures are hard constraints. Required affinity can leave a Pod Pending when no node matches, while preferred affinity only influences scoring. Topology spread adds another constraint that can conflict with node capacity.

**Verify.** Verify the Pod's affinity and topology rules, node labels, and scheduler events. Compare the requested zones or hosts with the eligible nodes. A successful test places the Pod on a matching node and leaves enough capacity for the desired replicas. Do not use required affinity as a soft preference.

**Evidence to capture.** A placement check should name the node, zone label, and scheduler event that proves why the Pod was accepted or rejected.
