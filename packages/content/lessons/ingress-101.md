Ingress describes HTTP(S) routing by host and path. An Ingress controller (Envoy, nginx, Traefik) implements the routing.

- Ingress is a spec; the controller does the work.
- TLS certificates are referenced from Secrets.
- Use Gateway API for newer multi-protocol routing.
