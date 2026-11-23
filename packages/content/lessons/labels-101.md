Labels are key/value pairs used to select objects. They are how Services, ReplicaSets, and NetworkPolicies find the Pods they own.

- Labels are metadata; selectors are queries over that metadata.
- `kubectl get pods -l app=web` filters by label.
- Selectors are exact-match by default; avoid mutable identity labels.

## Try it

Run:

```bash
kubectl run web --image=nginx --labels=app=web
kubectl run api --image=nginx --labels=app=api
kubectl get pods -l app=web
```

The checkpoint updates after each command.
