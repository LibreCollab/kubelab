# Tasks

## 1. Domain data

- [x] 1.1 Add certification domain definitions for all five tracks.
- [x] 1.2 Verify current CNCF domain weights and document their source date.
- [x] 1.3 Map lessons, task IDs, and question units to each domain.
- [x] 1.4 Validate weights sum to 100 and mappings reference known content.

## 2. Readiness engine

- [x] 2.1 Implement domain coverage and recent-evidence scoring.
- [x] 2.2 Implement weighted readiness, bands, weak/strong labels, and trend.
- [x] 2.3 Keep zero-evidence tracks below Ready.
- [x] 2.4 Add unit tests for coverage, evidence, weights, bands, and no-data states.

## 3. Persistence

- [x] 3.1 Add Dexie version 4 readiness snapshots.
- [x] 3.2 Save at most one readiness snapshot per track per day.
- [x] 3.3 Add snapshot and reset tests.

## 4. Dashboard

- [x] 4.1 Add `/certification/$trackId` dashboard route.
- [x] 4.2 Add header, readiness card, next action, domain grid, evidence, and history.
- [x] 4.3 Link only supported exam modes.
- [x] 4.4 Add roadmap certification-card entry point.
- [x] 4.5 Add responsive and accessibility coverage.

## 5. Verification and docs

- [x] 5.1 Add Playwright coverage for knowledge and hands-on dashboards.
- [x] 5.2 Run `pnpm check`, axe, Lighthouse, and build.
- [x] 5.3 Update architecture/README and correct stale certification exam-count wording.
- [x] 5.4 Validate OpenSpec, archive, and push.
