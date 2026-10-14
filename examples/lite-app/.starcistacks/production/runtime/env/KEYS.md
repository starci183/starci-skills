# Environment keys

Every environment key the app's typed environment readers (`be/apps/api/src/api.env.ts`, `fe/apps/web/src/modules/config`) read, with required/default semantics. A required key without a default stops boot with a named `CONFIG_KEY_MISSING`; a `<KEY>_FILE` pointer supplies the same value from a mounted secret.

## api (be)

Required — declared in `infra/swarm/stack.yaml` or sealed in `secrets/api.enc` and mounted by `*_FILE`:

| Key                             | Kind              | Where                                                | Semantics                                                                                           |
| ------------------------------- | ----------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `PORT`                          | int               | stack env `8787`                                     | The HTTP listener port.                                                                             |
| `NODE_ENV`                      | string (optional) | stack env `production`                               | `development`/`test` permits plain-HTTP origins in the CORS allowlist; `production` requires HTTPS. |
| `HTTP_SECURITY_ALLOWED_ORIGINS` | string            | stack env                                            | Comma-separated exact origins; validated at boot (no wildcards, HTTPS outside development/test).    |
| `PRIMARY_DB_URL`                | secret            | `secrets/api.enc` → `PRIMARY_DB_URL_FILE`            | The least-privilege `app_be` connection to the Supabase project.                                    |
| `PRIMARY_DB_SCHEMA`             | string            | stack env `public`                                   | The schema the primary connection is bound to.                                                      |
| `SUPABASE_URL`                  | url               | stack env                                            | The Supabase project origin (Auth, Storage, JWKS).                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | secret            | `secrets/api.enc` → `SUPABASE_SERVICE_ROLE_KEY_FILE` | Service-role key for Supabase server calls; the back end never forwards it.                         |
| `CALENDAR_WEBHOOK_SECRET`       | secret            | `secrets/api.enc` → `CALENDAR_WEBHOOK_SECRET_FILE`   | The signing secret of the calendar provider's webhook deliveries.                                   |

Optional tunables (literal defaults in the parsers; override in the stack env only when needed):

| Key                                | Default       | Semantics                                                            |
| ---------------------------------- | ------------- | -------------------------------------------------------------------- |
| `HTTP_SECURITY_RATE_WINDOW`        | `60000` (ms)  | Rate-limit window length.                                            |
| `HTTP_SECURITY_RATE_DEFAULT_LIMIT` | `600`         | Requests per window, default tier.                                   |
| `HTTP_SECURITY_RATE_STRICT_LIMIT`  | `30`          | Requests per window, strict tier (auth handshakes, signed webhooks). |
| `CALENDAR_WEBHOOK_TOLERANCE`       | `300000` (ms) | Maximum delivery age/signature replay window.                        |
| `QUEUE_RELAY_INTERVAL`             | `1000` (ms)   | Outbox→pgmq relay poll.                                              |
| `QUEUE_RELAY_BATCH`                | `50`          | Rows per relay pass.                                                 |
| `QUEUE_CONCURRENCY`                | `5`           | Worker deliveries in flight.                                         |
| `QUEUE_POLL_INTERVAL`              | `1000` (ms)   | pgmq poll interval.                                                  |
| `QUEUE_VISIBILITY_TIMEOUT`         | `30000` (ms)  | Delivery claim before re-read.                                       |
| `JOBS_WORKER_ID`                   | `worker`      | The claimant name in the jobs ledger.                                |
| `JOBS_LEASE`                       | `60000` (ms)  | How long a job claim lasts before another worker may claim it.       |

## web (fe)

Required public build values (`NEXT_PUBLIC_*` are published by design and are never sealed):

| Key                             | Semantics                                                            |
| ------------------------------- | -------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`          | The public origin used for metadata (`https://lite-app.example`).    |
| `NEXT_PUBLIC_GRAPHQL_URL`       | The api's GraphQL endpoint (`https://api.lite-app.example/graphql`). |
| `NEXT_PUBLIC_REST_URL`          | The api's REST base (uploads, auth endpoints).                       |
| `NEXT_PUBLIC_SUPABASE_URL`      | The public Supabase project origin; the browser reaches Auth only.   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public anonymous key of Supabase Auth.                           |

## Deployment inputs

These public names configure the stack renderer and ingress, rather than the API's typed reader.
The external secret names and routes config name are versioned references declared in the model.

| Key                  | Semantics                                                                                      |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `ACME_EMAIL`         | Public operator contact for certificate renewal notices.                                       |
| `LITE_APP_API_IMAGE` | Immutable API image digest produced by a verified release.                                     |
| `LITE_APP_WEB_IMAGE` | Immutable web image digest produced by a verified release with its public build configuration. |
