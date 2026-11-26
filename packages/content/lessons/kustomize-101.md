Kustomize composes plain YAML with overlays, without templating.

- Bases hold shared manifests; overlays customize.
- Patches adjust specific fields.
- `kubectl apply -k` renders and applies.

```bash
kubectl kustomize base
kubectl kustomize overlays/prod
kubectl apply -k overlays/prod
```

**Failure modes.** Kustomize failures are usually path or patch mistakes. A wrong resource path, a patch that targets a missing field, or a name prefix that changes a reference can produce a valid YAML file that deploys the wrong thing. Overlays can also drift from the base.

**Verify.** Verify the rendered output before applying it. Compare base and overlay resources, names, labels, and images. Check the live object after apply. A Kustomize build is correct when the rendered manifest is what you intend, not merely when the command exits successfully.

**Evidence to capture.** Save the rendered output next to the live object; a successful build can still contain a wrong patch or stale base.
