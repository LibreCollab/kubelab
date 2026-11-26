Helm packages Kubernetes manifests into charts with templating and values.

- A chart has templates, defaults, and metadata.
- Values override templates per environment.
- Releases track installed chart versions and revisions.

```bash
helm list
helm status web
helm history web
helm upgrade web ./chart --set replicas=5
helm rollback web 1
```

**Failure modes.** Helm failures often come from values, release history, or ownership. A bad values override can render an invalid manifest, and a failed upgrade can leave a release pending. Reusing a release name in another namespace is a separate source of confusion.

**Verify.** Verify the release status, revision history, rendered values, and the cluster objects. Use `helm get manifest` and compare with the expected values. If an upgrade fails, inspect the first failing resource rather than repeating the command. A release is healthy when its rendered objects are Ready and its history explains the current revision.

**Evidence to capture.** Record the release revision, chart version, and rendered manifest so rollback decisions use evidence rather than the last command.
