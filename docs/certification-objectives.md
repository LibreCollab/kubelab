# Certification objective coverage

Last reviewed: 2026-11-25. Weights come from the published CNCF candidate handbooks available at this date and should be rechecked when a guide changes.

The machine-readable source is `packages/content/src/certification-roadmaps.ts`.

## KCNA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Kubernetes fundamentals | 44% | 8 | 0 |
| Container orchestration | 28% | 8 | 0 |
| Cloud native application delivery | 16% | 7 | 0 |
| Cloud native architecture | 12% | 4 | 0 |

## KCSA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cloud native security overview | 14% | 3 | 0 |
| Cluster component security | 22% | 3 | 0 |
| Kubernetes security fundamentals | 22% | 4 | 0 |
| Kubernetes threat model | 16% | 3 | 0 |
| Platform security | 16% | 4 | 0 |
| Compliance and security frameworks | 10% | 3 | 0 |

## CKA

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cluster architecture, installation and configuration | 25% | 4 | 2 |
| Workloads and scheduling | 15% | 11 | 4 |
| Services and networking | 20% | 6 | 5 |
| Storage | 10% | 2 | 3 |
| Troubleshooting | 30% | 4 | 5 |

## CKAD

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Application design and build | 20% | 4 | 6 |
| Application deployment | 20% | 4 | 5 |
| Application observability and maintenance | 15% | 3 | 2 |
| Application environment, configuration and security | 25% | 4 | 5 |
| Services and networking | 20% | 5 | 3 |

## CKS

| Domain | Weight | Lessons | Tasks |
| --- | ---: | ---: | ---: |
| Cluster setup | 10% | 4 | 1 |
| Cluster hardening | 15% | 3 | 5 |
| System hardening | 15% | 3 | 6 |
| Minimize microservice vulnerabilities | 20% | 3 | 4 |
| Supply chain security | 20% | 4 | 3 |
| Monitoring, logging and runtime security | 20% | 3 | 4 |

## Known gaps

- KCNA: cloud-native ecosystem and delivery can go deeper.
- KCSA: compliance and threat-model exercises are still lighter than Kubernetes security.
- CKA: add more long-form troubleshooting scenarios beyond single incidents.
- CKAD: add larger multi-service application builds.
- CKS: add image signing, policy engines, and deeper runtime detection labs.

## Review rules

- Every certification domain must map to at least one lesson or task.
- Domain weights must sum to 100 per track.
- Lesson and task references must resolve to known content.
- Hands-on exam pools must contain only tasks from that certification.
- A domain with no exam evidence is shown as weak in the readiness dashboard.
