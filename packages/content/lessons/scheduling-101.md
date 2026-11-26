The scheduler filters nodes by resources, selectors, affinity, and taints/tolerations, then scores the remainder.

- `nodeSelector` is the simplest placement rule.
- Taints repel Pods; tolerations allow them.
- Affinity expresses richer preferences and constraints.

```bash
kubectl get nodes --show-labels
kubectl describe node node-2
kubectl get pods -o wide
```

**Failure modes.** Scheduling failures come from requests, selectors, affinity, taints, and topology. A Pending Pod does not always mean the cluster is full. The scheduler may be honouring a hard constraint that the manifest never made obvious.

**Verify.** Verify Pod requests, node capacity, node labels, taints, tolerations, and events. Use `describe pod` to read the scheduler message. Confirm the Pod is not blocked by a volume or policy. A successful placement means the Pod is assigned and the kubelet can start it.

**Evidence to capture.** Record the scheduler event, node capacity, taints, and requests; the first event usually names the constraint that blocked placement.
