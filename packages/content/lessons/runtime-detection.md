Runtime detection looks for behavior that static configuration cannot predict. Unexpected process execution, writes to sensitive paths, reverse shells, privilege escalation attempts, and unusual outbound connections are higher-signal than a simple crash. The goal is to detect, preserve evidence, and contain without destroying the investigation.

Start with logs, events, and process context. Compare the Pod against its expected image and command. Check whether the behavior correlates with a recent deployment or a node-level event. Runtime security tools such as Falco can generate alerts, but the responder still needs to validate them.

Failure modes include deleting the Pod before collecting logs, treating every crash as malicious, and ignoring a detection because the workload eventually recovered. A noisy alert can still hide a real event.

Verification: capture logs and events, record the Pod spec and node, identify the suspicious process or connection, then isolate the workload through policy or scheduling controls while preserving evidence. 