# Spec Delta

## ADDED Requirements

### Requirement: Teaching depth
Every teaching lesson SHALL contain between 150 and 250 words.

#### Scenario: Lesson review
- **WHEN** the content depth test runs
- **THEN** every non-readiness lesson passes the word range

### Requirement: Certification coverage
The teaching set SHALL cover cluster installation, etcd recovery, certificates,
troubleshooting, multi-container design, runtime hardening, supply chain,
threat modeling, and the CNCF ecosystem.

#### Scenario: Expanded curriculum
- **WHEN** the curriculum is loaded
- **THEN** at least 54 teaching lessons are available
