# vps runbook

One Swarm stack on one host. The same components as dev, with replicas for the two services and no
published database port.

| command | what it does |
|---|---|
| prepare | `npm run sync` then `docker stack config -c infra/stack.yaml` |
| doctor | `docker node ls` |
| up | `docker stack deploy -c infra/stack.yaml todo` |
| status | `docker stack services todo` |
| logs | `docker service logs -f todo_api` |
| down | `docker stack rm todo` |
| verification | `curl -fsS https://todo.example.com/health` |

Secrets are Swarm secrets created from the decrypted members; only the `.enc` members are committed.

