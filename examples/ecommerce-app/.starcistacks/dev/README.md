# ecommerce-app dev stack

The local development environment declares five shared components (Postgres, Redis, Keycloak, MinIO and Kafka)
and three API services (identity, order and billing). Compose starts the infrastructure by default; the `app`
profile also starts API images. Each service owns a Postgres database. The front-end port projection lives in
`infra/metadata.json`; it is configuration metadata, not a rendered deployment model.

Only `dev` is declared in `.starcistacks/application-stacks.yaml`. This example has no production/VPS deployment
or sealed secret member. The example README describes this development scope.

Run these commands from the example root. Before starting the host services, supply the required keys for each
API from `runtime/env/KEYS.md`, including the broker/group settings, order queue host and billing webhook key.
The CLI needs all three database URL keys. Use `npm run build:be` to build the APIs and CLI.

| command | what it does |
| --- | --- |
| prepare | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml --profile app config --quiet` validates every include; use `config --format json` to obtain a rendered local model |
| doctor | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` checks all five infrastructure containers; after service startup, check each `/health/ready` endpoint |
| up | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d postgres redis keycloak minio kafka`; supply each API's required environment, then `npm run build:be`, `npm run migrate`, seed, and run `npm run start:identity`, `npm run start:order` and `npm run start:billing` in separate terminals |
| seeds | `psql "$ORDER_DB_URL" -f .starcistacks/dev/seeds/order-catalog.sql` and `psql "$IDENTITY_DB_URL" -f .starcistacks/dev/seeds/identity-demo.sql` apply the local demo data |
| verification | `curl --fail http://localhost:5070/health/live`, `curl --fail http://localhost:6070/health/live` and `curl --fail http://localhost:7070/health/live` check liveness; call the same ports at `/health/ready` to verify required dependencies; `/health` remains a readiness alias |
| status | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` |
| logs | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml logs -f postgres redis keycloak minio kafka` |
| down | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml down`; add `-v` only when discarding the local demo databases |

Compose requires credentials from the runtime environment. Export
`KC_BOOTSTRAP_ADMIN_PASSWORD`, `KEYCLOAK_ADMIN_CLIENT_SECRET` and `MINIO_ROOT_PASSWORD` before `up` and supply matching
credentials to the API processes. No credential belongs in this runbook or in a public `NEXT_PUBLIC_*` key.
The browser stack helper generates fresh credentials in memory for each isolated run.
A production operator must declare a production runtime and sealed custody separately.

Readiness calls the probes composed by each API, with a bounded deadline for every probe. Liveness remains
independent of database and broker availability, so an infrastructure outage does not masquerade as a dead process.
