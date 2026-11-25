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
