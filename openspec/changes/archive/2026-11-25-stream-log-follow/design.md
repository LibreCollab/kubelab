# Design

## Context

See `proposal.md`. The simulator stores Pod logs and already ticks a virtual
clock. The terminal handles input and Ctrl+C but has no long-running command
state.

## Goals / Non-Goals

- Stream existing and appended Pod logs incrementally.
- Cancel cleanly on Ctrl+C or unmount.
- Reuse one-shot log validation and error messages.
- Avoid changing non-follow commands.

**Non-Goals:**

- Real container stdout, timestamps, prefixes, or previous-container logs.
- Multiple Pods, selectors, or `--tail`.
- Persisting follow state across sessions.

## Decisions

### Engine subscription, not polling from the terminal

`SimEngine.followLogs` validates the command, emits existing lines, and subscribes
to clock ticks. It keeps a cursor and emits only new lines. The returned stop
function unsubscribes.

### Terminal owns follow mode

The terminal checks for a follow subscription before executing a command. While
active, it appends lines and ignores editing input except Ctrl+C. Stopping writes
`^C` and restores the prompt.

### Invalid targets fall back to the normal path

If follow validation fails, `followLogs` returns undefined. The terminal then
runs the command normally, preserving existing missing-Pod and multi-container
errors.

## Risks / Trade-offs

- **Static lessons rarely append logs** → Existing lines still stream and the unit
  test appends logs through the store.
- **Follow blocks terminal editing** → Explicit Ctrl+C behavior keeps it
  predictable.
- **No timestamps** → Outside this slice; document rather than fake.
