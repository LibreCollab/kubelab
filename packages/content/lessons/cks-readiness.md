CKS is hands-on and assumes CKA-level Kubernetes skill. It covers cluster setup, hardening, system hardening, microservice vulnerabilities, supply chain security, and runtime monitoring. The focus is reducing attack surface and proving controls.

Prepare by practising least-privilege RBAC, Pod Security, NetworkPolicy, Secret handling, audit and encryption configuration, seccomp, AppArmor, and ServiceAccount token hygiene. Then add supply chain checks: digests, SBOMs, signing, and admission policy. Finally, investigate a runtime alert without destroying evidence.

Use the lab pool to practise the command sequence, then explain the control and the signal that proves it works. The dashboard should show evidence across every CKS domain, not only network policy.

Failure modes: treating tools as controls, hardening one layer while leaving another open, and deleting evidence during response. Verification: complete timed labs, test an allowed and a denied request, and name the evidence for each control.

Record the policy, workload, and identity tested so a passing check is not mistaken for full cluster coverage.
