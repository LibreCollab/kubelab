ConfigMaps hold non-secret configuration as key/value data or files.

- Consume as env vars, `envFrom`, or mounted files.
- Changing a mounted ConfigMap eventually updates the file, not the process.
- `envFrom` injects all keys; changing it requires a rollout.
- Use immutable ConfigMaps for safer rollouts.

```bash
kubectl create configmap app-config \
  --from-literal=APP_MODE=production \
  --from-literal=LOG_LEVEL=debug
kubectl create deployment web --image=nginx --replicas=2
kubectl set env deployment/web --from=configmap/app-config
kubectl describe deployment web
```
