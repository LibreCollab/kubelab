kubectl is a client for the API server. It reads your kubeconfig context to pick a cluster and namespace.

- `kubectl get <resource>` lists objects.
- `-n namespace` scopes the request; `-A` lists all namespaces.
- `-o wide` adds columns; `--show-labels` reveals labels.
- `kubectl describe` shows events and details for one object.

## Try it

Run:

```bash
kubectl get nodes
kubectl get pods
```

The checkpoint updates after each command.
