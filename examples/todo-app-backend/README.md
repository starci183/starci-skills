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

- `apps/todo/src`: the api process (startup and Nest module composition).
- `apps/migrate/src`: the only process that applies migrations; run `npm run migrate` (or `migrate:dev`) before the api starts.
- `src/features` and `src/modules/{domain,platform,integrations}`: shared backend source.
- `.starcistacks`: development stack declarations; `docs/`: human verification guidance.
- `.starciwork`: product records shared with the paired frontend.

## Development

From this directory run `npm ci`, then `npm run typecheck`, `npm run lint:check`,
`npm run build` and `npm run test:unit`. The live stack requires provisioned demo secrets;
see `docs/guides/testing.md` before running live checks. Tests are exactly two kinds: unit `*.spec.ts` beside the
source (`npm run test:unit`) and e2e `*.e2e-spec.ts` under `src/tests/e2e/` (`npm run test:e2e`, for example
`npm run test:e2e -- task/task-lifecycle`). E2E runs manually only: no hook, default typecheck/lint, coverage or automatic CI job runs it (`npm run typecheck:e2e` is its manual type check).

## Configuration and migrations

`DATABASE_URL`, `REDIS_URL`, `KEYCLOAK_TOKEN_URL` and `SEPAY_BASE_URL` have no default: a missing value stops with an error that names the key.
A secret comes from a decrypted file named by a `*_FILE` variable (`UPLOAD_SIGNING_SECRET_FILE`, `SEPAY_API_KEY_FILE`,
`SEPAY_WEBHOOK_SECRET_FILE`); a variable that is set but names an unreadable file also stops with its name. Schema changes only by
migration under `src/modules/platform/databases/persistence/migrations`, listed explicitly from `persistence/index.ts`.
Business code reads time through the injected `Clock` (`src/modules/platform/clock`; specs use `FakeClock`) and user-facing
copy through the messages catalog (`src/modules/platform/i18n` and `src/features/todo/messages`).

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

`GET /health` and `GET /ready` answer the dependency-checked Postgres probe (200 ok / 503), and
`GET /metrics` serves Prometheus text exposition of per-route request counters and durations. Every
request carries an `x-request-id` correlation id echoed on the response and written on one structured
`http.request.completed` log line. See `docs/guides/testing.md` for the exact commands and how the dev stack's
Prometheus service scrapes the api.
