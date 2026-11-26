# Proposal

## Why

The cluster-state overlay had dialog semantics but did not manage keyboard focus.

## What Changes

- Focus the dialog after opening.
- Trap Tab within the dialog.
- Return focus to the status trigger when closed.

## Impact

- Cluster map component and E2E focus coverage.
