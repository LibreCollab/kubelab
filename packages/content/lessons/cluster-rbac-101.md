ClusterRoles and ClusterRoleBindings grant cluster-scoped permissions. Use them
for resources that are not namespaced or for access across namespaces.

- Role/RoleBinding are namespaced.
- ClusterRole/ClusterRoleBinding are cluster-scoped.
- Bind the smallest permission set that works.

```bash
kubectl get clusterroles
kubectl auth can-i list pods --as=system:serviceaccount:default:deploy-bot
```
