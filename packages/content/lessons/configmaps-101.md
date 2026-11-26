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

**Failure modes.** ConfigMap failures are often shape mismatches. A missing key, wrong variable name, or full `envFrom` import can overwrite values unexpectedly. Optional references can fail silently while required references block Pod startup.

**Verify.** Verify the ConfigMap keys and the workload's `env`, `envFrom`, or volume references. Read the Deployment spec, then inspect the running Pod or mounted file. Confirm the application reads the expected key and that changing configuration has a defined reload path.

**Evidence to capture.** Record the ConfigMap resource version and the Pod template generation so a stale mount can be distinguished from a bad key.
