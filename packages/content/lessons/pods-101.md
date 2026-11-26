A Pod is the smallest deployable unit in Kubernetes. It wraps one or more
containers that share a network namespace and storage volumes.

When you ask Kubernetes to run a container, you create a Pod. The scheduler picks
a node, the kubelet starts the containers, and the Pod moves through phases:

1. **Pending** - accepted, but not yet scheduled or started.
2. **Running** - at least one container is running.
3. **Succeeded / Failed** - the containers exited.

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

**Failure modes.** Pods fail for predictable reasons: the scheduler cannot place them, the kubelet cannot pull the image, a probe fails, a volume does not mount, or the process exits. A Running phase does not prove readiness, and a pending phase does not prove the image is wrong.

**Verify.** Verify with `get pods`, `describe pod`, and logs. Read Events for scheduling, image, volume, and probe messages. Check labels and the selected namespace. A Pod is ready when its containers are running, readiness succeeds, and the conditions report Ready=True.
