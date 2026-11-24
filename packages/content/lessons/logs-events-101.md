Start debugging with `kubectl get`, `describe`, `logs`, and events.

- `kubectl logs` reads container stdout/stderr.
- `kubectl describe` shows scheduling and probe events.
- `kubectl get events` finds recent changes.

```bash
kubectl logs web
kubectl get events
kubectl describe pod web
```
