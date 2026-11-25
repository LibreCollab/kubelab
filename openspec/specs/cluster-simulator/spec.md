# cluster-simulator Specification

## Purpose

Provide a deterministic, browser-local Kubernetes practice environment whose command output, cluster state, lesson checks, and animations stay consistent.

## Requirements

### Requirement: Local deterministic engine
The simulator SHALL run entirely in the browser, advance through a virtual clock, and produce repeatable command and reconciliation results without a real cluster.

#### Scenario: No external cluster is required
- **WHEN** a learner runs a supported command
- **THEN** the response comes from in-memory state without contacting a Kubernetes API

#### Scenario: Reconciliation is clock-driven
- **WHEN** the virtual clock advances
- **THEN** controllers reconcile pending resources and emit observable state changes

### Requirement: Workload lifecycle
The simulator SHALL create and reconcile Pods, Deployments, ReplicaSets, scaling, image updates, rollbacks, and rolling-update strategies.

#### Scenario: Deployment creates replicas
- **WHEN** a Deployment is created with a replica count
- **THEN** matching ReplicaSets and Pods are reconciled toward that count

#### Scenario: Rollout respects strategy
- **WHEN** a Deployment template changes under a rolling or recreate strategy
- **THEN** old and new ReplicaSets are adjusted according to `maxSurge` and `maxUnavailable`

#### Scenario: HPA changes desired replicas
- **WHEN** an HPA targets a Deployment with a desired replica count
- **THEN** the Deployment is reconciled within the HPA minimum and maximum

### Requirement: Networking behavior
The simulator SHALL model Services, Endpoints, cluster DNS, Ingress routing, and NetworkPolicy admission for supported traffic checks.

#### Scenario: Service selects ready Pods
- **WHEN** a Service selector matches ready Pods
- **THEN** its endpoints include those Pod IPs and DNS resolves the Service address

#### Scenario: Readiness removes endpoints
- **WHEN** a selected Pod is not Ready
- **THEN** it is excluded from the Service endpoints

#### Scenario: NetworkPolicy denies traffic
- **WHEN** an ingress or egress policy selects the source or destination and no rule permits the peer
- **THEN** the simulated request is denied with a policy error

#### Scenario: Ingress routes by host and path
- **WHEN** a request matches an Ingress rule and its backend Service has ready endpoints
- **THEN** the response identifies the Service and backend Pod

### Requirement: Configuration and storage
The simulator SHALL support ConfigMaps, Secrets, environment injection, PV/PVC binding, StorageClasses, and dynamic volume provisioning.

#### Scenario: ConfigMap and Secret values reach containers
- **WHEN** a Deployment injects configuration from a ConfigMap or Secret
- **THEN** `exec` environment reads show the resolved values

#### Scenario: Claim binds to matching volume
- **WHEN** a PVC requests storage and access modes that match an available PV
- **THEN** the PVC and PV become Bound

#### Scenario: Dynamic class provisions storage
- **WHEN** a PVC references a provisioning StorageClass without a matching PV
- **THEN** a Bound PV is created for the claim

### Requirement: Security and observability commands
The simulator SHALL support RBAC authorization checks, Pod logs, events, resource descriptions, and node placement inspection.

#### Scenario: Unauthorized subject is denied
- **WHEN** `kubectl auth can-i` is evaluated for a subject without the required permission
- **THEN** the command reports denial

#### Scenario: Logs respect container selection
- **WHEN** a learner requests logs for a missing container
- **THEN** the command reports an error instead of returning unrelated output

### Requirement: Toolchain simulations
The simulator SHALL expose Helm release inspection and mutations, Kustomize rendering, Argo CD application status and sync, and custom resource reconciliation.

#### Scenario: Helm release can be upgraded
- **WHEN** a learner upgrades a seeded Helm release
- **THEN** its revision and values history change

#### Scenario: Argo application syncs
- **WHEN** a learner syncs an Application
- **THEN** its sync and health status become healthy

