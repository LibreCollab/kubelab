# Proposal

## Why

The cluster dialog focus effect depended on an inline parent callback. Live
engine ticks recreated that callback and repeatedly moved focus back to the close
button.

## What Changes

- Keep the close callback in a ref.
- Key the focus effect only to dialog open state.
- Extend the E2E focus test to wait across an engine tick.

## Impact

- Cluster map focus management and E2E coverage.
