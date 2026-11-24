StorageClasses describe provisioners and parameters for dynamic volume creation.

- PVCs name a StorageClass to provision on demand.
- Default StorageClass is used when the PVC omits one.
- The `fast` class dynamically provisioned the `cache` claim into pvc-6f2d8c.
- Reclaim policies decide what happens on PVC deletion.

```bash
kubectl get storageclass
kubectl get storageclass fast
kubectl describe pvc cache
```
