Secrets hold sensitive data. Base64 is encoding, not encryption.

- Enable encryption at rest in etcd for real protection.
- Prefer external secret managers via CSI or operators.
- `envFrom` injects every Secret key into the containers.
- Mounting Secrets as files avoids exposing them in `env`.

```bash
kubectl create secret generic db-secret \
  --from-literal=DB_PASSWORD=s3cr3t
kubectl create deployment api --image=nginx --replicas=1
kubectl set env deployment/api --from=secret/db-secret
kubectl describe deployment api
```

**Failure modes.** Secret failures include missing keys, namespace mismatches, and mounted values that never refresh. Base64 encoding is not encryption, and a Secret can be read by anyone with API access. A Pod can also fail before the application sees the value.

**Verify.** Verify the Secret type, keys, namespace, and consuming reference. Inspect the Deployment or Pod, then confirm the file or environment value from inside the container. Check encryption at rest and RBAC separately. A Secret is only protected when storage, access, and workload wiring are all correct.
