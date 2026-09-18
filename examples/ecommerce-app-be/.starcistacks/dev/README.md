# ecommerce-app dev stack

The dev environment for the second example product: the two shared stateful components
(Postgres on 5501, Redis on 6448) run under Compose; the two services run on the host against
them, resolving every port from `../../metadata.json` - the same numbers as the `ports:` blocks
below, read not copied.

Declared in `.starcistacks/application-stacks.yaml`; this file is its runbook. Only `dev` is
declared - this example has no vps deployment, and an environment nobody operates is not
authored "for shape" (the machine schema requires at least one environment; the layout prose
that mentions dev+vps is reported as a finding, not answered with a fake).

| command | what it does |
| --- | --- |
| prepare | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml --profile app config --quiet` - the compose tree parses and every include resolves |
| doctor | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` - the infra pair is listed as running; the services answer `curl http://localhost:5070/health` and `curl http://localhost:6070/health` once started |
| up | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d postgres redis` - the infra pair only (5501/6448); then `npm run build && npm run start:identity` and `npm run start:order` on the host |
| status | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml ps` |
| logs | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml logs -f postgres redis` |
| down | `docker compose -f .starcistacks/dev/infra/compose/compose.yaml down` (add `-v` to drop the Postgres volume and re-seed from the migrations) |
| verification | `node scripts/live-proof.mjs` - registers a fresh visitor, signs in, adds cart lines, confirms an order, replays the idempotency key, and reads `hasOrders` back through identity -> order over real HTTP; exits 0 only when every step passed |

The dev Postgres runs with trust authentication (DEMO-ONLY: a local container whose published
ports bind loopback, holding a seeded demo catalog - nothing worth a password). A real
environment adopts the SOPS+age custody the todo-app example demonstrates before it holds
anything worth encrypting; the declaration says `secrets: []` for exactly that reason.
