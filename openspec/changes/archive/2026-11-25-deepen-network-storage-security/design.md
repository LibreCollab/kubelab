# Design

## Context

See `proposal.md`. The engine already models NetworkPolicy peers, Service
endpoints, PV/PVC binding, and RBAC bindings. Missing pieces are policy ports,
headless discovery, node-port allocation, reclaim/delete behavior, delayed
binding, and cluster-scoped object visibility.

## Goals / Non-Goals

**Goals:**

- Add observable behavior using the existing command paths.
- Preserve current lesson scenarios and defaults.
- Keep cluster state serializable and deterministic.
- Add unit coverage for each new relationship.

**Non-Goals:**

- Real kube-proxy, CNI packet filtering, or node-port routing.
- Named ports, EndpointSlices, or multi-port NetworkPolicy edge cases.
- Volume expansion, snapshots, or per-node volume topology.
- Full role aggregation or service-account token projection.

## Decisions

### Match ports at the Service boundary

The executable HTTP checks pass the requested Service/Ingress port into policy
evaluation. Policy `ports` entries compare against that number. Omitting `ports`
allows all ports; an empty list denies all. This is a teaching simplification,
not a packet-level CNI implementation.

### Resolve headless services from ready Pods

A Service with `clusterIP: None` resolves through its ready selector matches.
`getent` and `nslookup` return one address per Pod. This reuses the same endpoint
selection as Services and Ingress.

### Assign NodePorts deterministically

NodePort Services receive sequential ports starting at 30001 and render them as
`port:nodePort/targetPort`. This is enough to teach the object relationship
without simulating node routing.

### Reclaim volumes on PVC deletion

Deleting a PVC releases or deletes its bound PV using the PV reclaim policy, then
the StorageClass policy, then `Retain`. `WaitForFirstConsumer` delays dynamic
provisioning until a Pod references the claim. This keeps existing immediate
provisioning unchanged.

### Treat cluster-scoped RBAC as another object store

ClusterRoles and ClusterRoleBindings use the existing object store with an empty
namespace. `get`, `describe`, YAML output, and authorization share the same
records. No separate authorizer is introduced.

## Risks / Trade-offs

- **Policy ports use Service port, not target port** → Document the simplification
  and use the requested port in tests.
- **Headless DNS omits SRV records** → Keep A/AAAA-style lookup only and state the
  limit.
- **NodePorts do not route** → Render allocation only; real node traffic remains
  out of scope.
- **Reclaim policy precedence is simplified** → Prefer PV, then StorageClass,
  then Retain; test both Delete and Retain.
- **ClusterRole list output is minimal** → Reuse the existing simple list output
  rather than inventing a new table.
