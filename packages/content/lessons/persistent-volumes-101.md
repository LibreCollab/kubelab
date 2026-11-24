A PersistentVolume is cluster storage; a PersistentVolumeClaim is a request for storage.

- Pod volumes tie a Pod to a PVC.
- PVCs bind to PVs by size, class, and access mode.
- `ReadWriteOnce` is common for block storage.

```bash
kubectl get pvc data
kubectl describe pvc data
kubectl get pod db -o wide
```
