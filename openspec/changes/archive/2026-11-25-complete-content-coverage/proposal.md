# Proposal

## Why

The simulator supports Jobs, StatefulSets, DaemonSets, init containers, PDBs,
quotas, affinity, TLS Ingress, and cluster RBAC, but the curriculum does not.
`containers-101` is also the last quiz-only core lesson.

## What Changes

- Convert containers-101 to a terminal lesson.
- Add nine lessons covering the new simulator features.
- Give every new lesson objectives, hints, a solution, checks, and prerequisites.
- Validate sequencing and content schemas across the expanded curriculum.
- Update curriculum counts and docs.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `learning-path`: expanded lesson coverage and interactive core lessons.

## Impact

- `packages/content/lessons` YAML/Markdown.
- Content schema kind allowlist.
- Docs and validation.
