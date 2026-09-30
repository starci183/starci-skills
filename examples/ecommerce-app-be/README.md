# ecommerce-app-be

Two NestJS ecommerce services share the HFS backend repository tree.

## Overview

Two NestJS APIs (`apps/identity`, `apps/order`) and one migrate app share the HFS backend tree and follow the locked BE
convention: CQRS handlers, GraphQL doors that only dispatch the bus, one injected `EntityManager` per database, outcomes for
expected refusals and one error family per capability. The paired `examples/ecommerce-app-fe` reads this backend's port
projection.

## Stack

NestJS 11, TypeScript, PostgreSQL (one database per connection: `identity`, `order`), Redis (sessions) and GraphQL. The dev
stack is declared in `.starcistacks/dev`.

## Repository layout

- `apps/<app>/src`: `main.ts` (parses the environment once), `app.module.ts` (`AppModule.register(options)`, every capability
  registered once with `isGlobal: true`), `<app>.options.ts`, the composition spec.
- `src/features/{identity,checkout,health}`: `application/` (command/query + handler + contracts) and `transport/{graphql,http}/`.
- `src/modules/domain`: account, session, auth (guards), catalog, cart, order, payment; each owns its entities, migrations,
  `.sql.ts` constants and errors under `persistence/` and `errors/`.
- `src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security,
  i18n, logging, clock, primitives (Outcome), probes.
- `src/modules/integrations`: cache (Redis), identity-api and order-api (each service calls the other over GraphQL).
- `src/tests`: unit specs sit beside their subject; `fixtures/` holds typed doubles; `e2e/` boots the compiled apps.
- `.starciwork`: product records. `.starcistacks`: the dev stack, env key list (`runtime/env/KEYS.md`) and seeds.

## Development

`npm ci`, then `npm run typecheck`, `npm run lint:check`, `npm run build`, `npm run test:unit`. The runbook with the
environment keys, migrations and seeds is `.starcistacks/dev/README.md`; `docs/guides/testing.md` describes the suites.

## Work

The backend owns [`.starciwork`](.starciwork/index.yaml) product records for both services
and the paired frontend.

## Runtime configuration

Every runtime value comes from the process environment through `EnvSource`; `.starcistacks/dev/runtime/env/KEYS.md` lists the
keys. `.starcistacks/dev/infra/metadata.json` stays the resolved port map the frontend reads.

## Verification

From this directory run `npm run typecheck`, `npm run lint:check`, `npm run build`, and
`npm run test:unit`. The unit suite includes both Nest composition specs. From the parent
`.claude` tree, run `node scripts/checks/canon-scan.mjs --root examples/ecommerce-app-be --json`
and `node scripts/checks/check-starcistacks.mjs examples/ecommerce-app-be`.

`npm run test:e2e` and `node scripts/live-proof.mjs` need the declared Postgres, Redis, and
application processes. There are exactly two test kinds: unit `*.spec.ts` beside the source and e2e
`*.e2e-spec.ts` under `src/tests/e2e/`. Narrow an e2e run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- resilience`. E2E runs manually only: no hook, default typecheck/lint, coverage or automatic CI job runs it (`npm run typecheck:e2e` is its manual type check).
See `docs/guides/testing.md` for the suite boundary. Existing Work evidence
retains its recorded revisions; the derived index reports stale proof where source or records
changed.
