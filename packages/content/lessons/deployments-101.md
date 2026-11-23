A Deployment manages ReplicaSets, which manage Pods. You declare replicas and a Pod template; the Deployment controller performs rolling updates.

- `kubectl create deployment web --image=nginx --replicas=3`
- `kubectl scale deployment web --replicas=5`
- `kubectl set image deployment/web nginx=nginx:1.27`
- `kubectl rollout status deployment/web` and `rollout undo`
