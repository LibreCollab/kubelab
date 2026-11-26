A Deployment manages ReplicaSets, which manage Pods. You declare replicas and a Pod template; the Deployment controller performs rolling updates.

- `kubectl create deployment web --image=nginx --replicas=3`
- `kubectl scale deployment web --replicas=5`
- `kubectl set image deployment/web nginx=nginx:1.27`
- `kubectl rollout status deployment/web` and `rollout undo`

**Failure modes.** Rollouts fail when a new template never becomes ready, when limits exceed capacity, or when a probe rejects every new Pod. A stalled rollout can leave old Pods serving traffic, which hides the defect from users but not from the deployment status.

**Verify.** Verify the Deployment's observed generation, updated replicas, available replicas, and the current ReplicaSet. Use `rollout status` and `rollout history`. If the new revision does not converge, inspect Pod events and logs before rolling back. A rollback restores the old template, not a broken image or configuration.

**Evidence to capture.** Record the Deployment generation and ReplicaSet names so a stalled revision is separated from a previous one still serving.
