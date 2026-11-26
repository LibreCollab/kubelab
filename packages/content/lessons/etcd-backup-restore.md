etcd is the cluster datastore. Every API object, including Secrets, RBAC rules, and workload specs, ultimately lives there. A backup strategy that only snapshots the filesystem is weaker than an etcd snapshot taken through the supported API, because it can capture an inconsistent state.

Take a snapshot from a control plane node with `etcdctl snapshot save`, using the same certificates and endpoint the API server uses. Store the snapshot off the node. Verify it with `snapshot status`; an untested backup is only a hope. Record the Kubernetes version and encryption configuration with the snapshot because restore compatibility depends on them.

Restoring is a controlled outage. Stop the API server and kubelet where required, restore to a new data directory, point etcd at that directory, and restart components one at a time. Never restore over a running production datastore without a rollback plan.

Failure modes include expired client certificates, a wrong endpoint, a snapshot from a different cluster, and a restored datastore that is healthy but older than expected. Verification means checking the etcd Pod, API health, and a known object after restore. 