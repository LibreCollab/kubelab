A Pod moves through Pending, Running, Succeeded, or Failed. kubelet restarts containers according to the restart policy; controllers replace deleted Pods.

- **Pending** — scheduled or waiting for images.
- **Running** — at least one container is running.
- `kubectl describe pod` shows events and container state.
- `kubectl logs` shows container output.

## Try it

Run:

```bash
kubectl run web --image=nginx
kubectl get pods
kubectl describe pod web
```

The checkpoint updates after each command.