### Requirement: Command surface
The simulator SHALL support `get` tables, wide and YAML output, label selectors, `top`, `describe`, `apply` from files or directories, mutations, deletes, `exec`, logs, auth checks, and toolchain commands.

#### Scenario: YAML output is readable
- **WHEN** a learner requests a supported resource with `-o yaml`
- **THEN** the output is valid YAML for the stored resource

#### Scenario: Multiple manifests apply together
- **WHEN** an apply source contains multiple documents, comma-separated files, or a directory
- **THEN** every supported manifest is applied in order

### Requirement: Fidelity limits are explicit
The simulator SHALL present intentional simplifications as teaching aids and SHALL NOT claim unsupported production Kubernetes behavior.

#### Scenario: Unsupported behavior is not implied
- **WHEN** a lesson covers HPA metrics, TLS Ingress, live log streaming, or complex Kustomize patches
- **THEN** the content labels the simplified or unavailable behavior

#### Scenario: HPA uses seeded intent
- **WHEN** an HPA has no CPU target or no usable Pod usage and requests
- **THEN** scaling follows the authored desired replica state rather than inventing a metric

#### Scenario: Logs follow is a snapshot
- **WHEN** a learner uses log-follow behavior
- **THEN** the output is a bounded snapshot rather than an indefinite stream

#### Scenario: Probes use authored responses
- **WHEN** a lesson demonstrates an HTTP probe failure
- **THEN** the scenario authors the simulated status instead of running a real application server

### Requirement: Pod usage metrics
Simulated Pods SHALL expose optional CPU and memory usage, and `kubectl top pods` SHALL prefer authored usage over synthetic estimates.

#### Scenario: Authored usage is shown
- **WHEN** a Pod has authored CPU and memory usage
- **THEN** `kubectl top pods` reports those values for the Pod

#### Scenario: Usage is optional
- **WHEN** a Pod has no authored usage
- **THEN** `kubectl top pods` still returns a deterministic estimate

### Requirement: HPA CPU metric reconciliation
An HPA with a Resource CPU utilization target SHALL derive desired replicas from average Pod CPU usage relative to container CPU requests.

#### Scenario: Utilization above target scales up
- **WHEN** the HPA target is 50%, current replicas are 2, and average utilization is 80%
- **THEN** the desired replica count becomes 4 before min/max clamping

#### Scenario: Replica bounds are respected
- **WHEN** the metric calculation produces a count outside the HPA minimum or maximum
- **THEN** the desired count is clamped to the configured bounds

#### Scenario: Demand stays stable after scaling
- **WHEN** the HPA has already scaled to satisfy the same total CPU demand
- **THEN** the next reconciliation does not keep increasing replicas

#### Scenario: Metric output shows the target
- **WHEN** a learner lists the HPA
- **THEN** the targets column shows current CPU utilization against the configured target

### Requirement: Probe-driven health
The simulator SHALL evaluate readiness and liveness probes on the virtual clock using initial delay, period, and failure threshold settings.

#### Scenario: Readiness failure does not restart
- **WHEN** a readiness probe exceeds its failure threshold
- **THEN** the Pod is marked not Ready and its container restart count stays unchanged

#### Scenario: Readiness recovery restores traffic
- **WHEN** a previously failing readiness probe succeeds
- **THEN** the Pod becomes Ready and returns to eligible Service endpoints

#### Scenario: Liveness failure restarts the container
- **WHEN** a liveness probe exceeds its failure threshold
- **THEN** the container restart count increases, the Pod becomes not Ready, and a warning event is recorded

#### Scenario: Repeated restarts enter CrashLoopBackOff
- **WHEN** liveness failures cause repeated container restarts
- **THEN** the Pod reports `CrashLoopBackOff` and retries after a bounded backoff instead of restarting every tick

#### Scenario: Initial delay is respected
- **WHEN** a probe has not reached its initial delay
- **THEN** it is not evaluated and the Pod keeps its current readiness state

