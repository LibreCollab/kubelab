Images are stored in registries and pulled by kubelet. Tags are mutable; digests are immutable.

- `nginx` means `nginx:latest` - convenient, not reproducible.
- `nginx:1.27` pins a version, but the tag can be re-pushed.
- `nginx@sha256:…` pins exact bytes and is the most reproducible.
- `imagePullPolicy` decides when kubelet checks the registry.

```bash
kubectl run web --image=nginx:1.27
kubectl describe pod web
```

**Failure modes.** The main failure is mutable `latest` tags and registries that quietly return a different image. Another is an image that cannot be pulled because the registry, tag, or pull secret is wrong. Air-gapped clusters add mirror and digest problems.

**Verify.** Verify the exact reference stored on the workload, not the one in your notes. Compare tags with digests, confirm the pull secret exists when required, and inspect Pod events for image pull failures. Pin the version and digest when reproducibility matters.

**Evidence to capture.** Record the resolved digest, registry, and pull secret reference so a later tag move can be detected immediately.
