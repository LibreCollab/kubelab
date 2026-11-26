# Proposal

## Why

The API root `/api` fell through to the SPA, and the cluster change scene's
full-map button missed contrast during its animation.

## What Changes

- Return JSON 404 for the exact API root.
- Raise the scene button to primary text contrast.
- Add Go and browser regression coverage.

## Impact

- API router, cluster scene styling, tests, audit docs.
