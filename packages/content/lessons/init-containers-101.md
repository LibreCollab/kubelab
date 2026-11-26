Init containers run before application containers. They are useful for setup,
waiting for dependencies, and preparing volumes.

- They run one at a time in order.
- A failed init container blocks app startup.
- They can use different images from the app container.

```bash
kubectl get pod web
kubectl describe pod web
```

**Failure modes.** Init containers must terminate successfully. A loop, missing dependency, or failed download leaves the Pod stuck in Init and the app container never starts. Init failures can look like a slow application because no main logs exist yet.

**Verify.** Verify init container status, restart count, and logs. Read Pod events for image or volume problems. Confirm each init step exits with success and the app container starts afterward. Do not add long-running work to an init container unless blocking startup is the intended behavior.

**Evidence to capture.** Check the init container exit code and last state before blaming the application container or its image.
