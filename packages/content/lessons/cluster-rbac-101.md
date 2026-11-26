ClusterRoles and ClusterRoleBindings grant cluster-scoped permissions. Use them
for resources that are not namespaced or for access across namespaces.

- Role/RoleBinding are namespaced.
- ClusterRole/ClusterRoleBinding are cluster-scoped.
- Bind the smallest permission set that works.

```bash
kubectl get clusterroles
kubectl auth can-i list pods --as=system:serviceaccount:default:deploy-bot
```

**Failure modes.** Cluster-scoped RBAC mistakes are high impact. A ClusterRoleBinding grants access across namespaces, and a broad verb such as `*` can expose resources far beyond the intended task. The binding may look small while the role is broad.

**Verify.** Verify the ClusterRole rules, the binding subjects, and the identity being tested. Use `auth can-i` for the exact verb and resource. Confirm the permission is needed cluster-wide rather than namespace-scoped. A safe result grants the target action without unrelated cluster access.

**Evidence to capture.** Check the binding subject, role rules, and exact tested identity before accepting a cluster-wide permission as intentional.

Also record whether the permission must be cluster-wide or can be reduced to a namespaced Role.
