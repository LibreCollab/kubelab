NetworkPolicy selects Pods and declares allowed ingress/egress. Enforcement depends on the CNI.

- Policies are additive allow rules.
- A Pod selected by any policy becomes default-deny for that direction.
- Label selectors connect policies to workloads.
