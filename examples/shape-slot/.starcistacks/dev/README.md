# shape-slot manual host development

This folder holds the notes seed and the names-only roster in `runtime/env/KEYS.md`. `.starcistacks/application-stacks.yaml` declares hosted code analysis only. There is no declared application environment, infrastructure model or rendered stack, so stack preparation and deployment commands do not apply to this fixture.

An operator supplies PostgreSQL and a dedicated notes database, sets the required roster keys in the process environment or mounts `PRIMARY_DB_URL_FILE`, and runs these commands from the example root. The sales REST API used by the FE is a separate dependency supplied through `NEXT_PUBLIC_API_BASE_URL`; the scaffolded core API serves health and the notes fixture only.

| command      | host-development action                                                                                                                                                                      |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| prepare      | `npm run build:be` compiles the core and CLI after dependencies are available.                                                                                                               |
| doctor       | `npm run cli -- migrate run` proves the supplied primary connection can apply the declared notes migrations.                                                                                 |
| up           | `npm run dev:be` starts the core; in another terminal, `npm run dev:fe -- -- --port 3001` starts the FE with its public sales API URL.                                                       |
| env          | Supply the required names in `runtime/env/KEYS.md` to each process; direct development uses `PORT=3000`, `HTTP_SECURITY_ALLOWED_ORIGINS=http://localhost:3001`, and zero trusted proxy hops. |
| seeds        | `npm run cli -- seed run --env dev` applies `seeds/primary-notes.sql` through the declared primary connection.                                                                               |
| verification | `curl --fail http://localhost:3000/health/live` and `curl --fail http://localhost:3000/health/ready` return 200; a failed primary connection makes readiness return 503.                     |
| status       | Probe `/health/live` for process responsiveness and `/health/ready` for required dependency availability.                                                                                    |
| logs         | Read the core terminal's structured JSON output; never print the connection value or a mounted secret file.                                                                                  |
| down         | Stop the development processes with Ctrl+C; PostgreSQL remains operator managed.                                                                                                             |

The core Dockerfile carries a process liveness healthcheck. API and FE security headers are applied by the applications. Any future proxy deployment must explicitly declare its trusted hop count and provide its own environment, model and runbook.
