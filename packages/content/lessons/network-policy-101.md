NetworkPolicy selects Pods and declares allowed ingress/egress. Enforcement depends on the CNI.

- Policies are additive allow rules.
- A Pod selected by any policy becomes default-deny for that direction.
- Label selectors connect policies to workloads.

```bash
kubectl get networkpolicy
kubectl describe networkpolicy deny-all
kubectl get pods --show-labels
```

**Failure modes.** NetworkPolicy failures can be caused by an empty selector, a missing policy type, a wrong namespace selector, or a port mismatch. Policies are additive for allowed traffic, but the first policy that selects a Pod can change the default posture. A denied request may look like a timeout.

**Verify.** Verify the policy selector, policy types, peers, ports, and the target Pod labels. Test from the actual client namespace and read the connection result. Confirm DNS and the Service path independently. A policy is correct only when the intended traffic works and unwanted traffic fails.

**Evidence to capture.** Test from the real client Namespace and record both the allowed and denied requests; one successful path does not prove the policy is right.
