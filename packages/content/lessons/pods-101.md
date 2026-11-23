A Pod is the smallest deployable unit in Kubernetes. It wraps one or more
containers that share a network namespace and storage volumes.

When you ask Kubernetes to run a container, you create a Pod. The scheduler picks
a node, the kubelet starts the containers, and the Pod moves through phases:

1. **Pending** — accepted, but not yet scheduled or started.
2. **Running** — at least one container is running.
3. **Succeeded / Failed** — the containers exited.

## Try it

Create a Pod running nginx:

```bash
kubectl run web --image=nginx --labels=app=web
```

Then watch it move from Pending to Running:

```bash
kubectl get pods
```

The simulated clock advances on its own; you can also press **Step** to advance
it manually. Inspect the Pod with:

```bash
kubectl describe pod web
```

The checkpoint on the right fills in as the Pod appears, gets its label, and
reaches `Running`.
