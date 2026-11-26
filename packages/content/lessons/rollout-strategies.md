Deployments support RollingUpdate and Recreate. RollingUpdate replaces Pods gradually while keeping capacity, using `maxSurge` and `maxUnavailable` to control the pace. Recreate stops old Pods before starting new ones, so it accepts downtime but avoids two versions running together.

A rollout is healthy only when the new ReplicaSet reaches the desired ready count. `kubectl rollout status` waits for that condition. `kubectl rollout history` shows revisions, and `kubectl rollout undo` restores a previous template. Pausing a rollout lets you inspect a canary batch before continuing.

Failure modes include a bad readiness probe that makes every new Pod fail, a missing image that leaves the rollout stalled, and a Recreate strategy applied to a service that cannot tolerate downtime. Resource limits and node capacity also affect rollout speed.

Verification: check rollout status, compare ReplicaSets, confirm the expected image, and roll back if readiness does not converge. A rollback is not a fix for a broken probe or configuration; it restores the previous template only. 