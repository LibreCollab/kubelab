Secrets hold sensitive data. Base64 is encoding, not encryption.

- Enable encryption at rest in etcd for real protection.
- Prefer external secret managers via CSI or operators.
- Mounting Secrets as files avoids exposing them in `env`.