### Requirement: Probe simulation input
The simulator SHALL allow scenarios to author deterministic HTTP probe status codes, while defaulting HTTP probes to success and recognizing explicit failing exec commands.

#### Scenario: Authored HTTP failure
- **WHEN** a container authors a failing HTTP status for readiness
- **THEN** its readiness probe fails on the next due evaluation

#### Scenario: Default HTTP probe succeeds
- **WHEN** an HTTP probe has no authored response status
- **THEN** the simulated endpoint returns success

#### Scenario: Failing exec probe
- **WHEN** an exec probe runs `false` or exits non-zero
- **THEN** the probe fails

### Requirement: Probe status output
The simulator SHALL expose readiness, restart counts, and CrashLoopBackOff through existing Pod commands.

#### Scenario: Restart count is visible
- **WHEN** a container has restarted
- **THEN** `kubectl get pods` shows the accumulated restart count

#### Scenario: Crash status is visible
- **WHEN** a Pod is in CrashLoopBackOff
- **THEN** `kubectl get pods` shows `CrashLoopBackOff` in the STATUS column

#### Scenario: Warning event is visible
- **WHEN** a probe crosses its failure threshold
- **THEN** `kubectl get events` includes a warning for the affected Pod

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

### Requirement: Init container sequencing
A Pod with init containers SHALL complete them before starting its application containers.

#### Scenario: Init containers delay Running
- **WHEN** a scheduled Pod has init containers that have not completed
- **THEN** the Pod remains Pending with an init progress message

#### Scenario: Init completes
- **WHEN** all init containers have completed
- **THEN** the Pod proceeds to Running on the next reconciliation

### Requirement: DaemonSet reconciliation
A DaemonSet SHALL maintain one Pod on every ready node.

#### Scenario: Pod per node
- **WHEN** a DaemonSet is seeded with two ready nodes
- **THEN** it reconciles two Pods, one assigned to each node

#### Scenario: Node count changes
- **WHEN** a ready node no longer exists
- **THEN** the DaemonSet Pod for that node is removed

### Requirement: StatefulSet reconciliation
A StatefulSet SHALL maintain the requested number of stable ordinal Pods.

#### Scenario: Ordinal Pod names
- **WHEN** a StatefulSet requests three replicas
- **THEN** it reconciles Pods named `<name>-0`, `<name>-1`, and `<name>-2`

#### Scenario: Scale down
- **WHEN** a StatefulSet replica count decreases
- **THEN** higher-ordinal Pods are removed

### Requirement: Job completion
A Job SHALL create Pods up to its completion target and report active and successful counts.

#### Scenario: Job completes
- **WHEN** Job Pods finish successfully
- **THEN** the Job reports its succeeded count and becomes complete at the target

#### Scenario: Duplicate Pods are avoided
- **WHEN** a Job already has sufficient active or succeeded Pods
- **THEN** no additional Pods are created

### Requirement: CronJob scheduling
A CronJob SHALL create a Job when its simulated schedule becomes due.

#### Scenario: Schedule fires
- **WHEN** the virtual clock reaches the next CronJob schedule
- **THEN** a Job is created from the CronJob template and the last schedule tick is updated

#### Scenario: Schedule is not yet due
- **WHEN** the clock has not reached the next schedule
- **THEN** no new Job is created

### Requirement: Workload inspection
The simulator SHALL list, describe, and render YAML for new workload kinds.

#### Scenario: List workload status
- **WHEN** a learner lists DaemonSets, StatefulSets, Jobs, or CronJobs
- **THEN** the output includes the resource and its controller status

#### Scenario: YAML output
- **WHEN** a learner requests YAML for a supported workload
- **THEN** the stored object is rendered

### Requirement: Affinity scheduling
The scheduler SHALL enforce required node affinity, Pod affinity, and Pod anti-affinity terms before placing a Pod.

