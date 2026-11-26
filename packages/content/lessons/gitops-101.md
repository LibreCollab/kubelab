GitOps treats Git as the source of truth; an agent reconciles the cluster to the repository.

- Argo CD and Flux are common agents.
- PRs become the change-review mechanism.
- Drift detection keeps clusters honest.

```bash
argocd app list
argocd app get web
argocd app sync web
```

**Failure modes.** GitOps failures are usually drift, sync, or ownership problems. The repository can be correct while the cluster is OutOfSync, or the controller can lack permission to apply a resource. A healthy application status does not prove the desired revision reached the cluster.

**Verify.** Verify the application's source revision, sync status, health, and the live object. Read controller events for permission or reconciliation errors. After a sync, confirm the resource version matches Git. GitOps is working when Git remains the source of truth and drift is corrected automatically.

**Evidence to capture.** Capture the Git revision, sync result, and live resource version; those three values show whether Git or the cluster drifted.
