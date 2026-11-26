Labels are key/value pairs used to select objects. They are how Services, ReplicaSets, and NetworkPolicies find the Pods they own.

- Labels are metadata; selectors are queries over that metadata.
- `kubectl get pods -l app=web` filters by label.
- Selectors are exact-match by default; avoid mutable identity labels.

## Try it

Run:

```bash
kubectl run web --image=nginx --labels=app=web
kubectl run api --image=nginx --labels=app=api
kubectl get pods -l app=web
```

The checkpoint updates after each command.

**Failure modes.** Label failures are usually silent. A typo, wrong case, or missing key changes which Service, Deployment, or NetworkPolicy selects a Pod. Extra labels are often harmless, but conflicting ownership labels can confuse selectors and dashboards.

**Verify.** Verify selectors from both sides: the workload's selector and the Pod's actual labels. Use `--show-labels` and `get pod --show-labels` before debugging traffic. After a change, confirm the affected Service has endpoints and the intended Pods are the ones selected.
