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

Host-side ports only; container-internal ports are unchanged. Declared defaults collided with other
Docker Desktop containers already running on this machine (`starci-postgres` on 5432, `starci-redis` on
6379, `starci-minio` on 9000, `starci-prometheus` on 9090 - checked with `docker ps` and
`netstat -ano | findstr LISTENING` before this stack ever started) rather than with anything this
example itself owns twice, so the fix is a host-side port change here, never stopping a container this
lane did not start.

| component | declared port | host port used here | why |
|---|---|---|---|
| web | 3000 | 3000 (host: `npx next dev -p 3000`) | free |
| api | 3001 | 3001 (host: `npm run start`, `PORT` env) | free |
| postgres | 5432 | 5440 | 5432 held by `starci-postgres` |
| redis | 6379 | 6389 | 6379 held by `starci-redis` |
| keycloak | 8089 | 8089 | free |
| minio | 9000 | 9030 | 9000 held by `starci-minio` |
| prometheus | 9090 | 9091 | 9090 held by `starci-prometheus` |

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
