# Certification objective coverage

Last reviewed: 2026-11-25. Weights come from the published CNCF candidate handbooks available at this date and should be rechecked when a guide changes.

The machine-readable source is `packages/content/src/certification-roadmaps.ts`.

## KCNA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Kubernetes fundamentals | 44% | 8 | 0 |
| Container orchestration | 28% | 8 | 0 |
| Cloud native application delivery | 16% | 7 | 0 |
| Cloud native architecture | 12% | 5 | 0 |

## KCSA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cloud native security overview | 14% | 4 | 0 |
| Cluster component security | 22% | 5 | 0 |
| Kubernetes security fundamentals | 22% | 6 | 0 |
| Kubernetes threat model | 16% | 5 | 0 |
| Platform security | 16% | 7 | 0 |
| Compliance and security frameworks | 10% | 5 | 0 |

## CKA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cluster architecture, installation and configuration | 25% | 7 | 4 |
| Workloads and scheduling | 15% | 13 | 10 |
| Services and networking | 20% | 7 | 6 |
| Storage | 10% | 3 | 3 |
| Troubleshooting | 30% | 8 | 5 |

## CKAD

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Application design and build | 20% | 6 | 9 |
| Application deployment | 20% | 6 | 8 |
| Application observability and maintenance | 15% | 5 | 3 |
| Application environment, configuration and security | 25% | 6 | 7 |
| Services and networking | 20% | 6 | 4 |

## CKS

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cluster setup | 10% | 5 | 1 |
| Cluster hardening | 15% | 4 | 8 |
| System hardening | 15% | 5 | 10 |
| Minimize microservice vulnerabilities | 20% | 3 | 5 |
| Supply chain security | 20% | 5 | 4 |
| Monitoring, logging and runtime security | 20% | 4 | 5 |

## Known gaps

- KCNA: the ecosystem and delivery domains can still gain deeper scenario practice.
- KCSA: compliance and threat-model exercises remain lighter than Kubernetes security.
- CKA: add more long-form multi-resource troubleshooting scenarios.
- CKAD: add larger multi-service application builds.
- CKS: add image signing, policy engines, and deeper runtime detection labs.

## Review rules

- Every certification domain must map to at least one lesson or task.
- Domain weights must sum to 100 per track.
- Lesson and task references must resolve to known content.
- Hands-on exam pools must contain only tasks from that certification.
- Knowledge banks must have 100 questions and balanced answer positions.
- Teaching lessons must stay between 150 and 250 words.
- A domain with no exam evidence is shown as weak in the readiness dashboard.

The curriculum currently has 59 lessons, including 54 teaching lessons and 5 certification readiness checks.
