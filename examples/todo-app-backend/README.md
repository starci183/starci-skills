# todo-app-backend

A NestJS todo API with Keycloak sign-in and a Postgres-backed task list.

## Overview

A NestJS domain-first example: sign-in through Keycloak, a Postgres-backed task list scoped by session
token. It owns the example's `.starciwork` and `.starcistacks/dev` (Postgres + Keycloak, realm `todo`,
demo user `demo@todo.dev`) - the runtime's own Work-layout and architecture checks run directly against
this tree, and `examples/todo-app-frontend` is proven against the records here rather than owning its own.

## Stack

NestJS, TypeScript, npm workspaces, PostgreSQL and Keycloak; the development services are declared
under `.starcistacks/dev`.

## Repository layout

- `apps/todo/src`: the api (`main.ts` parses the environment once, `app.module.ts` is `AppModule.register(options)`: every capability registered once with `isGlobal: true`, the three app guards in order rate limit, origin, auth).
- `apps/worker/src`: the worker (no listener): the scheduled jobs and the queue consumers of `src/features/todo/transport/{schedule,message}`.
- `apps/migrate/src`: the only process that applies migrations; run `npm run migrate` (or `migrate:dev`) before the api and the worker start.
- `src/features/{todo,health}`: `application/` (command/query + handler + contracts) and `transport/{graphql,http,schedule,message}/`.
- `src/modules/domain`: session (auth guard), task, share, plan, recur, notify, audit, upload; each owns its entities, migrations, `.sql.ts` constants and errors under `persistence/` and `errors/`.
- `src/modules/platform`: composition (injectors), config (EnvSource), cqrs, database, errors, graphql, http, http-security, i18n, logging, clock, primitives (Outcome), probes, observability, lease, scheduling, inbox, outbox, messaging.
- `src/modules/integrations`: keycloak, notify-smtp, sepay, upload (byte storage).
- `.starcistacks`: development stack declarations; `docs/`: human verification guidance; `.starciwork`: product records shared with the paired frontend.

## Development

From this directory run `npm ci`, then `npm run typecheck`, `npm run lint:check`,
`npm run build` and `npm run test:unit`. The live stack requires provisioned demo secrets;
see `docs/guides/testing.md` before running live checks. Tests have four jest projects: unit `*.spec.ts` beside the
source (`npm run test:unit`), and integration, e2e and contract specs under `src/tests/` that run inside the one test world
(`npm run test:integration`, `npm run test:e2e`, `npm run test:contract`). Only unit runs in hooks and the default CI job.

## Configuration and migrations

Every runtime value comes from the process environment through `EnvSource` (`.starcistacks/dev/runtime/env/KEYS.md` lists the keys). The database is the `primary`
connection: `PRIMARY_DB_URL`. Secrets and hosts have no default: a missing value stops the boot with an error that names the key. A secret may come from a
file named by `<KEY>_FILE`. Schema changes only by migration, owned by the capability whose table it is (`src/modules/{domain,platform}/<c>/persistence/migrations`),
listed by each owner index and concatenated by `apps/migrate` and the apps. Business code reads time through the injected `Clock` (specs use `FakeClock`),
side effects that must survive a crash go through the outbox in the same transaction (`outbox.enqueue(manager, message)`) and are consumed by the worker.

## Work

The backend owns the product's [`.starciwork`](.starciwork/index.yaml) records for both apps.

## Continuous verification

`.github/workflows/todo-app-example.yml` runs on every push/PR touching `examples/**`, `packages/**`,
`modules/schemas/**` or `scripts/checks/**`, so the example's evidence comes from a declared GitHub-hosted
runner rather than a developer's laptop:

- **records** - the runtime's own YAML loader and Work-tree layout gate over both example repositories,
  plus the fixture suite behind `scripts/checks/check-example-work.mjs`.
- **backend** - this repository's type-check, unit tests and the `nest` scoped-lint gate
  (`scripts/checks/check-scoped-lint.mjs`), which carries the architecture check as one of its machine
  kinds and whose exit code is the verdict: `0` clean, `1` findings, `2` unavailable.
- **frontend** - `examples/todo-app-frontend`'s type-check, unit tests, lint, production build and the
  same gate on the `next` profile.
- **live** (manual: `.github/workflows/todo-app-live-e2e.yml`, `workflow_dispatch` only, e2e) - brings up this example's real dev stack (Postgres + Keycloak) with the committed DEMO-ONLY
  SOPS secrets, builds and runs the real API and the real Next.js production server, proves sign-in,
  the uniform wrong-password/unknown-email refusal, the full task lifecycle, CORS and persistence across an
  API process restart with `curl` against the running services - never a mock - and then runs the
  Playwright UAT flows (`examples/todo-app-frontend/e2e`) against that same stack, uploading each run's
  `manifest.yaml`, `result.md`, screens and videos from the Work tree here as CI artifacts.

The DEMO-ONLY age identity at `.starcistacks/dev/runtime/env/demo.agekey` is untracked under HFS secret
custody. A local operator must provision it before decrypting the committed `.enc` examples; the live CI
job needs the same provisioned identity before it can run. The encrypted documents hold example values
only, and this identity must never protect a real credential (see `scripts/with-dev-secrets.mjs` and
`.starcistacks/dev/runtime/env/KEYS.md`).

## Probes and metrics

`GET /health` answers the dependency-checked probe (200 ok / 503) and `GET /metrics` serves Prometheus text exposition of per-route request counters and durations.
Every request carries an `x-request-id` correlation id echoed on the response and written on one structured `http.request.completed` log line.
