# Tasks

## 1. Networking

- [x] 1.1 Enforce NetworkPolicy ingress/egress ports.
- [x] 1.2 Resolve headless Services to ready Pod IPs.
- [x] 1.3 Allocate and render NodePorts.

## 2. Storage

- [x] 2.1 Delete PVCs and apply Delete/Retain reclaim behavior.
- [x] 2.2 Allow PV deletion.
- [x] 2.3 Delay dynamic provisioning for WaitForFirstConsumer.

## 3. RBAC

- [x] 3.1 Seed ClusterRoles and ClusterRoleBindings as cluster-scoped objects.
- [x] 3.2 List, describe, and YAML-render cluster-scoped RBAC.
- [x] 3.3 Authorize through ClusterRoleBindings.

## 4. Verification

- [x] 4.1 Add unit tests for ports, headless DNS, NodePorts, reclaim, delayed binding, and RBAC.
- [x] 4.2 Run `pnpm check`, Playwright, and the production build.
- [x] 4.3 Validate and archive the OpenSpec change.
