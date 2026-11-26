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

**Failure modes.** StorageClass failures are often delayed binding and provisioner problems. A claim can stay Pending until a Pod schedules, and then fail because no node satisfies topology. A missing provisioner or bad parameters can leave the claim without a volume.

**Verify.** Verify the StorageClass name, provisioner, binding mode, and reclaim policy. Read PVC events and the provisioner state. Check that the Pod schedules to a compatible node. Dynamic provisioning is working when the claim becomes Bound and the volume is usable from the workload.

**Evidence to capture.** Record class name, provisioner, binding mode, and claim event; delayed binding can make a healthy provisioner look idle.
