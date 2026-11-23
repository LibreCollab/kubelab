Start debugging with `kubectl get`, `describe`, `logs`, and events.

- `kubectl logs` reads container stdout/stderr.
- `kubectl describe` shows scheduling and probe events.
- `kubectl get events --sort-by=.lastTimestamp` finds recent changes.
