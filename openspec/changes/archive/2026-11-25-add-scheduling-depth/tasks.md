# Tasks

## 1. Placement

- [x] 1.1 Add node affinity match expressions.
- [x] 1.2 Add required Pod affinity and anti-affinity.
- [x] 1.3 Add required topology-spread filtering.
- [x] 1.4 Propagate scheduling fields from PodTemplates into generated Pods.

## 2. Namespace governance

- [x] 2.1 Apply LimitRange default requests.
- [x] 2.2 Enforce ResourceQuota Pod/CPU/memory limits.
- [x] 2.3 Reconcile PDB healthy/disruption status.

## 3. Commands and tests

- [x] 3.1 Add get/YAML/describe support for ResourceQuota, LimitRange, and PDB.
- [x] 3.2 Add unit tests for affinity, anti-affinity, defaults, quota, and PDB.
- [x] 3.3 Run `pnpm check`, Playwright, and the production build.

## 4. Specs

- [x] 4.1 Validate the change in strict mode.
- [x] 4.2 Archive the change and validate all specs.
