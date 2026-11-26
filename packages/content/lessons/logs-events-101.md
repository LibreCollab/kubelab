Start debugging with `kubectl get`, `describe`, `logs`, and events.

- `kubectl logs` reads container stdout/stderr.
- `kubectl describe` shows scheduling and probe events.
- `kubectl get events` finds recent changes.

```bash
kubectl logs web
kubectl get events
kubectl describe pod web
```

**Failure modes.** Logs and events answer different questions. Logs show process output; events show control plane and kubelet decisions. A Pod with no logs may never have started, and an event may be more useful than a stack trace. Events also expire, so late debugging can lose evidence.

**Verify.** Verify logs for the specific container and previous instance when it restarted. Read events for scheduling, image, probe, and volume failures. Correlate timestamps with the rollout or change. A diagnosis is complete when the process signal and the cluster signal agree.

**Evidence to capture.** Record the container name and event timestamps; without them, logs from a previous restart can be mistaken for the current failure.
