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

**Failure modes.** RBAC failures are often identity or scope mistakes. A RoleBinding in the wrong namespace, a ServiceAccount that is not mounted, or a verb that was not granted all produce Forbidden errors. Authentication succeeding does not mean authorization will.

**Verify.** Verify the Role rules, the binding subjects and namespace, and the actual identity used by the Pod or user. Test with `kubectl auth can-i` using the same identity. Confirm a positive and a negative permission. Least privilege means the intended action works and nearby actions do not.

**Evidence to capture.** Record the Role, binding, namespace, and exact identity; testing a different ServiceAccount is a common false positive.
