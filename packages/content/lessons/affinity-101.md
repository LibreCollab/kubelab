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
