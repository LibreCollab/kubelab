Running containers by hand works for one process on one host. Production needs placement, restarts, discovery, and safe rollouts.

- Kubernetes is a **desired-state** system: you declare the target, controllers reconcile.
- It schedules Pods, restarts failures, exposes Services, and rolls out changes.
- The control plane is the brain; nodes run the workloads.

```bash
kubectl create deployment web --image=nginx --replicas=3
kubectl get pods -o wide
kubectl scale deployment web --replicas=5
```

**Failure modes.** The usual failure is assuming desired state is immediate. Controllers reconcile over time, and a Deployment can look healthy while a rollout is still in progress. Another failure is conflicting owners, such as an HPA and a manual scale command changing the same replica count.

**Verify.** Verify ownership before changing anything. Check the Deployment, ReplicaSets, and Pods together, then watch the next reconciliation. A controller is working when the observed state converges without manual repair and the status fields agree with the spec.
