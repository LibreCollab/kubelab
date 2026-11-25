# Design

- Keep `tasks` as the selected run snapshot and add `taskPool`/`taskCount` for selection.
- Sort the pool by a deterministic track/run hash, then slice the configured count.
- Keep CKA/CKAD/CKS at five tasks/75 minutes; KCNA/KCSA stay at three/45 minutes.
- Pass labs at the existing 70% track score instead of requiring every task.
- Rotate knowledge questions by hashing track + question id.
- Aggregate failed lab-task units into a practice-page domain summary.
- Reuse lesson scenarios while allowing task-specific instruction and check override support.
