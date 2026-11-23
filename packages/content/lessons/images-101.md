Images are stored in registries and pulled by kubelet. Tags are mutable; digests are immutable.

- `nginx` means `nginx:latest` — convenient, not reproducible.
- `nginx:1.27` pins a version, but the tag can be re-pushed.
- `nginx@sha256:…` pins exact bytes and is the most reproducible.
- `imagePullPolicy` decides when kubelet checks the registry.
