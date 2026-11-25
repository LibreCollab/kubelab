# Proposal

## Why

The simulator covers the main networking, storage, and RBAC command surface but
stops short of several relationships learners must reason about: policy ports,
headless discovery, node ports, claim deletion/reclaim, delayed binding, and
cluster-scoped permissions.

## What Changes

- Enforce NetworkPolicy `ports` entries for ingress and egress decisions.
- Resolve headless Services to selected Pod IPs instead of a single ClusterIP.
- Assign NodePorts and render them in Service output.
- Delete PVCs, release or delete their bound PVs according to reclaim policy, and
  allow PV deletion.
- Honor `WaitForFirstConsumer` by delaying dynamic provisioning until a Pod uses
  the claim.
- List, describe, and authorize against ClusterRoles and ClusterRoleBindings.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: adds policy port matching, headless/NodePort service
  behavior, volume reclaim/binding timing, and cluster-scoped RBAC visibility.

## Impact

- `packages/sim` types, networking/storage/RBAC behavior, and unit tests.
- Documentation updates only; no new routes or dependencies.
