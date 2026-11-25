Liveness restarts stuck containers; readiness removes Pods from Service endpoints; startup delays other probes.

- Readiness failure does not restart the container.
- Liveness failure restarts it and increments the restart count.
- Repeated liveness failures back off into `CrashLoopBackOff`.
- Tune thresholds to avoid restart storms.

This scenario's simulated app returns HTTP 500 for `/healthz`, so the readiness
probe keeps the Pod out of Service endpoints without restarting it.

```bash
kubectl get pod web
kubectl describe pod web
kubectl get endpoints web
```
