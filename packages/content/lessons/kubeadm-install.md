kubeadm packages the control plane bootstrap steps so a cluster can be created consistently. On the first control plane node, `kubeadm init` writes certificates, starts static control plane Pods, creates the cluster CA, and produces a kubeconfig for administrators. Worker nodes join with `kubeadm join` using a bootstrap token and the API server endpoint.

The practical skill is not memorising one command. It is knowing what must exist before the command works: a compatible container runtime, swap disabled or accounted for, unique hostnames and IPs, open control plane ports, and a stable time source. After bootstrap, verify Nodes, control plane Pods, CoreDNS, and API access before joining workers.

Failure modes are usually visible early. A node that never joins has a token, firewall, or runtime problem. A control plane Pod that restarts points at certificates, host networking, or resource pressure. An upgrade that stalls often reflects a skipped minor version or a component that was not drained correctly.

Verification: inspect `kubectl get nodes`, `kubectl get pods -n kube-system`, and the kubeconfig context. Confirm the API responds before debugging workloads. 