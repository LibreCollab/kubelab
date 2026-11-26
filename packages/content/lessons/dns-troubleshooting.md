Service DNS has several independent failure points. CoreDNS must be running, the Service must exist, the client must use the cluster DNS configuration, and the Service must have ready endpoints for traffic to succeed. A successful name lookup therefore does not prove the application works.

Start with CoreDNS Pods in `kube-system`, then inspect the Service and its Endpoints. If the name resolves but the request fails, the problem is likely selectors, readiness, ports, or policy. If the name does not resolve, inspect CoreDNS, the Pod DNS policy, and the search path.

Use `kubectl exec` from a client Pod to test resolution with `nslookup` or `getent hosts`. Read the exact name returned. Short names resolve through the namespace search path. Cross-namespace names need `service.namespace` or the full cluster name.

Failure modes include a Service selector that matches no Pods, readiness probes removing every endpoint, CoreDNS unavailable, and a NetworkPolicy blocking DNS. Verification: resolve the name, inspect endpoints, then test the actual request from the same client. 