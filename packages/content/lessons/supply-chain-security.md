Supply chain security starts before a Pod is scheduled. Pin images by digest so the content cannot change under a mutable tag. Generate an SBOM so responders know which components and versions are present. Sign images and verify signatures at admission so only trusted artifacts run.

Scanning finds known vulnerabilities, but it is a snapshot. Re-scan when new advisories appear. Provenance records how an artifact was built, which helps distinguish an approved pipeline from a local build. Admissions controllers can enforce allowed registries, signatures, and attestations.

Failure modes include trusting `latest`, signing an image but not verifying it, scanning only at build time, and letting a cluster pull from an unreviewed registry. A digest without a signature proves immutability, not trust.

Verification: inspect the Deployment image reference, confirm the digest resolves to the expected artifact, check the SBOM and signature in the registry, and prove the admission policy rejects an unsigned image. 