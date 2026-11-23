Pod Security Standards classify namespaces as privileged, baseline, or restricted.

- Use non-root users and read-only root filesystems.
- Drop Linux capabilities you do not need.
- Seccomp/AppArmor reduce the runtime attack surface.
