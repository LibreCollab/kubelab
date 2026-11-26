TLS Ingress terminates HTTPS at the ingress controller. The TLS section binds
host names to a certificate Secret.

- HTTP and HTTPS can share host/path routing.
- A host missing from TLS fails the HTTPS handshake in the simulator.
- The backend Service and endpoints are unchanged.

```bash
kubectl get ingress shop
kubectl exec client -- curl https://shop.example.com
```

**Failure modes.** TLS Ingress adds certificate and hostname failures. A Secret in the wrong namespace, a missing key, an expired certificate, or a hostname mismatch breaks HTTPS while HTTP may still work. The TLS Secret must contain the expected certificate chain.

**Verify.** Verify the Ingress TLS hosts, the Secret name and namespace, and the backend Service. Test with the actual hostname, not localhost. Check certificate validity and the client error. TLS termination is healthy only when the request reaches the intended backend over the expected host.

**Evidence to capture.** Record the TLS host, Secret namespace, certificate subject, and backend response; HTTPS failures often have two independent causes.
