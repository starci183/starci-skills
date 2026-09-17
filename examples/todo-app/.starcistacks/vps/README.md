# vps runbook

| command | what it does |
|---|---|
| prepare | `docker stack config -c stack.yaml` |
| doctor | `docker node ls` |
| up | `docker stack deploy -c stack.yaml todo` |
| status | `docker stack services todo` |
| logs | `docker service logs -f todo_api` |
| down | `docker stack rm todo` |
| verification | `curl -fsS https://todo.example.com/health` |

