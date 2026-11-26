Requests and limits answer different questions. Requests tell the scheduler how much CPU and memory a container needs, so they determine whether a Pod fits on a node. Limits tell the runtime the maximum the container may consume. CPU limits cause throttling; memory limits can cause OOM kills.

Set requests from observed usage, not from a guess. A Pod with no requests can be packed onto an overloaded node. A request that is too high leaves the Pod Pending even when the cluster has spare capacity. Limits protect neighbours but can hurt latency if they are too tight.

Quality of service follows from these settings. Requests equal to limits for every resource gives Guaranteed. Requests without matching limits gives Burstable. No requests or limits gives BestEffort, which is the first to be evicted under pressure.

Failure modes include treating limits as scheduling guarantees, ignoring memory spikes, and copying production values without measuring. Verification: read the Deployment resources, inspect Pod events, and compare usage with `kubectl top` where metrics exist. 