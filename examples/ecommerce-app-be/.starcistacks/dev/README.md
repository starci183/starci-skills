# ecommerce-app dev stack

The dev environment for the second example product: the two shared stateful components
(Postgres on 5501, Redis on 6448) run under Compose; the two services run on the host against
them. Postgres carries one database per connection (`ecommerce_identity`, `ecommerce_order`, created by
`../infra/compose/initdb`). Every runtime value reaches the services through their environment; the keys are
listed in `runtime/env/KEYS.md`, and `../infra/metadata.json` stays the resolved port map the frontend reads.

Declared in `.starcistacks/application-stacks.yaml`; this file is its runbook. Only `dev` is
declared - this example has no vps deployment, and an environment nobody operates is not
authored "for shape" (the machine schema requires at least one environment; the layout prose
that mentions dev+vps is reported as a finding, not answered with a fake).

| command | what it does |
| --- | --- |
| prepare | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml --profile app config --quiet` - the compose tree parses and every include resolves |
| doctor | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` - the infra pair is listed as running; the services answer `curl http://localhost:5070/health` and `curl http://localhost:6070/health` once started |
| up | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d postgres redis` - the infra pair only (5501/6448); then export the keys below, `npm run build && npm run migrate`, apply the seeds, and `npm run start:identity` and `npm run start:order` on the host |
| env | `IDENTITY_API_PORT=5070 IDENTITY_DB_URL=postgres://postgres@localhost:5501/ecommerce_identity CACHE_REDIS_URL=redis://localhost:6448/0 ORDER_API_URL=http://localhost:6070 HTTP_SECURITY_ALLOWED_ORIGINS=http://localhost:4069` for identity; `ORDER_API_PORT=6070 ORDER_DB_URL=postgres://postgres@localhost:5501/ecommerce_order IDENTITY_API_URL=http://localhost:5070 HTTP_SECURITY_ALLOWED_ORIGINS=http://localhost:4069` for order; `npm run migrate` reads both `*_DB_URL` keys |
| seeds | `psql postgres://postgres@localhost:5501/ecommerce_order -f .starcistacks/dev/seeds/order-catalog.sql` (the demo catalog) and `psql postgres://postgres@localhost:5501/ecommerce_identity -f .starcistacks/dev/seeds/identity-demo.sql` (the demo person) |
| status | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` |
| logs | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml logs -f postgres redis` |
| down | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml down` (add `-v` to drop the Postgres volume, then migrate and seed again) |
| verification | `node scripts/live-proof.mjs` - registers a fresh visitor, signs in, adds cart lines, confirms an order, replays the idempotency key, and reads `hasOrders` back through identity -> order over real GraphQL; exits 0 only when every step passed |

The dev Postgres runs with trust authentication (DEMO-ONLY: a local container whose published
ports bind loopback, holding the demo seeds - nothing worth a password). A real
environment adopts the SOPS+age custody the todo-app example demonstrates before it holds
anything worth encrypting; the declaration says `secrets: []` for exactly that reason.
