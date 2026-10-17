# lite-app

<!-- >>> starci app sync (managed block; do not edit) >>> -->

[![CI](https://github.com/starci183/starci-skills/actions/workflows/examples.yml/badge.svg?branch=main)](https://github.com/starci183/starci-skills/actions/workflows/examples.yml)
[![Codecov](https://codecov.io/gh/starci183/starci-skills/branch/main/graph/badge.svg?flag=lite-app)](https://codecov.io/gh/starci183/starci-skills)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=starci183_starci-example-lite-app&metric=alert_status)](https://sonarcloud.io/dashboard?id=starci183_starci-example-lite-app)
[![Dependabot](https://github.com/starci183/starci-skills/actions/workflows/dependabot/dependabot-updates/badge.svg)](https://github.com/starci183/starci-skills/actions/workflows/dependabot/dependabot-updates)

<!-- <<< starci app sync <<< -->

One StarCi lite app: a Nest API in `be/`, one Next web app in `fe/`, and Supabase as the schema authority.

## Overview

The back end has the same slots, ports and patterns as the full architecture; its adapters use one managed Supabase project: PostgreSQL through the `primary` connection, Auth and Storage through the Supabase integration, and jobs on Supabase Queues (pgmq) in the same database. Production uses the tracked Docker Swarm model under `.starcistacks/production/infra/swarm/`; the VPS runs no primary database or host scheduler. Unit specs and the integration proof lane cover the application patterns; e2e and browser runs belong to the full edition.

The web app calls the API over GraphQL (`src/modules/api`, SWR hooks under `src/hooks/swr`, forms under `src/hooks/rhf`) and uses Supabase only for Auth in the browser (`src/modules/auth`, PKCE exchanged client-side); every data read and write goes through the API, which verifies the access token. The browser roles hold no table grant or policy: only the `app_be` role reaches the tables.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth, PostgreSQL and Queues, npm workspaces, and Turbo for front-end tasks.

## Repository layout

- `supabase/`: local configuration, forward-only SQL migrations, seed data, and generated database types.
- `be/`: the API, shared platform capabilities, verified identity admission, privileged Supabase integrations, and the queues.
- `fe/`: the web app; the only Supabase client is the Auth client of `src/modules/auth`, data goes through `src/modules/api`.
- `be/contracts/api/schema.graphql`: the emitted GraphQL contract the web app's codegen reads (`npm run contract:emit`).
- `.starcistacks/`: environment metadata, the production Swarm model, runbook, and declared sealed member names and key roster.
- `.starciwork/`: `.gitignore`, `.starciwork/workspace.yaml` project metadata and repo roles, and optional `.starciwork/brand/` drawing records, references, and assets.

## Development

```sh
npm install
npm run contract:emit
npm run typecheck
npm run lint
npm test
npm run build:be
npm run build:fe
```

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `CALENDAR_WEBHOOK_SECRET`, `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. The queue tunables `QUEUE_RELAY_INTERVAL`, `QUEUE_RELAY_BATCH`, `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL` and `QUEUE_VISIBILITY_TIMEOUT` are optional and have literal defaults. The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GRAPHQL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing configuration stops the relevant process with a named error; no template supplies credential defaults.

The public runtime tracks no encrypted members, including encrypted placeholders. Runtime CI, example render checks and specs use the runtime example materializer and sealed-member writer to prepare a disposable copy under `os.tmpdir()`, generate an ephemeral age identity and seal the declared members there. The copy and identity are removed afterwards. The CLI accepts only a disposable copy. A product copied from this example must initialize its own recipient and seal its real values before deployment; see `.starcistacks/production/README.md`.

## Tests

`npm test` runs the jest `unit` project with coverage: a `<name>.<role>.spec.ts` beside each unit role, built with `Test.createTestingModule` and the `@starci/jest-preset` doubles, and 100% lines, branches, functions and statements on every logic-role file under `be/src/modules`. `npm run test:integration` runs the fenced-job, queue and webhook collaboration proofs in `be/src/tests/integration/`. The lite edition may also declare contract proofs; e2e and browser projects stay full-only.

The integration lane requires a disposable local Supabase database with the committed migrations applied. Supply
`PRIMARY_DB_URL` for the local migration-owner connection and `PRIMARY_DB_SCHEMA`; the cron registration proof and
fixture cleanup need that local owner's privileges. Each fixture refuses a non-local database address. Job proofs
roll back their writes; queue and webhook proofs clean only their uniquely named fixture records. Production
processes continue to use the least-privilege `app_be` connection.

## Queues

`be/src/modules/platform/queue` has the ports of the full example (`QueueOutbox`, the relay, the worker registry, the retry policy) over a pgmq transport. A producer writes its job in its own business transaction: one row of `public.queue` and one `pgmq.send`, both on the `primary` connection, so the job exists exactly when the change commits. Workers read with a visibility timeout, archive a completed message, make a failed one visible again after a backoff that doubles with its read count, and archive it as dead after five attempts. Jobs run through the fence of `be/src/modules/platform/jobs` exactly as in full: the runner claims each delivery in `public.jobs` (the claim bumps the fencing token), the step records itself under that token before its effect, and a worker that lost its claim is fenced out. The example job is `confirm-booking`: the `createBooking` mutation answers a `pending` booking at once and enqueues the job, the processor of the `booking_confirmation` queue marks it `confirmed`, and the web app polls the `bookingStatus` query until it is.

## Database changes

Create a forward-only migration under `supabase/migrations`, keep each table's RLS policies and grants beside the table, and run `npm run contract:emit` to refresh `supabase/types/database.types.ts` and `be/contracts/api/schema.graphql`; `npm run codegen:graphql` regenerates the web app's wire types from the contract. A new queue is a `pgmq.create` in a migration plus the `app_be` grants on its `pgmq.q_<queue>` and `pgmq.a_<queue>` tables.

## Work

Brand records live in `.starciwork/brand/`. `.starciwork/workspace.yaml` supplies the project id and repo roles so Work tools
can locate the app root and map brand records to the front end. Lite permits this metadata without brand records; the tree
is required only when brand records exist, and workspace metadata remains optional.
