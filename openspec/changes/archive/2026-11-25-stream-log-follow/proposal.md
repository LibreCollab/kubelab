# Proposal

## Why

`kubectl logs -f` currently behaves like a one-shot snapshot. Following logs is a
core troubleshooting workflow, and the terminal already owns Ctrl+C handling.
This change makes follow mode visibly incremental without adding a real cluster.

## What Changes

- Add a simulator log-follow subscription that emits existing lines and then new
  lines as Pod logs change.
- Teach the terminal to enter follow mode for `kubectl logs -f`.
- Stop follow mode on Ctrl+C or terminal unmount.
- Keep non-follow logs and invalid Pod/container errors unchanged.
- Wire follow mode into lesson terminals and lab-exam terminals.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `lesson-player`: terminal follow behavior and Ctrl+C cancellation.
- `cluster-simulator`: incremental log subscription.

## Impact

- `packages/sim` engine API and unit tests.
- `apps/web` Terminal, lesson player, and lab exam.
- No new dependencies or routes.
