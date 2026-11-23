ConfigMaps hold non-secret configuration as key/value data or files.

- Consume as env vars, `envFrom`, or mounted files.
- Changing a mounted ConfigMap eventually updates the file, not the process.
- Use immutable ConfigMaps for safer rollouts.
