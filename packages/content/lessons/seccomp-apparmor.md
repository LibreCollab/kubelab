Seccomp and AppArmor reduce what a compromised container can do. Seccomp filters system calls. `RuntimeDefault` applies the container runtime's default profile and is a reasonable baseline. A custom profile can be stricter, but it must be tested against the application. AppArmor applies mandatory access controls to files, capabilities, and network operations through a loaded profile.

Seccomp is configured in `securityContext.seccompProfile`. AppArmor has historically used Pod annotations, while newer Kubernetes versions support security context fields. The effective profile depends on the runtime and node support.

Failure modes include setting a profile that the node does not load, blocking a syscall the application needs, and assuming a profile applies to every container when it is set only at Pod level or on one container. Restricted Pod Security also requires non-root execution, no privilege escalation, and dropped capabilities.

Verification: inspect the Pod security context and annotations, confirm the node runtime accepted the profile, and test the application path that needs the relevant syscalls. 