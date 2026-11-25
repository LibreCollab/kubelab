# Proposal

## Why

A 60-question exam renders as one very long page. Learners need manageable
10-question pages while preserving answers and timer state.

## What Changes

- Show ten questions per page.
- Add Previous/Next page controls and page status.
- Show Submit only on the final page.
- Preserve answers across page navigation.
- Keep auto-submit on timer expiry.
- Update E2E coverage.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `certification`: paginated knowledge exam navigation.

## Impact

- Exam runner UI, styles, and tests.
