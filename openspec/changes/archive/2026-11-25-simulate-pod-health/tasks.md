# Tasks

## 1. Probe model

- [x] 1.1 Add readiness/liveness probe definitions, container status, and probe-state types.
- [x] 1.2 Add simulator-only authored HTTP probe responses.

## 2. Reconciliation

- [x] 2.1 Evaluate probes with initial delay, period, and failure threshold.
- [x] 2.2 Apply readiness failures to Pod conditions and Service endpoints without restarts.
- [x] 2.3 Restart containers on liveness failure and increment restart counts.
- [x] 2.4 Enter bounded CrashLoopBackOff after repeated restarts.
- [x] 2.5 Emit warning probe/backoff events.
- [x] 2.6 Show readiness, restarts, and CrashLoopBackOff in Pod output.

## 3. Content and tests

- [x] 3.1 Author the readiness failure in the probes lesson and update theory.
- [x] 3.2 Add tests for readiness failure/recovery, liveness restarts, CrashLoopBackOff, and events.
- [x] 3.3 Run `pnpm check`, Playwright, and the production build.

## 4. Specs

- [x] 4.1 Validate the change in strict mode.
- [x] 4.2 Archive the change and validate all specs.
