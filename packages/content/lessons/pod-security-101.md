Pod Security Standards classify namespaces as privileged, baseline, or restricted.

- Use non-root users and read-only root filesystems.
- Drop Linux capabilities you do not need.
- Seccomp/AppArmor reduce the runtime attack surface.

```bash
kubectl describe namespace secure
kubectl get pod web -n secure
kubectl describe pod web -n secure
```

**Failure modes.** Pod Security failures occur at admission or runtime. A restricted namespace rejects privileged settings, root users, or missing seccomp profiles. A Pod can also run but still expose unnecessary capabilities.

**Verify.** Verify the namespace labels, the Pod security context, container security context, and events. Confirm the allowed user, privilege escalation, capabilities, and seccomp profile. Test with a Pod that should be rejected and one that should be accepted. Policy is working when both outcomes match expectations.

**Evidence to capture.** Test one Pod that should be admitted and one that should be rejected; a single successful Pod does not prove the namespace policy.
