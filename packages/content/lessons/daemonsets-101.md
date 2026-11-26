DaemonSets run one Pod on every eligible node. Common uses are log shippers,
node exporters, and CNI agents.

- New nodes automatically receive a DaemonSet Pod.
- Taints and selectors control eligibility.
- Deleting a node removes its DaemonSet Pod.

```bash
kubectl get daemonsets
kubectl get pods -o wide
```

**Failure modes.** DaemonSet failures often come from node selection rather than the container. Taints, affinity, unschedulable nodes, and missing tolerations reduce desired coverage. A DaemonSet can be healthy on some nodes and absent on others.

**Verify.** Verify desired, current, ready, and available numbers. Compare eligible nodes with the Pods that exist. Read events for taint and affinity failures. Confirm the DaemonSet tolerates the control plane or special nodes only when it truly needs to run there.

**Evidence to capture.** List eligible nodes beside the DaemonSet Pods; coverage gaps usually identify the taint, label, or affinity rule to fix.

Record the node selector and tolerations together, because one can cancel the other on special nodes.
