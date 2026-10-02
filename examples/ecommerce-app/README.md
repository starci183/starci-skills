# ecommerce-app

A small real shop: one StarCi app, two NestJS services in `be/` and two Next.js apps in `fe/`, one install at the root.

## Overview

The back end runs three services (`be/apps/identity`, `be/apps/order`, `be/apps/billing`: billing consumes `order.placed` and invoices the order, the order service consumes `billing.invoice-rejected` and compensates the order) and one cli app, each service with its own Dockerfile and a pinned image in the stack, following the locked BE
convention: CQRS handlers, GraphQL doors that only dispatch the bus, one injected `EntityManager` per database, outcomes for
expected refusals and one error family per capability.

The front end serves one deployable Next.js app per `fe/apps/*` site:

| app               | what it is                                          |
| ----------------- | --------------------------------------------------- |
| `fe/apps/landing` | Public marketing site + catalogue teaser            |
| `fe/apps/app`     | Authenticated shop: browse, cart, checkout, account |

The apps are real, runnable Next.js builds on `@starci/grammar` primitives (the same Common family the todo app
consumes): grammar's `GrammarRoot` boundary wraps each app's client shell, and every surface maps to a real grammar
component (`SurfaceCard`, `SurfaceListCard`, `EmptyNotice`, `Button`, `TextAction`, `SectionHeader`, `MediaFrame`, `Badge`)
or is honestly an app-owned layout. Brand tokens come from each app's `src/modules/brand/brand.css` (teal `#0D9488`, Inter
through the `--font-sans` brand-layer token, the on-primary ink chosen because white on teal measures 3.74:1 — under the
brand record's 4.5:1 floor). The friendly-duck mascot (its direction is a brand record asset at
`.starciwork/brand/assets/duck.prompt.txt`) appears on welcome and genuine empty surfaces only — never on refusal or error
surfaces, per the brand record's `neverIn`. The landing → shop session handoff is marked in-source with `// contract:`
pointers.

## Stack

TypeScript everywhere; NestJS 11, PostgreSQL (one database per connection: `identity`, `order`), Redis (sessions) and
GraphQL in `be/`; Next.js, React, next-intl and `@starci/grammar` in `fe/`; npm with one `package.json` and one lockfile at
the root, whose workspaces are the front end's packages (`fe/packages/*`). The dev stack is declared in `.starcistacks/dev`.

## Repository layout

- `be/apps/<app>/src`: `main.ts` (parses the environment once), `app.module.ts` (`AppModule.register(options)`, every
  capability registered once with `isGlobal: true`), `<app>.options.ts`. An app only composes; the e2e world proves it boots.
- `be/src/features/{identity,checkout,health}`: `application/` (command/query + thin handler + contracts) and `transport/{graphql,http}/`. A handler maps its input and calls one method of one service; a resolver or controller dispatches one bus message.
- `be/src/modules/domain`: account, session, identity (guards), catalog, cart, order (checkout, cancellation and order services), payment, invoice (billing), member; each owns its business logic in its `*.service.ts`, its entities, migrations,
  `.sql.ts` constants and errors under `persistence/` and `errors/`.
