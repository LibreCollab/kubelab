# Proposal

## Why

A content and runtime audit found three prose hints that looked executable,
an HPA status crash, and lab suggestions that did not follow rotated exams.

## What Changes

- Rewrite the non-executable hints and require all documented commands to succeed.
- Initialize and guard HPA status on apply and read.
- Derive exam lab suggestions from the current rotated question set.

## Impact

- Lesson hints, completability tests, simulator HPA handling, exam intro UI.
