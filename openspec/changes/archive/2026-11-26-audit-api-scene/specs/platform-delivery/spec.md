# Spec Delta

## ADDED Requirements

### Requirement: API root handling
The exact `/api` path SHALL return a JSON 404 rather than the SPA.

#### Scenario: API root request
- **WHEN** a client requests `/api`
- **THEN** the API returns JSON with status 404

### Requirement: Accessible cluster scene
The cluster change scene SHALL pass serious accessibility checks and fit a mobile viewport.

#### Scenario: Scene after apply
- **WHEN** a learner applies a manifest and the scene opens
- **THEN** the scene passes axe and does not overflow at 390px
