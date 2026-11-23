Running containers by hand works for one process on one host. Production needs placement, restarts, discovery, and safe rollouts.

- Kubernetes is a **desired-state** system: you declare the target, controllers reconcile.
- It schedules Pods, restarts failures, exposes Services, and rolls out changes.
- The control plane is the brain; nodes run the workloads.
