Threat modeling asks what is valuable, who can reach it, and where trust changes. For Kubernetes, assets include the API server, etcd, credentials, images, and tenant data. Actors include users, workloads, nodes, and external services. Trust boundaries include the API, the kubelet, the network, and the image registry.

Compliance frameworks turn some of those risks into controls and evidence. RBAC least privilege, Pod Security, audit logs, encryption, vulnerability management, and backup testing are common requirements. A control is only useful when evidence can be produced repeatedly.

Failure modes include treating a framework checklist as a threat model, granting cluster-wide permissions for convenience, and collecting audit logs without reviewing them. A control that cannot be verified is not a control.

Verification: identify one asset, one actor, and one boundary. Then name the preventive control, the detection signal, and the evidence that proves both are working. In the lesson, inspect the ClusterRole and binding, then test access as the ServiceAccount. 