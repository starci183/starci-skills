# lite-app

One StarCi lite app: a Nest API in `be/`, one Next web app in `fe/`, and Supabase as the schema authority.

## Overview

Lite is the full architecture minus infra. The back end has the same slots, ports and patterns as the full example (`examples/ecommerce-app`); only the adapters are simpler, because everything runs on one managed Supabase project: PostgreSQL through the `primary` connection, Auth and Storage through the Supabase integration, and jobs on Supabase Queues (pgmq) in the same database. There is no compose, k8s or terraform tree, no test world and no e2e run; unit specs are the same as full.

The web app calls the API over GraphQL (`src/modules/api`, SWR hooks under `src/hooks/swr`, forms under `src/hooks/rhf`) and uses Supabase only for Auth in the browser (`src/modules/auth`, PKCE exchanged client-side); every data read and write goes through the API, which verifies the access token. The browser roles hold no table grant or policy: only the `app_be` role reaches the tables.

## Stack

TypeScript everywhere, NestJS in `be/`, Next.js with next-intl in `fe/`, Supabase for Auth, PostgreSQL and Queues, npm workspaces, and Turbo for front-end tasks.

## Repository layout

- `supabase/`: local configuration, forward-only SQL migrations, seed data, and generated database types.
- `be/`: the API, shared platform capabilities, verified identity admission, privileged Supabase integrations, and the queues.
- `fe/`: the web app; the only Supabase client is the Auth client of `src/modules/auth`, data goes through `src/modules/api`.
- `be/contracts/api/schema.graphql`: the emitted GraphQL contract the web app's codegen reads (`npm run contract:emit`).
- `.starcistacks/`: value-free environment metadata and encrypted-secret custody only (no infra).
- `.starciwork/brand/`: optional brand drawing records, references, and assets; `.starciwork/` holds only this tree and `.gitignore`.

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

The API reads `PORT`, `HTTP_SECURITY_ALLOWED_ORIGINS`, `PRIMARY_DB_URL`, `PRIMARY_DB_SCHEMA`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. The queue tunables `QUEUE_RELAY_INTERVAL`, `QUEUE_RELAY_BATCH`, `QUEUE_CONCURRENCY`, `QUEUE_POLL_INTERVAL` and `QUEUE_VISIBILITY_TIMEOUT` are optional and have literal defaults. The web app reads `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GRAPHQL_URL`, `NEXT_PUBLIC_REST_URL`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Missing configuration stops the relevant process with a named error; no template supplies credential defaults.

## Tests

`npm test` runs the jest `unit` project with coverage: a `<name>.<role>.spec.ts` beside each unit role, built with `Test.createTestingModule` and the `@starci/jest-preset` doubles, and 100% lines, branches, functions and statements on every logic-role file under `be/src/modules`. Lite has no test world, so there is no integration, e2e or contract project.

## Queues

`be/src/modules/platform/queue` has the ports of the full example (`QueueOutbox`, the relay, the worker registry, the retry policy) over a pgmq transport. A producer writes its job in its own business transaction: one row of `public.queue` and one `pgmq.send`, both on the `primary` connection, so the job exists exactly when the change commits. Workers read with a visibility timeout, archive a completed message, make a failed one visible again after a backoff that doubles with its read count, and archive it as dead after five attempts. Jobs run through the fence of `be/src/modules/platform/jobs` exactly as in full: the runner claims each delivery in `public.jobs` (the claim bumps the fencing token), the step records itself under that token before its effect, and a worker that lost its claim is fenced out. The example job is `confirm-booking`: the `createBooking` mutation answers a `pending` booking at once and enqueues the job, the processor of the `booking_confirmation` queue marks it `confirmed`, and the web app polls the `bookingStatus` query until it is.

## Database changes

Create a forward-only migration under `supabase/migrations`, keep each table's RLS policies and grants beside the table, and run `npm run contract:emit` to refresh `supabase/types/database.types.ts` and `be/contracts/api/schema.graphql`; `npm run codegen:graphql` regenerates the web app's wire types from the contract. A new queue is a `pgmq.create` in a migration plus the `app_be` grants on its `pgmq.q_<queue>` and `pgmq.a_<queue>` tables.

## Work

Brand records live in `.starciwork/brand/`. A lite app needs no `.starciwork/` until it has brand records.
