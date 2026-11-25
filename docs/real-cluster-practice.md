# Real-cluster practice bridge

Kubelab is a simulator, not a replacement for a real cluster. Use a disposable local
cluster when you need to verify behavior that the simulator simplifies.

## Recommended setup

Install kind or k3d, then create a dedicated practice cluster.

```bash
brew install kind kubectl
kind create cluster --name kubelab-practice
kubectl config use-context kind-kubelab-practice
kubectl get nodes
```

Or use k3d:

```bash
brew install k3d
k3d cluster create kubelab-practice
kubectl config use-context k3d-kubelab-practice
kubectl get nodes
```

## Drills

Work through the same outcomes as the simulator, but verify with real controllers:

1. Deploy an app, scale it, roll it out, and roll it back.
2. Break a readiness probe, watch endpoints disappear, then fix it.
3. Break a Service selector, confirm the empty EndpointSlice, then repair it.
4. Apply a default-deny NetworkPolicy and test allowed and denied traffic.
5. Create a PVC, bind it, write data from a Pod, delete and recreate the Pod.
6. Create a restricted namespace and try to run a non-compliant Pod.
7. Install a Helm chart, upgrade values, and roll back.
8. Apply a Kustomize overlay and compare the rendered output.
9. Create a job and inspect completions and logs.
10. Troubleshoot a CrashLoopBackOff with events, logs, and describe.

## Verification habits

- Always read `kubectl get`, `describe`, events, and logs before editing.
- Prefer `kubectl apply` with the intended manifest over repeated imperative fixes.
- Inspect EndpointSlices, not just Services.
- Confirm readiness in `get pods` and `get endpoints`.
- Check the controller status after every rollout or scale event.
- Record the exact command that proves the fix.

## Cleanup

```bash
kind delete cluster --name kubelab-practice
k3d cluster delete kubelab-practice
```

The public Kubelab preview has no cluster credentials and never talks to your local
cluster. Real-cluster practice is opt-in and runs entirely on your machine.
