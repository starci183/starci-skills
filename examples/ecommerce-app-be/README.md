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
  registered once with `isGlobal: true`), `<app>.options.ts`. An app only composes; the e2e world proves it boots.
- `src/features/{identity,checkout,health}`: `application/` (command/query + thin handler + contracts) and `transport/{graphql,http}/`. A handler maps its input and calls one method of one service; a resolver or controller dispatches one bus message.
- `src/modules/domain`: account, session, identity (guards), catalog, cart, order (checkout and order services), payment, member; each owns its business logic in its `*.service.ts`, its entities, migrations,
  `.sql.ts` constants and errors under `persistence/` and `errors/`.
- `src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security,
  i18n, logging, clock, primitives (Outcome), probes.
- `src/modules/integrations`: cache (Redis), identity-api and order-api (each service calls the other over GraphQL).
- Unit specs exist only as `<name>.service.spec.ts` beside each `<name>.service.ts`. `src/tests`: `fixtures/builders/<area>.builder.ts` (test data), `e2e/` and `integration/` (the real world), `world/` (test infrastructure).
- `.starciwork`: product records. `.starcistacks`: the dev stack, env key list (`runtime/env/KEYS.md`) and seeds.

## Development

`npm ci`, then `npm run typecheck`, `npm run lint:check`, `npm run build`, `npm test`. The runbook with the
environment keys, migrations and seeds is `.starcistacks/dev/README.md`; `docs/guides/testing.md` describes the suites.

## Work

The backend owns [`.starciwork`](.starciwork/index.yaml) product records for both services
and the paired frontend.

## Runtime configuration

Every runtime value comes from the process environment through `EnvSource`; `.starcistacks/dev/runtime/env/KEYS.md` lists the
keys. `.starcistacks/dev/infra/metadata.json` stays the resolved port map the frontend reads.

## Verification

From this directory run `npm run typecheck`, `npm run lint:check`, `npm run build`, and
`npm test`. The unit suite runs the service specs with coverage and fails when a `*.service.ts` file is below 100 percent lines, branches, functions or statements. From the parent
`.claude` tree, run `node scripts/checks/canon-scan.mjs --root examples/ecommerce-app-be --json`
and `node scripts/checks/check-starcistacks.mjs examples/ecommerce-app-be`.

`npm run test:e2e` needs the declared Postgres, Redis, and
application processes. The test kinds are unit `<name>.service.spec.ts` beside each service, integration
`*.integration-spec.ts` under `src/tests/integration/` and e2e `*.e2e-spec.ts` under `src/tests/e2e/`. Narrow an e2e run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- resilience`. E2E runs manually only: no hook, default typecheck/lint or automatic CI job runs it (`npm run typecheck:e2e` is its manual type check).
See `docs/guides/testing.md` for the suite boundary. Existing Work evidence
retains its recorded revisions; the derived index reports stale proof where source or records
changed.
