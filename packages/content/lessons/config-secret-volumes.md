ConfigMaps and Secrets can be consumed as environment variables or as mounted files. File mounts are often better for larger configuration, certificate bundles, and values that should update without recreating a Pod. Secrets are still stored in the API and etcd, so they are not automatically safe.

A ConfigMap or Secret volume projects keys as files. Mounting the whole volume places each key at the mount path. `subPath` mounts one key as a single file, but those mounts do not receive later updates. `items` selects specific keys and can set file modes.

Failure modes include mounting a missing object, expecting a Secret to be encrypted without encryption at rest configured, and forgetting that a Pod does not see an updated object until the kubelet refreshes the projected volume. Immutable objects are a separate tradeoff.

Verification: confirm the ConfigMap and Secret exist, inspect the Pod's volume list, and read the mounted file from inside the container. Also check whether the application reloads configuration after the file changes. 