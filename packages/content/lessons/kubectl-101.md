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

**Failure modes.** A common failure is using the wrong context, namespace, or resource name and believing the cluster is empty. Another is copying a command from a different API version so fields are silently ignored. Output that looks successful can still describe the wrong object.

**Verify.** Verify with the current context, target namespace, and exact resource name. Use `--show-labels`, `-o wide`, and `describe` to confirm identity and state. Before applying a change, read the object back and check the fields that matter rather than trusting the command message.
