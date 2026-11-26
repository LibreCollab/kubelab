Troubleshooting starts by deciding where the failure lives. A control plane failure usually affects many nodes and API requests. A node failure affects workloads on that node. A workload failure often leaves the API and other nodes healthy.

Check control plane Pods in `kube-system` and read their events. A failing API server can make every other command unreliable. If the API is healthy, inspect Nodes and the affected workload. `kubectl describe node` shows conditions, pressure, taints, and assigned Pods. `kubectl describe pod` shows scheduling, image, probe, and volume events.

Do not restart everything at once. Preserve logs and events first. Compare the failing Pod with a healthy replica. Check whether the scheduler ever placed it, whether the kubelet pulled the image, and whether the container started and then exited.

Failure modes include confusing a CrashLoop with a scheduling failure, missing a node pressure condition, and deleting evidence before reading it. Verification: identify the scope, name the failing component, and confirm one targeted command that proves the hypothesis. 