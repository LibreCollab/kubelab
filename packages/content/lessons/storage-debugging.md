Storage problems usually appear as Pending claims or Pending Pods. Start with the claim because it records the requested size, access mode, and StorageClass. A missing StorageClass, an unsupported access mode, or a delayed binding mode can all leave the claim waiting.

`kubectl describe pvc` exposes the events that matter. If dynamic provisioning is expected, confirm the provisioner is healthy. If a static volume is expected, compare capacity, access modes, and selectors. Then inspect the Pod that consumes the claim. A Pod can be Pending because the volume is unavailable, because the node cannot attach it, or because the mount path conflicts.

Stateful workloads add another layer: volume claim templates, ordinal Pod names, and topology constraints. A claim can be Bound while a Pod still fails to mount it.

Failure modes include editing a bound claim, choosing the wrong access mode, and assuming a StorageClass exists because the manifest names it. Verification: claim status, claim events, Pod events, and one successful mount or write from the workload. 