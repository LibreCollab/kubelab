# Tasks

## 1. Model and schema

- [x] 1.1 Add DaemonSet, StatefulSet, Job, and CronJob types/status.
- [x] 1.2 Add init-container fields to Pods and PodTemplates.
- [x] 1.3 Accept the new kinds in scenario validation and apply/seed defaults.

## 2. Controllers

- [x] 2.1 Add DaemonSet per-node reconciliation and node removal.
- [x] 2.2 Add StatefulSet ordinal reconciliation and scale down.
- [x] 2.3 Add Job Pod creation, completion, and status.
- [x] 2.4 Add CronJob schedule conversion and Job creation.
- [x] 2.5 Add init-container startup gating.
- [x] 2.6 Add deletion for new workload kinds.

## 3. Commands and tests

- [x] 3.1 Add get/list output and YAML/describe support for new kinds.
- [x] 3.2 Add tests for all controllers and init sequencing.
- [x] 3.3 Run `pnpm check`, Playwright, and the production build.

## 4. Specs

- [x] 4.1 Validate the change in strict mode.
- [x] 4.2 Archive the change and validate all specs.
