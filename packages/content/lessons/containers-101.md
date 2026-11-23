A container is a running process with its own filesystem view, created from an image. Kubernetes does not run containers directly; it runs Pods that contain one or more containers.

- **Image** — immutable template: application + dependencies.
- **Container** — a running instance of an image.
- **Pod** — the smallest Kubernetes unit, wrapping one or more containers.
- Containers share the host kernel, so they start fast but are not full VMs.
