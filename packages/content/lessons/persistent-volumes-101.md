A PersistentVolume is cluster storage; a PersistentVolumeClaim is a request for storage.

- Pod volumes tie a Pod to a PVC.
- PVCs bind to PVs by size, class, and access mode.
- `ReadWriteOnce` is common for block storage.

```bash
kubectl get pvc data
kubectl describe pvc data
kubectl get pod db -o wide
```

**Failure modes.** PVC failures usually come from a missing volume, incompatible access mode, capacity mismatch, or missing StorageClass. A claim can be Pending for a long time without an obvious error in the Pod. A bound claim can still fail to mount on a specific node.

**Verify.** Verify claim status and events, then compare capacity, access modes, class, and selectors. Inspect the Pod's volume and node events. A storage path is healthy only when the claim is Bound and the workload can read and write the mounted path.

**Evidence to capture.** Record claim status, volume name, access mode, and the consumer Pod event so a binding problem is not confused with a mount problem.
