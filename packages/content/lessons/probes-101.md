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

**Failure modes.** Probe failures can remove a healthy process from Service endpoints or restart it repeatedly. A readiness probe that is too strict causes 503s; a liveness probe that is too aggressive causes restart loops. Startup probes exist to protect slow boot paths.

**Verify.** Verify probe path, port, thresholds, and timing against the application's real behavior. Check Pod readiness, restart counts, and endpoint membership. Use events and logs to see which probe failed. A correct probe configuration matches startup and steady-state behavior without flapping.
