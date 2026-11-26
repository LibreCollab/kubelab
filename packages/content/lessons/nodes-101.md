Every worker node runs kubelet, a container runtime, and kube-proxy. kubelet makes the node's Pods match the API server.

- **kubelet** - starts and monitors containers on the node.
- **container runtime** - containerd or CRI-O, via the CRI interface.
- **kube-proxy** - programs Service networking rules.
- `kubectl get nodes` shows readiness and versions.

## Try it

Run:

```bash
kubectl get nodes
```

The checkpoint updates after each command.

**Failure modes.** A node can be Ready while still unable to run new Pods because of pressure, taints, or exhausted resources. A NotReady node usually points at kubelet, runtime, networking, or connectivity to the API server. Rebooting first destroys useful evidence.

**Verify.** Verify node conditions, capacity, allocatable resources, taints, and assigned Pods. Read events and kubelet status before draining or rebooting. Confirm the node can reach the API and that the container runtime is healthy. Recovery means the scheduler can place Pods and they become Ready again.