#### Scenario: Node affinity selects a matching node
- **WHEN** a Pod requires a node label expression and one node matches
- **THEN** the Pod schedules only on that node

#### Scenario: Node affinity rejects all nodes
- **WHEN** no node satisfies the required expression
- **THEN** the Pod remains Pending with an unschedulable message

#### Scenario: Anti-affinity separates Pods
- **WHEN** a required anti-affinity term conflicts with a matching Pod on a node topology
- **THEN** the scheduler chooses another topology or leaves the Pod Pending

### Requirement: Topology spread
The scheduler SHALL honor required topology-spread constraints when choosing a node.

#### Scenario: Spread preserves skew
- **WHEN** placing the Pod would exceed `maxSkew` for a topology value
- **THEN** the scheduler prefers another topology value

#### Scenario: Unsatisfiable spread remains Pending
- **WHEN** no node satisfies a required spread constraint
- **THEN** the Pod remains Pending

### Requirement: LimitRange defaults
A namespace LimitRange SHALL inject default container requests when a Pod omits them.

#### Scenario: CPU and memory defaults are applied
- **WHEN** a Pending Pod's container has no resource requests and a LimitRange provides defaults
- **THEN** the Pod is updated with those requests before scheduling

### Requirement: ResourceQuota enforcement
ResourceQuota SHALL limit the number of Pods and the sum of CPU and memory requests in a namespace.

#### Scenario: Pod quota is exhausted
- **WHEN** creating another Pod would exceed the hard Pod count
- **THEN** the Pod remains Pending with a quota message

#### Scenario: CPU request exceeds quota
- **WHEN** the new Pod's CPU requests would exceed the hard CPU total
- **THEN** the Pod remains Pending with a quota message

### Requirement: PodDisruptionBudget status
A PodDisruptionBudget SHALL report current healthy Pods and allowed disruptions.

#### Scenario: Healthy Pods satisfy the budget
- **WHEN** enough selected Pods are Ready to meet the minimum
- **THEN** the PDB reports allowed disruptions

#### Scenario: Budget blocks disruption
- **WHEN** selected healthy Pods are below the minimum
- **THEN** the PDB reports zero allowed disruptions

### Requirement: Governance inspection
The simulator SHALL list, describe, and YAML-render ResourceQuotas, LimitRanges, and PDBs.

#### Scenario: Governance resources are listed
- **WHEN** a learner lists any of the new resource types
- **THEN** the output shows the object and its key status

### Requirement: Incremental log following
The simulator SHALL expose a log-follow subscription that emits current Pod logs and then newly appended lines until stopped.

#### Scenario: Existing logs are emitted
- **WHEN** a learner follows logs for a Pod with existing output
- **THEN** the subscription emits the existing lines immediately

#### Scenario: New logs are emitted
- **WHEN** the Pod's log output grows while follow is active
- **THEN** the next clock tick emits only the new lines

#### Scenario: Stop cancels updates
- **WHEN** a follow subscription is stopped
- **THEN** later Pod log changes emit nothing

#### Scenario: Invalid follow target
- **WHEN** follow is requested for a missing Pod or invalid container
- **THEN** the subscription reports the same error as a one-shot log command

### Requirement: HPA memory metrics
An HPA with a Resource memory utilization target SHALL derive replicas from average Pod memory usage relative to container memory requests.

#### Scenario: Memory above target scales up
- **WHEN** a memory target is configured and average utilization exceeds the target
- **THEN** desired replicas increase based on the utilization ratio

#### Scenario: Memory metric is reported
- **WHEN** a learner lists an HPA with a memory target
- **THEN** the targets column identifies memory and shows current/target percentages

### Requirement: HPA scaling tolerance
HPA reconciliation SHALL keep the current replica count when utilization is within ten percent of the target.

#### Scenario: Small deviation does not scale
- **WHEN** current utilization is within the tolerance band around the target
- **THEN** desired replicas remain unchanged

