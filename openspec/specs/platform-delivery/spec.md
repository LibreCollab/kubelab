# platform-delivery Specification

## Purpose

Deliver the learning experience as a static, testable web build with a minimal API surface and reproducible deployment checks.

## Requirements

### Requirement: Static single-page app
The web experience SHALL build to static assets and route directly to lessons, exams, labs, and practice without server-side rendering.

#### Scenario: Deep link loads the app
- **WHEN** a learner opens a lesson or exam URL directly
- **THEN** the host serves the app shell and the client renders the requested route

#### Scenario: Unknown route is handled
- **WHEN** the host receives an unknown client route
- **THEN** the static fallback serves the app shell for client-side handling

### Requirement: Minimal Go API
The API SHALL expose a health endpoint and serve the embedded web build without requiring a database or authentication service.

#### Scenario: Health check responds
- **WHEN** the API receives a health request
- **THEN** it returns a successful health response

#### Scenario: API serves the web app
- **WHEN** the API receives a non-health route
- **THEN** it serves the embedded static app

### Requirement: Reproducible checks
The repository SHALL provide commands for linting, type checking, unit tests, API tests, browser tests, production build, and OpenSpec validation.

#### Scenario: Full check passes
- **WHEN** a maintainer runs the full check command
- **THEN** lint, typecheck, unit tests, Go tests, and spec validation all run

#### Scenario: Browser behavior is covered
- **WHEN** routes, terminal behavior, lessons, exams, or responsive layouts change
- **THEN** the change includes Playwright coverage and the E2E command passes

#### Scenario: Specs are validated in CI
- **WHEN** a pull request runs CI
- **THEN** OpenSpec changes and specs are validated

### Requirement: Preview deployment
The project SHALL deploy the static build to GitHub Pages from the main branch and preserve the custom preview domain.

#### Scenario: Main branch deploys
- **WHEN** a commit lands on main
- **THEN** CI builds the web app and publishes the static artifact to GitHub Pages

#### Scenario: Custom domain is retained
- **WHEN** the site is published
- **THEN** the custom CNAME remains part of the deployment artifact

### Requirement: Local-first scope
The preview SHALL NOT require or imply accounts, cross-device sync, cloud progress, or a production database.

#### Scenario: Preview uses local progress
- **WHEN** a learner uses the public preview
- **THEN** progress remains in that browser and is not presented as synced

### Requirement: Real-cluster bridge
The repository SHALL document how learners move from the simulator to kind or k3d for real kubectl practice.

#### Scenario: Learner leaves the simulator
- **WHEN** a learner needs real-cluster practice
- **THEN** documented setup, drills, verification, and cleanup steps are available
