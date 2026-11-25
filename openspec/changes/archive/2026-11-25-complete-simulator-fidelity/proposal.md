# Proposal

## Why

The simulator still has explicit fidelity gaps across networking, security,
health checks, observability, autoscaling, and the toolchain controllers. These
gaps block realistic CKA/CKAD/CKS troubleshooting.

## What Changes

- Simulate TLS Ingress termination and HTTPS routing.
- Project ServiceAccount token files into `exec` commands.
- Enforce namespace Pod Security admission levels.
- Add startup and gRPC probes.
- Expire old Events from `kubectl get events`.
- Add external HPA metrics and scale-down stabilization.
- Execute simple Kustomize resource/patch rendering.
- Add Helm install/upgrade/rollback and manifest application.
- Detect Argo CD drift and apply manifests on sync.
- Give the Widget operator observable child resources and status.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cluster-simulator`: completes the remaining documented simulator fidelity gaps.

## Impact

- `packages/sim` types, controllers, command behavior, tests, and docs.
- No routes or new dependencies.