- `be/src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security,
  i18n, logging, clock, primitives (Outcome), probes, inbox (event dedupe), messaging (BullMQ queues over Redis).
- `be/src/modules/integrations`: cache (Redis), identity-api and order-api (each service calls the other over GraphQL).
- `be/contracts/<service>/`: the vendored contract of each service: `schema.graphql` for its GraphQL, `events.json` for the messages it publishes (`apps/<service>/src/events.ts`); a worker lists what it reads in `apps/<app>/src/consumes.ts`. The order saga: `order.placed` (order) starts the invoice in billing; `billing.invoice-rejected` (compensates `order.placed`) makes the order service cancel the order, release its stock and refund its payment.
- Unit specs exist only as `<name>.service.spec.ts` beside each `<name>.service.ts`. `be/src/tests`: `fixtures/builders/<area>.builder.ts` (test data), `e2e/` and `integration/` (the real world), `world/` (test infrastructure).
- `fe/apps/landing/src`: the public marketing app; `fe/apps/app/src`: the authenticated shop app. The front end has no tests.
- `fe/packages/ecommerce-api`: the wire client, the `Outcome` union and the back-end projection reader.
- `fe/packages/ecommerce-i18n`: locales, routing, navigation and the server glue (request config, proxy, locale segment).
- `fe/packages/ecommerce-ui`: the shared composites and leaves both apps draw (shells, notices, tiles, display controls).
  Each package is built to its own `dist` and consumed by package name; `npm run build --workspaces` builds them.
- `scripts/`: `codegen.mjs` (the step behind `npm run codegen`), `serve.mjs` and `projection.mjs` (start an app on its
  projected port), `verify-render.mjs` (the running-page render proof).
- `.starciwork`: the product records of both sides. `.starcistacks`: the dev stack, env key list (`runtime/env/KEYS.md`) and seeds.

## Development

From this directory run `npm ci` and `npm run build --workspaces` (the front-end packages are consumed from their `dist`),
then `npm run typecheck`, `npm run lint`, `npm run build:be`, `npm run build:fe` and `npm test`. The runbook with the
environment keys, migrations and seeds is `.starcistacks/dev/README.md`; `be/docs/guides/testing.md` describes the suites.

The unit suite runs the service specs with coverage and fails when a `*.service.ts` file is below 100 percent lines,
branches, functions or statements. From the parent `.claude` tree, run
`node scripts/checks/canon-scan.mjs --root examples/ecommerce-app/be --json` and
`node scripts/checks/check-starcistacks.mjs examples/ecommerce-app`.

`npm run test:e2e` needs the declared Postgres, Redis, and application processes. The test kinds are unit
`<name>.service.spec.ts` beside each service, integration `*.integration-spec.ts` under `be/src/tests/integration/` and e2e
`*.e2e-spec.ts` under `be/src/tests/e2e/`. Narrow an e2e run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- resilience`. E2E runs manually only: no hook,
default typecheck/lint or automatic CI job runs it (`npm run typecheck:tests` is its manual type check); in the runtime repository
it runs through `workflow_dispatch` of `.github/workflows/examples.yml`. On push and pull request that workflow runs this app's
typecheck, `hfs lint`, unit tests with coverage, the Codecov upload under the flag `ecommerce-app` (the root `codecov.yml`), the
front-end build and the Sonar gate. The app's own `codecov.yml` and `ci.yml` are the app-repository form `hfs sync` renders; they
run when the app is its own repository. Existing Work
evidence retains its recorded revisions; the derived index reports stale proof where source or records changed.

## Ports: there is one projection and it is read, never restated

Every runtime value of the back end comes from the process environment through `EnvSource`;
`.starcistacks/dev/runtime/env/KEYS.md` lists the keys. The product's resolved runtime projection is
**`.starcistacks/dev/infra/metadata.json`** (`ports.landing`, `ports.app`, `ports.identityApi`, `ports.orderApi`), the
port map the front end reads. No port literal exists in the front end:

- `scripts/serve.mjs` resolves the listener port and spawns `next dev`/`next start -p` per app:
  `node scripts/serve.mjs <landing|app> <dev|start>`.
- `fe/packages/ecommerce-api/src/projection.ts` resolves the file for both apps' service base URLs; each app's
  `src/modules/config` module applies its own environment overrides.
- Resolution order (same shape as the BE's `findMetadataFile`): `ECOMMERCE_APP_METADATA` names the file outright, else the
  walk searches each ancestor for `.starcistacks/dev/infra/metadata.json`.
- Env overrides keep the BE's precedence — `NEXT_PUBLIC_ORDER_API_URL`, `NEXT_PUBLIC_IDENTITY_API_URL`,
  `NEXT_PUBLIC_SHOP_URL` win outright; the projection is the fallback.

Each env is read once in the app's `src/modules/config` module (the read-once-in-config convention); pages and components import the
resolved constant, not `process.env`.

With no back end running, `/browse` and `/account` in the shop render their unreachable states and name the service and
reason rather than showing placeholder data; `/cart` and `/checkout` render their genuine empty states. That is the intended
honest behavior — `node scripts/verify-render.mjs --record <ui-screen-id> <custody|captures|render>` checks the running-page
pairs (PNG + markup per route and viewport) against the Work tree's ui records.

## Work

The app owns the product's [`.starciwork`](.starciwork/index.yaml) records for both sides.