#### Scenario: Large deviation scales
- **WHEN** current utilization is outside the tolerance band
- **THEN** desired replicas follow the utilization ratio

### Requirement: TLS Ingress routing
HTTPS requests SHALL require a matching Ingress TLS host, while HTTP routing remains available without TLS.

#### Scenario: TLS host routes
- **WHEN** HTTPS targets a host listed in an Ingress TLS section with a healthy backend
- **THEN** the request succeeds

#### Scenario: TLS host is missing
- **WHEN** HTTPS targets an Ingress host not covered by its TLS section
- **THEN** the request fails with a TLS error

### Requirement: ServiceAccount token projection
Pods SHALL expose projected ServiceAccount token, namespace, and CA files to supported exec commands.

#### Scenario: Token file is readable
- **WHEN** a learner reads the standard ServiceAccount token path
- **THEN** a simulated token is returned

#### Scenario: Namespace file is readable
- **WHEN** a learner reads the namespace file
- **THEN** the Pod namespace is returned

### Requirement: Pod Security admission
The scheduler SHALL enforce namespace `pod-security.kubernetes.io/enforce` levels for privileged, baseline, and restricted Pods.

#### Scenario: Restricted Pod is rejected
- **WHEN** a restricted namespace receives a Pod without the required security context
- **THEN** the Pod remains Pending with a Pod Security message

#### Scenario: Privileged namespace accepts the Pod
- **WHEN** the namespace enforces privileged
- **THEN** Pod Security does not block scheduling

### Requirement: Startup and gRPC probes
The probe engine SHALL evaluate startup probes before readiness/liveness and SHALL support gRPC probe targets.

#### Scenario: Startup failure blocks other probes
- **WHEN** a startup probe is failing
- **THEN** readiness and liveness are not evaluated

#### Scenario: gRPC probe succeeds
- **WHEN** a gRPC probe has no authored failure
- **THEN** it succeeds

### Requirement: Event expiry
Events SHALL disappear from `kubectl get events` after a bounded age.

#### Scenario: Old event is hidden
- **WHEN** an Event is older than the retention window
- **THEN** it is omitted from list output

### Requirement: External HPA metrics and stabilization
HPA SHALL support external average-value metrics and SHALL delay scale-down inside a configured stabilization window.

#### Scenario: External metric scales
- **WHEN** an external metric exceeds its target
- **THEN** replicas increase from the ratio

#### Scenario: Scale-down waits
- **WHEN** scale-down is inside the stabilization window
- **THEN** current replicas remain

### Requirement: Kustomize rendering
`kubectl kustomize` SHALL render referenced resources and apply simple strategic merge patches from seeded files.

#### Scenario: Patch changes a resource
- **WHEN** a kustomization references a Deployment and a patch changes replicas or image
- **THEN** rendered YAML contains the patched values

### Requirement: Helm lifecycle and rendering
Helm install/upgrade/rollback SHALL record release history and SHALL apply seeded chart manifests.

#### Scenario: Install applies a chart
- **WHEN** a chart manifest is available in seeded files
- **THEN** install applies its resources and creates a release

#### Scenario: Rollback restores status
- **WHEN** a release is rolled back
- **THEN** its history/status reflect the rollback

### Requirement: Argo drift detection
Argo Applications SHALL report OutOfSync when seeded source content differs from the last applied content, and sync SHALL apply and mark it Synced.

#### Scenario: Drift is detected
- **WHEN** source content changes after a sync
- **THEN** the Application becomes OutOfSync

#### Scenario: Sync applies drift
- **WHEN** a learner syncs an OutOfSync Application
- **THEN** its manifests are applied and status returns to Synced

### Requirement: Operator child reconciliation
The Widget operator SHALL reconcile a child ConfigMap and report observed status.

#### Scenario: Widget creates a child
- **WHEN** a Widget exists without its managed ConfigMap
- **THEN** the operator creates the ConfigMap from the Widget spec
