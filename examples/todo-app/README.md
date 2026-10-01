# todo-app

A todo app with Keycloak sign-in and a Postgres-backed task list: one StarCi app, its NestJS back end in `be/`, its Next.js front end in `fe/`, one install at the root.

## Overview

A domain-first example. The back end signs users in through Keycloak and keeps a Postgres-backed task list scoped by session
token; the front end draws the screens with `@starci/grammar`. The app root owns the product's `.starciwork` and the back end
owns `.starcistacks/dev` (Postgres + Keycloak, realm `todo`, demo user `demo@todo.dev`). The runtime's own Work-layout and
architecture checks run directly against this tree.

## Stack

TypeScript everywhere; NestJS, PostgreSQL and Keycloak in `be/`, Next.js with next-intl in `fe/`; npm with one `package.json`
and one lockfile at the root. The development services are declared under `.starcistacks/dev`.

## Repository layout

- `be/apps/todo/src`: the api (`main.ts` parses the environment once, `app.module.ts` is `AppModule.register(options)`: every capability registered once with `isGlobal: true`, the three app guards in order rate limit, origin, auth).
- `be/apps/worker/src`: the worker (no listener): the scheduled jobs and the queue consumers of `src/features/todo/transport/{schedule,message}`.
- `be/apps/migrate/src`: the only process that applies migrations; run `npm run migrate` before the api and the worker start.
- `be/src/features/{todo,health}`: `application/` (command/query + handler + contracts) and `transport/{graphql,http,schedule,message}/`.
- `be/src/modules/domain`: session (auth guard), task, share, plan, recur, notify, audit, upload; each owns its entities, migrations, `.sql.ts` constants and errors under `persistence/` and `errors/`.
- `be/src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security, i18n, logging, clock, primitives (Outcome), probes, observability, lease, scheduling, inbox, outbox, messaging.
- `be/src/modules/integrations`: keycloak, notify-smtp, sepay, upload (byte storage).
- `be/contracts/todo/schema.graphql`: the committed GraphQL contract; the front end reads it in place (`hfs.json` `sides.fe.reads`).
- `fe/apps/web/src`: Next.js routes, features, components, hooks and modules. The theme, the locale-aware navigation and the next-intl stack live in the app itself (`modules/theme`, `hooks/theme`, `hooks/navigation`, `modules/i18n`); there is no shared kit package.
- `scripts/`: `codegen.mjs` (the step behind `npm run codegen`) and `verify-captures.mjs` (replays the render evidence of the share invite screen).
- `.starciwork`: the product records of both sides; `be/docs/`: human verification guidance.

## Development

From this directory run `npm ci`, then `npm run typecheck`, `npm run lint`, `npm run build:be`, `npm run build:fe` and `npm test`.
The live stack requires provisioned demo secrets; see `be/docs/guides/testing.md` before running live checks.

The back end has four jest projects: unit specs are `<name>.service.spec.ts` beside each `*.service.ts` (`npm test`, per-file 100
percent coverage), and integration, e2e and contract specs under `be/src/tests/` run inside the one test world
(`npm run test:integration`, `npm run test:e2e`, `npm run test:contract`). Only unit runs in hooks and the default CI job. The
front end has no tests.

The front end's GraphQL documents are `.graphql` files next to the module that sends them; `npm run codegen` (run before build,
typecheck and lint) turns them into the ignored `fe/apps/web/src/modules/api/__generated__/documents.ts` the transport client
reads. The web app reads one environment variable, `NEXT_PUBLIC_API_GRAPHQL_URL` (the back end's GraphQL endpoint), only through
`fe/apps/web/src/modules/config`. It has no default: `npm run dev:fe` and `npm run start:web` need it set.

## Configuration and migrations

Every runtime value of the back end comes from the process environment through `EnvSource` (`.starcistacks/dev/runtime/env/KEYS.md` lists the keys). The database is the `primary`
connection: `PRIMARY_DB_URL`. Secrets and hosts have no default: a missing value stops the boot with an error that names the key. A secret may come from a
file named by `<KEY>_FILE`. Schema changes only by migration, owned by the capability whose table it is (`be/src/modules/{domain,platform}/<c>/persistence/migrations`),
listed by each owner index and concatenated by `be/apps/migrate` and the apps. Business code reads time through the injected `Clock` (specs use `FakeClock`),
side effects that must survive a crash go through the outbox in the same transaction (`outbox.enqueue(manager, message)`) and are consumed by the worker.

## Work

The app owns the product's [`.starciwork`](.starciwork/index.yaml) records for both sides. An implementation record names the
side its code lives in (`impl.task.be.task-list` beside `impl.task.fe.task-list`).

## Continuous verification

GitHub runs only the runtime repository's root workflows, so this app's own `.github/workflows/ci.yml` and `codecov.yml` (the
app-repository form `hfs sync` renders and the scaffold teaches) do not run here. The runtime's
`.github/workflows/examples.yml` runs every example app (its job matrix is derived from `examples/*/hfs.json` of kind app), so the
example's evidence comes from a declared GitHub-hosted runner rather than a developer's laptop:

- **records** - the runtime's own YAML loader and Work-tree layout gate over the examples' `.starciwork`, plus the fixture suite
  behind `scripts/checks/check-example-work.mjs`.
- **app** (push and pull request) - this app's type-check (both sides), `hfs lint` (`packages/hfs/bin/hfs.mjs lint`: `be/` with the
  BE canon, `fe/` with the FE canon, the architecture check; exit `0` clean, `1` findings, `2` a tool could not run), the unit
  tests with coverage, the Codecov upload under the flag `todo-app` (the runtime's root `codecov.yml`, the same services scope as
  this app's own file, 100 on the project and the patch), the front-end production build and the Sonar gate where a server is
  configured.
- **integration and e2e** (manual only: `workflow_dispatch` of the same workflow, input `layers`) - the test world starts the
  docker stack on the runner and runs `npm run test:integration` and `npm run test:e2e`.

The DEMO-ONLY age identity at `.starcistacks/dev/runtime/env/demo.agekey` is untracked under HFS secret
custody. A local operator must provision it before decrypting the committed `.enc` examples. The encrypted documents hold example values
only, and this identity must never protect a real credential (see
`.starcistacks/dev/runtime/env/KEYS.md`).

## Probes and metrics

`GET /health` answers the dependency-checked probe (200 ok / 503) and `GET /metrics` serves Prometheus text exposition of per-route request counters and durations.
Every request carries an `x-request-id` correlation id echoed on the response and written on one structured `http.request.completed` log line.
