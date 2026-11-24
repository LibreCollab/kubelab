Liveness restarts stuck containers; readiness removes Pods from Service endpoints; startup delays other probes.

- Readiness failure does not restart the container.
- Liveness failure does.
- Tune thresholds to avoid restart storms.

```bash
kubectl get pod web
kubectl describe pod web
kubectl get endpoints web
```
