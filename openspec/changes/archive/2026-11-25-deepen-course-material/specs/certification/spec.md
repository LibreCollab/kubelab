# Spec Delta

## ADDED Requirements

### Requirement: Answer rationales
Knowledge questions SHALL support an authored explanation, and exam review SHALL show it when present.

#### Scenario: Explanation is available
- **WHEN** a learner reviews a question with an authored explanation
- **THEN** the review shows why the correct answer is correct

#### Scenario: Explanation is absent
- **WHEN** a question has no authored explanation
- **THEN** the review still shows the correct answer and lesson link

### Requirement: Incident-style practical tasks
Hands-on task pools SHALL include multi-step incident tasks that require diagnosing and correcting more than one related resource.

#### Scenario: Broken service path
- **WHEN** a CKA learner starts the service incident task
- **THEN** they must correct workload and routing state before the checks pass

#### Scenario: Broken configuration
- **WHEN** a CKAD learner starts the configuration incident task
- **THEN** they must correct the ConfigMap and workload consumption before the checks pass
