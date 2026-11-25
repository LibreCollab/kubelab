A container is a running process with its own filesystem view, created from an image. Kubernetes runs Pods that contain one or more containers.

- **Image** - immutable template: application + dependencies.
- **Container** - a running instance of an image.
- **Pod** - the smallest Kubernetes unit, wrapping containers.
- Containers share the host kernel, so they start fast but are not full VMs.

```bash
kubectl run web --image=nginx --labels=app=web
kubectl get pod web
```
