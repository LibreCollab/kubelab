# Spec Delta

## MODIFIED Requirements

### Requirement: Certification entry points
Each certification track SHALL expose a certification-roadmap entry point and the exam modes supported by that track.

#### Scenario: Learner chooses a preparation path
- **WHEN** a learner views a certification track on the core roadmap
- **THEN** the track offers a link to its certification roadmap

#### Scenario: Learner chooses an exam mode
- **WHEN** a learner views a certification roadmap or track
- **THEN** the supported knowledge and/or hands-on exam entry points are available

#### Scenario: Unsupported mode is hidden
- **WHEN** a track is knowledge-only or hands-on-only
- **THEN** the unsupported exam mode is not offered as an action
