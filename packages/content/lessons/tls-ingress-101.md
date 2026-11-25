TLS Ingress terminates HTTPS at the ingress controller. The TLS section binds
host names to a certificate Secret.

- HTTP and HTTPS can share host/path routing.
- A host missing from TLS fails the HTTPS handshake in the simulator.
- The backend Service and endpoints are unchanged.

```bash
kubectl get ingress shop
kubectl exec client -- curl https://shop.example.com
```
