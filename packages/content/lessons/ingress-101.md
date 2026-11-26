Ingress describes HTTP(S) routing by host and path. An Ingress controller (Envoy, nginx, Traefik) implements the routing.

- Ingress is a spec; the controller does the work.
- TLS certificates are referenced from Secrets.
- Use Gateway API for newer multi-protocol routing.

```bash
kubectl create deployment web --image=nginx --replicas=2 -n demo
kubectl expose deployment web --port=80 -n demo
kubectl create ingress web --rule=shop.example.com/=web:80 -n demo
kubectl run client --image=busybox -n demo
kubectl exec client -n demo -- curl -H "Host: shop.example.com" http://shop.example.com/
```

**Failure modes.** Ingress failures sit between routing and the backend. A missing controller, wrong class, bad host, path mismatch, or Service without endpoints can all return errors. The Ingress object can look correct while no controller is watching it.

**Verify.** Verify the Ingress class, host, path, backend Service, and Service port. Confirm the controller is running and the backend has ready endpoints. Test with the correct Host header and protocol. A successful routing test must reach a real Pod, not just return an Ingress object.
