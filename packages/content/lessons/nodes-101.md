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
