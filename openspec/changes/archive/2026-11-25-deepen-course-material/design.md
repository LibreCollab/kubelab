# Design

## Answer rationales

- Add optional `explanation` to quiz checks and certification questions.
- Carry lesson explanations into exam questions and show them in review.
- Add authored rationales to certification-only questions.
- Questions without an explanation retain the correct answer and lesson link.

## Incident labs

- Add `cka-incident-service`: broken Service selector and stale Deployment require
  applying corrected manifests, then endpoint and curl verification.
- Add `ckad-incident-config`: bad ConfigMap value and Deployment env require
  applying the corrected multi-document manifest.
- Add them to the CKA/CKAD task pools and map them to relevant domains.
- Add integration tests that seed the task, apply the provided fix, and evaluate
  every check.

## Supporting material

- `docs/certification-objectives.md` records domain weights, mapped lesson/task
  counts, known gaps, and review rules.
- `docs/real-cluster-practice.md` provides kind/k3d setup, drills, verification
  habits, and cleanup.
- README links both documents.

## Compatibility

- Explanation is optional, so old content remains valid.
- Standard `envFrom.configMapRef` and `secretRef` manifests are normalized on
  apply so real Kubernetes YAML works in the simulator.
