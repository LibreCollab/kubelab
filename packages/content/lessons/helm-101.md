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
