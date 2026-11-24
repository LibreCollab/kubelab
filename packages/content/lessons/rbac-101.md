RBAC authorizes API requests: who can perform which verbs on which resources.

- Role/RoleBinding are namespaced.
- ClusterRole/ClusterRoleBinding are cluster-wide.
- ServiceAccounts are identities for Pods.

```bash
kubectl get serviceaccount deploy-bot
kubectl get role pod-reader
kubectl describe rolebinding read-pods
kubectl auth can-i get pods --as=system:serviceaccount:default:deploy-bot
```
