DaemonSets run one Pod on every eligible node. Common uses are log shippers,
node exporters, and CNI agents.

- New nodes automatically receive a DaemonSet Pod.
- Taints and selectors control eligibility.
- Deleting a node removes its DaemonSet Pod.

```bash
kubectl get daemonsets
kubectl get pods -o wide
```
