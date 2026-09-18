# dev runbook

One Compose project on one machine. `infra/compose/compose.yaml` includes one file per component, so a
component can be read, started and reasoned about on its own.

`api` and `web` are declared with placeholder images (`todo-app/api`, `todo-app/web`) that have no build
context in this repository; they are behind the `app` Compose profile so a plain `up` does not try to pull
them. This example runs the api and web processes on the host instead - `npm run build && npm run start`
in `examples/todo-app-backend`, `npx next dev -p 3000` in `examples/todo-app-frontend` - against the infra
this brings up.

| command | what it does |
|---|---|
| prepare | decrypt the `.enc` secrets this environment needs (see "Secrets" below), then `docker compose -f infra/compose/compose.yaml pull` |
| doctor | `docker compose -f infra/compose/compose.yaml config` |
| up | `docker compose -f infra/compose/compose.yaml up -d` (postgres, keycloak, redis, minio, prometheus; add `--profile app` to also start the placeholder api/web containers) |
| status | `docker compose -f infra/compose/compose.yaml ps` |
| logs | `docker compose -f infra/compose/compose.yaml logs -f keycloak` |
| down | `docker compose -f infra/compose/compose.yaml down` |
| verification | `curl -fsS http://localhost:3001/auth/sign-in` (with a body, once the api is running on the host) and `curl -fsS http://localhost:8089/realms/todo` |

## Ports

| component | port |
|---|---|
| web | 3000 (host: `npx next dev -p 3000`) |
| api | 3001 (host: `npm run start`, `PORT` env, default 3001) |
| postgres | 5432 |
| redis | 6379 |
| keycloak | 8089 |
| minio | 9000 |
| prometheus | 9090 |

The four stateful ports (postgres 5432, redis 6379, minio 9000, prometheus 9090) run on their declared
host ports, by owner ruling: this machine also runs other Docker Desktop containers on those same ports
(`starci-postgres`, `starci-redis`, `starci-minio`, `starci-prometheus`), so bringing this stack up on the
declared ports means stopping those four first.

```sh
docker stop starci-postgres starci-redis starci-minio starci-prometheus
```

They are stopped, never removed, so their data and configuration are untouched. Restore them when this
example's stack is done with the ports:

```sh
docker start starci-postgres starci-redis starci-minio starci-prometheus
```

`starci-sonarqube` and anything else not sitting on one of this example's declared ports is left running.

## Secrets

Every decrypted file under `runtime/` is produced from its `.enc` member and is never committed.
`scripts/with-dev-secrets.sh` (or `.ps1` on Windows) decrypts every `.enc` member listed in
`runtime/env/KEYS.md` with `sops`, using the DEMO-ONLY identity at `runtime/env/demo.agekey`
(`SOPS_AGE_KEY_FILE`), and runs a command with them exported/materialized - for example:

```sh
./scripts/with-dev-secrets.sh docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d
```

No decrypted secret is ever written into the tracked tree; the script only materializes files under
`.starcistacks/dev/runtime/**` that this repository's own `.gitignore` already refuses to track.
