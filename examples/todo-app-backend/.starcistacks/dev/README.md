# dev runbook

One Compose project on one machine. `infra/compose/compose.yaml` includes one file per component, so a
component can be read, started and reasoned about on its own.

| command | what it does |
|---|---|
| prepare | `npm run sync` decrypts every `.enc` member, then `docker compose -f infra/compose/compose.yaml pull` |
| doctor | `docker compose -f infra/compose/compose.yaml config` |
| up | `docker compose -f infra/compose/compose.yaml up -d` |
| status | `docker compose -f infra/compose/compose.yaml ps` |
| logs | `docker compose -f infra/compose/compose.yaml logs -f api` |
| down | `docker compose -f infra/compose/compose.yaml down` |
| verification | `curl -fsS http://localhost:3001/health` and `curl -fsS http://localhost:8089/realms/todo` |

## Ports

| component | port |
|---|---|
| web | 3000 |
| api | 3001 |
| postgres | 5432 |
| redis | 6379 |
| keycloak | 8089 |
| minio | 9000 |
| prometheus | 9090 |

Every decrypted file under `runtime/` is produced by `npm run sync` from its `.enc` member and is never
committed. `infra/compose/.env.generated` is rendered the same way.

