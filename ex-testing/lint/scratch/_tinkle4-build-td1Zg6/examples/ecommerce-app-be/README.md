# ecommerce-app-be

The second example product of this skill: a small real shop backend, deployed as **two NestJS
services from one npm-workspaces monorepo** (`apps/*`), shaped like `D:/Repositories/nivo-backend`
- not like `examples/todo-app-backend`'s single `src/`. The todo example proves the Work layout at
`src/` scale; this one proves the *same* layout, the *same* gates and the *same* module conventions
survive the other topology the layout admits, and it carries the record kind a two-repo pair never
needed: a cross-service contract inside one repository's tree.

The paired frontend repository is `ecommerce-app-fe` (its own lane); its ports are declared in
`metadata.json` here because this file is the whole product's runtime projection.

## Shape

```
apps/identity  NestJS service - auth, account, session (persons in Postgres, sessions in Redis)
apps/order     NestJS service - catalog, cart, order, payment (verifies sessions against identity
               over real HTTP; answers the buyer question identity asks)
.starciwork/   the one canonical Work tree for the product (lives HERE; the FE repo binds into it)
.starcistacks/ dev compose fragments for its own services + shared infra
architecture.json / metadata.json  the runtime-config pair (roots: apps/*)
scripts/live-proof.mjs             the executable cross-service proof (runbook `verification`)
```

## Ports: there is one registry and it is metadata.json

The host registry (`.workspaces/ports/`, slot step 1000) assigns this product
`port = basePort + appSlot*1000 + offset` with **offset 69**; `metadata.json` is this repository's
resolved projection of it, the way nivo-backend's own metadata.json is nivo's. Nothing else in
this repository restates a port number that could drift:

| key | resolved | who reads it |
| --- | --- | --- |
| identityApi | 5070 | identity's AppConfigService (PORT_ENV `IDENTITY_PORT` overrides) |
| orderApi | 6070 | order's AppConfigService (`ORDER_PORT` overrides) |
| postgres | 5501 | both services' DATABASE_URL defaults; the compose fragment binds 5501:5432 |
| redis | 6448 | identity's session store; the compose fragment binds 6448:6379 |
| landing / shop | 3069 / 4069 | documented for the FE lane's apps - declared here, consumed there |

Both services' config modules read this file at boot (walk-up from cwd or
`ECOMMERCE_APP_BE_METADATA`), and every inter-service base URL is derived from the same numbers -
the same bargain `nivo-fe/scripts/sync-ports.mjs` makes: read the projection, never copy it.

## Running it

The dev runbook is `.starcistacks/dev/README.md` (prepare/doctor/up/status/logs/down/verification).
Shortest path from a fresh clone with Docker:

```
docker compose -f .starcistacks/dev/infra/compose/compose.yaml up -d postgres redis
npm install && npm run build
node dist/apps/identity/src/main.js     # port from metadata.json
node dist/apps/order/src/main.js        # port from metadata.json
curl http://127.0.0.1:5070/health       # {"status":"ok",...,"checks":{"postgres":"ok","redis":"ok"}}
curl http://127.0.0.1:6070/health       # ...,"checks":{"postgres":"ok","identity":"ok"} - a real call
node scripts/live-proof.mjs             # the full checkout flow across the two services, 14 steps
node scripts/live-proof.mjs --expect-down   # the honest negative, with both services stopped
```

The compose project name is declared in `compose.yaml` (`ecommerce-app-be-dev`) rather than passed
per command: without it Compose names the stack after the folder holding the file, so the runbook
would start a second stack that collides on 5501 with the first.

Gates: `npm run typecheck` (tsc --noEmit), `npx jest` (6 suites, 18 tests),
`node ../../scripts/checks/check-example-yaml.mjs` + `check-example-work.mjs` +
`check-example-derived.mjs` from the skill root, `node ../../cli/main.mjs architecture check
examples/ecommerce-app-be --config architecture.json`.

## What is proven, and where

Every `done` record in `.starciwork/` carries a sibling `evidence.yaml` written by
`scripts/example-evidence.mjs` by actually running its assertion commands - unit tests (`-t`
patterns name the ac/fr/sds/contract ids) and `node scripts/live-proof.mjs` for the
cross-service wire facts. The provider/consumer pair on
`contract.checkout.order-for-identity` is the point of the whole example: identity learns a
person has orders only by asking order over HTTP, and order admits a checkout only by asking
identity to verify the session. Nothing is shared between the two services except the
infrastructure *names* in metadata.json.

Known-red, honestly stated. The per-gate numbers are in
`docs/examples/grit/second-example-gates.md` §6; what matters for reading this file:

- **Green for this example, exit 0:** `tsc --noEmit`, `jest` (6 suites / 18 tests), `npm run build`,
  `check-example-yaml.mjs`, the `architecture check` for this tree, the compose fragments
  (Postgres 5501, Redis 6448 up), and `live-proof.mjs` in both directions (14/14, plus a refusal
  proof against a down stack).
- **`check-example-work.mjs` and `check-example-derived.mjs` exit 1** — on the *first* example's
  pre-existing stale digests and stale `_derived`. Neither line names this tree: grepping their
  output for `ecommerce-app-be` returns nothing. They are repo-wide gates, so a clean record set
  here cannot show up as exit 0 until the todo tree is refreshed by a lane that owns it.
- **The nest scoped-lint profile exits 1** (207 `NEST_IMPORT_FORMAT`, 195
  `NEST_MEMBER_DOCUMENTATION`, 24 unavailable inputs, 1 `ESLINT_UNAVAILABLE`). The same two rule
  classes fire 2254 times on `todo-app-backend`, whose equivalent CI job is guarded off with
  `if: false` pending lane `ex-be-nest`; this example leaves that profile to its owner rather than
  half-reformatting 59 files.
- **`npm run build` / `ensure-build.mjs` at the skill root throws** once this example's
  dependencies are installed, because the build mirror walks `node_modules` and refuses npm's
  workspace symlinks (61 of `npm test`'s 66 failures are this one link; the other 5 reproduce with
  the dependencies removed). The authored tree alone passes (`ok:true, stale:[]`). Shared-file
  finding, not patched here.
- **`schemas/json-exceptions.yaml` cannot see this example's JSON.** It allowlists authored
  `*.json` by exact `examples/todo-app-backend/...` path, so none of the nine here is declared —
  and `metadata.json` plus the two per-workspace `package.json` files have no todo analogue. The
  gate reports nothing today because it throws on its own path-ordering rule before walking.
