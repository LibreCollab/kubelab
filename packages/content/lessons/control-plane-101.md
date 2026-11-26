The control plane stores state and makes decisions; it does not run your application containers.

- **kube-apiserver** - the only component that talks to etcd.
- **etcd** - consistent key-value store for all cluster state.
- **kube-scheduler** - picks a node for each new Pod.
- **kube-controller-manager** - runs built-in reconcile loops.

```bash
kubectl get pods -n kube-system
kubectl describe pod etcd-node-1 -n kube-system
kubectl get nodes
```

**Failure modes.** Control plane failures often look like general cluster failures. A down API server breaks kubectl, controllers, and scheduling at once. etcd latency or certificate expiry can produce timeouts that look like network faults. A healthy worker does not mean the control plane is healthy.

**Verify.** Verify by checking control plane Pods and the API endpoint before touching workloads. Read events and component logs, confirm certificates are valid, and test a read-only API request. Separate control plane, node, and workload symptoms before choosing a repair.
