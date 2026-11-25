# Spec Delta

## ADDED Requirements

### Requirement: NetworkPolicy port rules
The simulator SHALL enforce ingress and egress `ports` entries when a policy rule provides them.

#### Scenario: Matching port allows traffic
- **WHEN** a policy rule permits the peer and includes the requested destination port
- **THEN** the simulated request is allowed

#### Scenario: Missing port denies traffic
- **WHEN** a policy rule permits the peer but lists only a different port
- **THEN** the simulated request is denied with a policy error

#### Scenario: Omitted ports allow the peer
- **WHEN** a policy rule permits the peer without a `ports` field
- **THEN** all ports from that peer are allowed

### Requirement: Headless and NodePort services
The simulator SHALL support headless Service discovery and visible NodePort allocation.

#### Scenario: Headless DNS returns Pods
- **WHEN** a Service has `clusterIP: None` and ready selected Pods
- **THEN** DNS lookup returns the ready Pod IPs instead of a ClusterIP

#### Scenario: NodePort is rendered
- **WHEN** a Service of type NodePort is created
- **THEN** its allocated node port appears in Service output

### Requirement: Volume lifecycle
PersistentVolumeClaims SHALL support deletion with reclaim behavior, and dynamic provisioning SHALL honor `WaitForFirstConsumer`.

#### Scenario: Delete policy removes the volume
- **WHEN** a bound PVC is deleted and its PV uses the Delete reclaim policy
- **THEN** the PV is also deleted

#### Scenario: Retain policy releases the volume
- **WHEN** a bound PVC is deleted and its PV uses the Retain reclaim policy
- **THEN** the PV remains with a Released phase

#### Scenario: Delayed binding waits for a consumer
- **WHEN** a PVC uses a `WaitForFirstConsumer` StorageClass and no Pod references it
- **THEN** the claim stays Pending

#### Scenario: Consumer triggers provisioning
- **WHEN** a Pod references a Pending claim using `WaitForFirstConsumer`
- **THEN** the claim is provisioned and bound

### Requirement: Cluster-scoped RBAC
The simulator SHALL expose and authorize ClusterRoles and ClusterRoleBindings.

#### Scenario: ClusterRole is listable
- **WHEN** a learner lists cluster roles or bindings
- **THEN** the seeded cluster-scoped objects appear

#### Scenario: ClusterRoleBinding grants access
- **WHEN** a ServiceAccount is bound to a ClusterRole that permits the requested verb and resource
- **THEN** `kubectl auth can-i` reports yes

#### Scenario: Unbound subject is denied
- **WHEN** no binding grants the requested verb and resource
- **THEN** authorization reports no
