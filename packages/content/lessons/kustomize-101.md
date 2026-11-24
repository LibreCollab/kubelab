Kustomize composes plain YAML with overlays, without templating.

- Bases hold shared manifests; overlays customize.
- Patches adjust specific fields.
- `kubectl apply -k` renders and applies.

```bash
kubectl kustomize base
kubectl kustomize overlays/prod
kubectl apply -k overlays/prod
```
