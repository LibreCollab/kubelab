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
