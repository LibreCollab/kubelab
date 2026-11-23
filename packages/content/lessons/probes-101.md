Liveness restarts stuck containers; readiness removes Pods from Service endpoints; startup delays other probes.

- Readiness failure does not restart the container.
- Liveness failure does.
- Tune thresholds to avoid restart storms.
