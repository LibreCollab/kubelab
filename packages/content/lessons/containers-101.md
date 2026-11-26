A container is a running process with its own filesystem view, created from an image. Kubernetes runs Pods that contain one or more containers.

- **Image** - immutable template: application + dependencies.
- **Container** - a running instance of an image.
- **Pod** - the smallest Kubernetes unit, wrapping containers.
- Containers share the host kernel, so they start fast but are not full VMs.

```bash
kubectl run web --image=nginx --labels=app=web
kubectl get pod web
```

**Failure modes.** A common failure is treating an image tag as immutable. If the tag moves, two Pods created at different times can run different code. Missing entrypoints, wrong working directories, and filesystem permission errors also appear as CrashLoopBackOff rather than an obvious container error.

**Verify.** Verify by inspecting the image reference, command, and container state in `kubectl describe pod`. Read logs for the process exit reason and confirm the image runs with the expected user. A container is healthy only when the process and its probes agree.
