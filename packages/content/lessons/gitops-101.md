GitOps treats Git as the source of truth; an agent reconciles the cluster to the repository.

- Argo CD and Flux are common agents.
- PRs become the change-review mechanism.
- Drift detection keeps clusters honest.

```bash
argocd app list
argocd app get web
argocd app sync web
```
