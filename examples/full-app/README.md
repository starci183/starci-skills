# full-app

<!-- >>> starci app sync (managed block; do not edit) >>> -->

[![CI](https://github.com/starci183/starci-skills/actions/workflows/examples.yml/badge.svg?branch=main)](https://github.com/starci183/starci-skills/actions/workflows/examples.yml)
[![Codecov](https://codecov.io/gh/starci183/starci-skills/branch/main/graph/badge.svg?flag=full-app)](https://codecov.io/gh/starci183/starci-skills)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=starcidapride_starci-example-full-app&metric=alert_status)](https://sonarcloud.io/dashboard?id=starcidapride_starci-example-full-app)
[![Dependabot](https://github.com/starci183/starci-skills/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/starci183/starci-skills/actions/workflows/dependabot/dependabot-updates)

<!-- <<< starci app sync <<< -->

A small real shop: one StarCi app, three NestJS services in `be/` and two Next.js apps in `fe/`, one install at the root.

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
or is honestly an app-owned layout. Brand tokens come from each app's `fe/apps/<app>/src/modules/brand/brand.css` (teal `#0D9488`, Inter
through the `--font-sans` brand-layer token, the on-primary ink chosen because white on teal measures 3.74:1 — under the
brand record's 4.5:1 floor). The friendly-duck mascot (its direction is a brand record asset at
`.starciwork/brand/assets/duck.prompt.txt`) appears on welcome and genuine empty surfaces only — never on refusal or error
surfaces, per the brand record's `neverIn`. The landing → shop session handoff is marked in-source with `// contract:`
pointers.

## Stack

TypeScript everywhere; NestJS 11, PostgreSQL (one database per connection: `identity`, `order`, `billing`), Redis (sessions) and
GraphQL in `be/`; Next.js, React, next-intl and `@starci/grammar` in `fe/`; npm with one `package.json` and one lockfile at
the root, whose workspaces are the front end's apps and packages (`fe/apps/*`, `fe/packages/*`). The dev stack is declared in `.starcistacks/application-stacks.yaml`, with its Compose sources and runbook in `.starcistacks/dev`.

This example demonstrates local development only. It declares no production/VPS runtime, Swarm stack, sealed secret
member or rendered deployment model. `.starcistacks/dev/environment.json` records the environment identity;
`.starcistacks/dev/infra/metadata.json` is the port projection, not a rendered Compose model. Render the local deployment with
`docker compose -f .starcistacks/dev/infra/compose/compose.yaml --profile app config` when operating it.

## Repository layout

- `be/apps/<app>/src`: `be/apps/<app>/src/main.ts` (80 lines, creates `EnvSource` and calls `<app>.env.ts`), `<app>.env.ts` (150, typed, fail-fast parsing
  through `EnvSource` and capability parse helpers only), `<app>.options.ts` (200, env-derived values and port bindings with no
  parsing) and `be/apps/<app>/src/app.module.ts` (250, `AppModule.register(options)` registers each capability once with `isGlobal: true`).
  Each app separates its module lists into `be/apps/<app>/src/compose/<area>.ts` groups, which its app module spreads.
  Only `<app>.env.ts` parses the app's
  environment, and the env file holds no logic, module composition, business code or feature imports. The e2e world proves it boots.
- `be/src/features/api/<feature>/`: `be/src/features/api/<feature>/application/` (command/query + thin handler + contracts) and `be/src/features/api/<feature>/transport/{graphql,http}/`. A handler maps its input and calls one method of one service; a resolver or controller dispatches one bus message.
- `be/src/modules/domain`: account, session, identity (guards), catalog, cart, order (checkout, cancellation and order services), payment, invoice (billing), member; each owns its business logic in its `*.service.ts`, its entities, migrations,
  `*.sql.ts` constants and errors under `be/src/modules/domain/<capability>/persistence/` and `be/src/modules/domain/<capability>/errors/`.
- `be/src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security,
  i18n, logging, clock, primitives (Outcome), probes, inbox (event dedupe), messaging (BullMQ queues over Redis).
- `be/src/modules/integrations`: cache (Redis), identity-api and order-api (each service calls the other over GraphQL).
- `be/contracts/<service>/`: the vendored contract of each service: `be/contracts/<service>/schema.graphql` for its GraphQL, `be/contracts/<service>/events.json` for the messages it publishes. Event publishers and subscribers are composed from the service's typed app options. The order saga: `order.placed` (order) starts the invoice in billing; `billing.invoice-rejected` (compensates `order.placed`) makes the order service cancel the order, release its stock and refund its payment.
- Unit specs live beside their subjects; every `<name>.service.ts` has its `<name>.service.spec.ts`. `be/src/tests`: `be/src/tests/fixtures/builders/<area>.builder.ts` (test data), `be/src/tests/e2e/` and `be/src/tests/integration/` (the real world), `be/src/tests/world/` (test infrastructure).
- `fe/apps/landing/src`: the public marketing app; `fe/apps/app/src`: the authenticated shop app. The front end has no tests.
- `fe/packages/ecommerce-api`: the repository's one pair of Apollo clients (auth and no-auth) with their link chain, the
  `GraphQLResponse` union and the back-end projection reader. The shop's browser calls the identity and order GraphQL APIs
  directly: one file per operation under `fe/apps/app/src/modules/api/graphql/{queries,mutations}`, typed by the
  `npm run codegen` output generated from `be/contracts/{identity,order}/schema.graphql`, wrapped by the SWR hooks of
  `fe/apps/app/src/hooks/swr`; the session (the identity service's opaque bearer) lives in the browser (`fe/apps/app/src/modules/auth`).
- `fe/packages/ecommerce-i18n`: locales, routing, navigation and the server glue (request config, proxy, locale segment).
- `fe/packages/ecommerce-ui`: the shared composites and leaves both apps draw (shells, notices, tiles, display controls).
  Each package is built to its own `dist` and consumed by package name; `npm run build --workspaces` builds them.
- `scripts/`: `scripts/codegen.mjs` (the step behind `npm run codegen`), `scripts/serve.mjs` and `scripts/projection.mjs` (start an app on its
  projected port), `scripts/verify-render.mjs` (the running-page render proof).
- `.starciwork`: the product records of both sides. `.starcistacks`: the dev stack, env key list (`.starcistacks/dev/runtime/env/KEYS.md`) and seeds.

## Development

From this directory run `npm ci` and `npm run build --workspaces` (the front-end packages are consumed from their `dist`),
then `npm run typecheck`, `npm run lint`, `npm run build:be`, `npm run build:fe` and `npm test`. The runbook with the
environment keys, migrations and seeds is `.starcistacks/dev/README.md`; `be/docs/guides/testing.md` describes the suites.

The unit suite runs the service specs with coverage and fails when a `*.service.ts` file is below 100 percent lines,
branches, functions or statements. From the parent `.claude` tree, run
`starci gate canon-scan --root examples/full-app/be --json` and
`starci gate starcistacks examples/full-app`.

`npm run test:e2e` needs the declared Postgres, Redis, and application processes. The test kinds are unit
`<name>.service.spec.ts` beside each service, integration `*.integration-spec.ts` under `be/src/tests/integration/` and e2e
`*.e2e-spec.ts` under `be/src/tests/e2e/`. Narrow an e2e run with jest arguments, for example
`npm run test:e2e -- checkout/checkout-journey` or `npm run test:e2e -- resilience`. E2E runs manually only: no hook,
default typecheck/lint or automatic CI job runs it (`npm run typecheck:tests` is its manual type check); in the runtime repository
it runs through `workflow_dispatch` of the runtime repository's examples workflow. On push and pull request that workflow runs this app's
typecheck (tsc over be, turbo over the fe workspaces), `starci app lint`, unit tests with coverage, the Codecov upload under the flag `full-app` (the root `codecov.yml`), the
be build, the fe build (turbo) and the Sonar gate, and an `images` job that builds the image of every app (identity, order, billing, cli, landing, app) without pushing. The app's own `codecov.yml` and `.github/workflows/ci.yml` are the app-repository form `starci app sync` renders; they
run when the app is its own repository. Existing Work
evidence retains its recorded revisions; the derived index reports stale proof where source or records changed.

## Ports: there is one projection and it is read, never restated

Every runtime value of the back end comes from the process environment through `EnvSource`;
`.starcistacks/dev/runtime/env/KEYS.md` lists the keys. The product's resolved runtime projection is
**`.starcistacks/dev/infra/metadata.json`** (`ports.landing`, `ports.app`, `ports.identityApi`, `ports.orderApi`), the
port map the front end reads. No port literal exists in the front end:

- `scripts/serve.mjs` resolves the listener port and spawns `next dev`/`next start -p` per app:
  `node scripts/serve.mjs <landing|app> <dev|start>` from this directory.
- `fe/apps/landing/src/modules/config/index.ts` resolves the file for the landing's server-side shop link; the shop's
  browser reads its service base URLs from the `NEXT_PUBLIC_*` values `scripts/serve.mjs` fills from the projection (a deployment
  passes them as build arguments), and its `fe/apps/app/src/modules/config` fails a call whose value is missing.
- Resolution order (same shape as the BE's `findMetadataFile`): `FULL_APP_METADATA` names the file outright, else the
  walk searches each ancestor for `.starcistacks/dev/infra/metadata.json`.
- Env overrides keep the BE's precedence — `NEXT_PUBLIC_ORDER_API_URL`, `NEXT_PUBLIC_IDENTITY_API_URL`,
  `NEXT_PUBLIC_SHOP_URL` win outright; the projection is the fallback.

Each env is read once in the app's `fe/apps/<app>/src/modules/config` module (the read-once-in-config convention); pages and components import the
resolved constant, not `process.env`.

With no back end running, a signed-in shop renders the unreachable states of `/browse`, `/cart`, `/checkout` and
`/account`, naming the service, rather than showing placeholder data; a signed-out reader sees each page's sign-in gate. That is the intended
honest behavior — `node scripts/verify-render.mjs --record <ui-screen-id> <custody|captures|render>` from this directory checks the running-page
pairs (PNG + markup per route and viewport) against the Work tree's ui records.

Every API serves `/health/live` for process liveness and `/health/ready` for its required dependency probes; the
existing `/health` endpoint is a readiness alias. A failed or timed-out probe returns 503. Docker HEALTHCHECK uses
liveness. API bootstrap and both Next apps set security headers and disable `X-Powered-By`.

## Work

The app owns the product's [`.starciwork`](.starciwork/index.yaml) records for both sides.
