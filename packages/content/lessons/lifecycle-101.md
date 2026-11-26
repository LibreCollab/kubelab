A Pod moves through Pending, Running, Succeeded, or Failed. kubelet restarts containers according to the restart policy; controllers replace deleted Pods.

- **Pending** - scheduled or waiting for images.
- **Running** - at least one container is running.
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

**Failure modes.** The common mistake is reading a phase without reading conditions and container state. A Pod can be Running while a container restarts repeatedly. Deletion can also appear stuck because of finalizers, graceful termination, or a node that cannot report back.

**Verify.** Verify phase, conditions, restart counts, and the last state reason together. Read events for kill, probe, and scheduling messages. After deletion, confirm the object is gone and any owned resources are cleaned up. Lifecycle debugging means explaining each transition, not just the final phase.
