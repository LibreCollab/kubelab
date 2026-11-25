Init containers run before application containers. They are useful for setup,
waiting for dependencies, and preparing volumes.

- They run one at a time in order.
- A failed init container blocks app startup.
- They can use different images from the app container.

```bash
kubectl get pod web
kubectl describe pod web
```
