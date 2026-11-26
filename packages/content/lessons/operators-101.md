An operator extends Kubernetes with CustomResourceDefinitions and a controller that encodes operational knowledge.

- CRDs add new API types.
- Controllers reconcile custom resources.
- Operators automate things like backups, failover, and upgrades.

```bash
kubectl get widgets
kubectl describe widgets web
kubectl get widgets
```

**Failure modes.** Operator failures split into CRD, controller, and reconciliation problems. A CR can be accepted while nothing happens because the controller is not running or lacks RBAC. A controller can also update status without creating the child resources.

**Verify.** Verify the CRD, custom resource, controller Pod, and owned children. Read controller logs and events. Confirm the desired state reaches Ready and that a change triggers a new reconcile. An operator is healthy when the CR status and the actual child resources agree.

**Evidence to capture.** Compare the custom resource status with every owned child; reconciliation can be partial even when the CR reports an accepted spec.
