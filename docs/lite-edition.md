Owner: knowledge/hfs/slots.yaml
# HFS lite edition

Lite is the full HFS code structure with its backing infrastructure supplied by Supabase (owner ruling 2026-10-13, recorded as R212 in
`knowledge/hfs/rules.yaml`). It uses the same manifest, rule catalog, lint canons, grammar,
security model and Docker canon as full, the same monorepo and code slots, the same patterns, the same back-end unit specs and the
same front end (`knowledge/hfs/fe-stack.yaml`). The `edition` field selects a
filtered slot and rule view; it does not select a different engine or relax rules locally.

Lite supplies its backing services through Supabase and keeps the same platform and integrations ports:

- persistence: the schema authority is `supabase/migrations`;
- queue: Supabase Queues (pgmq) behind the same `platform/queue` ports (outbox to queue, processors, retry and backoff by
  visibility timeout and `read_ct`, archive on dead letter); no BullMQ or Redis;
- event bus: pgmq-backed topics, or in-process delivery for a single api, behind the same `EventPublisher`/`EventConsumer`
  ports; no Kafka;
- realtime: the same socket.io gateway as full (`be.feature.realtime.websocket`), run inside the api process as one instance
  with no Redis adapter;
- cache and locks: Postgres (advisory locks or an unlogged table); no Redis;
- scheduling: an application-owned back-end scheduler, pgmq jobs or `pg_cron` ticks (with `pg_net`); a scheduled CLI batch may use a declared Swarm scheduler and replicated job;
- storage and auth: Supabase Storage and Supabase Auth (the back end verifies the access token against the project JWKS).

`knowledge/patterns/be/supabase-queues.yaml` owns the pgmq adapter, and each pattern topic carries its `liteAdapter`.

The front end is one standard for both editions (R212, owner ruling 2026-10-13): the browser calls the back end through the
Apollo clients and one file per operation in `fe.modules.api`, wrapped by the SWR hooks of `fe.hooks.swr`; forms are react-hook-form with zod
(`fe.hooks.rhf`), mutation outcomes go through `fe.modules.toast`, and `fe.modules.auth` is the only front-end importer of
Supabase, for the session and the access token only. The front end serves no API: no Server Action and no route handler beyond
health/live and `fe.route.callback` (R243). Heavy work is a mutation that enqueues a pgmq job (fenced job or saga), followed
through a status query that SWR polls or a socket namespace. Each concern's library is `knowledge/hfs/fe-stack.yaml`; a package it
forbids is refused (R244).

Tests: back-end unit specs are required exactly as in full (`ruleParams.be.unitRoles`, the logic roles at 100 per file, the
`@starci/jest-preset` doubles and builders). R272 requires a lite wiring and boot proof that compiles the Nest module graph
with doubles. R284 requires the declared pattern proofs in the integration-spec lane against
the local Supabase CLI stack (`starci supabase start`), with no toxiproxy and no containers of their own. Lite may also have
contract specs in `tests/contract` and a `test:contract` script. The e2e world and workflow (slot `app.ci-e2e`), stack tests
and browser runs remain full-only. The front end has no tests in either edition (R97).

Work: lite's `app.starciwork` slot holds only `.gitignore`, `workspace.yaml` and `brand/**` (ruling:R212/case-4, owner amendment
2026-10-14). Workspace metadata supplies the project id and repo roles that Work tools use to locate the app root and tie
brand records to the front end. Brand drawing records, references and assets keep their existing layout; brand tooling reads
the brand record directly. Full keeps its complete Work tree.

Use lite for a product whose backing infrastructure is Supabase; its api and sidecars still run on Docker Swarm on a VPS. Start with full when the product needs self-hosted backing services, the e2e world or
UAT records.

## Create a lite app

```sh
npx starci app scaffold <name> --edition lite
```

The scaffold creates the minimum live product and generates the `app.supabase.types` artifact from the app's local Supabase
stack. Docker must be available. If type generation fails, the command removes the app it began rather than leaving a partial
scaffold.

The lite scaffold creates `.gitignore` and `workspace.yaml` under `app.starciwork`, with the project id and repo roles used
by the full scaffold. It retains `brand/` only when present and creates no feature catalog, shell, feature, resource, UAT or
business-rule records there.

## The tree in words

The app is still one monorepo. The `app.sides` slot contains a back-end side and a front-end side. Lite starts with one
`be.app.api` owner and one `fe.app.next` owner. Lite may have multiple front-end apps and shared front-end packages as the
product grows.

Supabase is an app-level concern because both sides depend on it. `app.supabase.migrations` is the schema authority and
`app.supabase.types` is the committed generated contract of the back end. Data access belongs to the back end (the shared
`EntityManager` and `be.integrations.supabase`); the front end reaches it only through GraphQL, and `fe.modules.auth` holds the
Supabase auth client. The slot manifest remains the source for every concrete location.
The types file starts with the digest of the migrations it was generated from. The managed codegen step is offline: it
only compares that digest with the migrations and refuses missing or stale types, so lint, typecheck, build and CI need no stack.
Regenerating the types (`starci app emit`) is the one step that starts the local stack.

## Production delivery and secret custody

The optional `app.deploy` slot holds production delivery helpers, Caddy configuration, environment examples and operator shell
scripts. The `app.ci-deploy` and `app.ci-authorize-deploy-key` slots hold deployment and deploy-key authorization workflows;
`app.scripts.delivery` holds the lite app's helpers to build, sync environment settings and load or set secrets. The slot
manifest owns their concrete paths. Delivery files remain legal after an upgrade to full; operational helpers then use
`app.scripts`.

`app.starcistacks` under lite requires the application stack declaration and allows the production environment's Swarm stack,
runbook, environment record and sealed secret custody. The api, web, ingress and application sidecars run with
`runtime: docker-swarm` on the VPS; the manifest declares the Supabase project under
`backing: {supabase: {provider: supabase, managed: true}}`. The slot permits tracked, value-free `infra/swarm/**`; Compose,
Kubernetes and Terraform infra trees, runtime and seeds trees remain forbidden. Lite also refuses components whose images
duplicate Supabase-provided services (postgres, redis, kafka, keycloak, minio, rabbitmq, mysql or mongo).

The ingress is any declared ingress, Traefik or Caddy (the example uses Caddy); the check keys on `role: ingress`. A sidecar such as n8n
keeps its state in SQLite on a declared persistent volume, never in a self-hosted Postgres (owner ruling 2026-10-14).

Every Swarm service has a digest-pinned image, healthcheck, update policy with rollback on failure, rollback policy and restart
policy. Only the declared ingress publishes ports. Runtime secrets are external and versioned, materialized from the sealed
custody for the release. Recurring work is app-owned; workflows, deployment files, scripts and the stack tree must never install
a host crontab. A scheduled CLI command declares `mode: replicated-job`, its cron `schedule` and a `scheduler` component;
the stack declares `deploy.mode: replicated-job`, zero replicas, no restart and the matching swarm-cronjob labels. The scheduler runs as a
declared component. See [Scheduled work on Swarm](application-stacks.md#scheduled-work-on-swarm) for the manifest and stack
example. `starci app check` and `starci gate starcistacks` check these declarations and runtime policies.

Delivery files, including environment examples, remain subject to
R06 (`HFS_PLAINTEXT_SECRET`): use placeholders and runtime secret references, never plaintext credentials. R220 keeps sealed
material in the stack's secrets location and enforces the front-end and Supabase secret restrictions.

## Database, authentication and storage

R213 requires ordered, immutable, parseable migrations. R214 requires each exposed table to enable row-level security and to
declare its policies and grants in the same migration; dynamic DDL is forbidden so the checker can see every statement.

An existing app adopts the standard with one baseline: the live schema is dumped into one migration written to the current
standard and marked applied on production without a re-run, the older migrations move to `app.supabase.migrations.archive`
(never applied by the Supabase CLI and never judged by the migration rules), and new migrations append after the baseline.

The browser uses only the public URL, the anon key and the user's access token, and only through `fe.modules.auth`. R217 keeps
the front-end Supabase client to the auth API and the back-end client in `be.integrations.supabase` with generated `Database`
types. R219 requires the back end to take the principal only from an access token verified against the project JWKS; the back
end reaches Postgres through the shared `EntityManager` using a dedicated least-privilege application role.

Anything that must bypass RLS is a guarded back-end use case or a carefully scoped security-definer database function. The
service-role credential never enters the front-end process.

Storage buckets are private by default, bounded by size and MIME type, and protected by policies scoped to an ownership prefix.
Browser uploads use a signed upload URL the back end issues (an axios PUT from `fe.modules.api`); private downloads use signed
URLs. Small binaries the build bundles (fonts) live in `be.assets`, templates and copy in the `<x>.templates.ts` of the owning
domain capability, and large or user media in storage. Public buckets require an
explicit public name. Supabase Edge Functions are not part of lite.

## Add product capabilities

- `starci app add table <name> [--fe] [--no-types]` adds a migration and the matching back-end capability. `--fe` adds the
  front-end GraphQL operations and their SWR hooks. Types regenerate by default; `--no-types` deliberately skips that step.
- `starci app add cli <group>` creates the optional cli app on first use, including the built-in migration and seed groups, and then
  adds the requested group with the unit spec of each command beside it.
- `starci app add queue|job|reactor|saga|projection|realtime ...` refuses in lite with `LiteAdapterRefusal` before writing:
  the package carries only the full adapters. Write these patterns on the topic's `liteAdapter` in
  `knowledge/patterns/be/<topic>.yaml`; `knowledge/patterns/be/supabase-queues.yaml` owns pgmq, and realtime uses the
  in-process socket.io gateway.
- `starci app add webhook ...` writes the lite inbox intake. The intake transaction records the receipt and a typed outbox
  event; a reactor or job processes the delivery after commit (R263). Processing never runs inside the intake transaction.
- `starci app add app <name>` adds another front-end app from the lite skeleton and registers its workspace.
- `starci app emit` writes the enabled back-end snapshots and the `app.supabase.types` artifact. The local Supabase stack
  must be running for type generation.

An `add` or `new` command whose target slot is unavailable in lite stops before writing with `<verb> <noun>: full edition only`.
This is a capability boundary, not an allowlist of command names.

## Upgrade to full

First inspect the additions and the remaining full-edition findings:

```sh
starci app upgrade --edition full --plan
npx starci app check --edition full
```

The plan is read-only. The check also writes nothing; add `--db-types` when a local Supabase stack is running and a fresh types
comparison is required.

Apply the plan with:

```sh
starci app upgrade --edition full
```

The upgrade adds the full-only managed configuration (the e2e workflow and scripts), self-hosted backing-service declarations and the required cli
support. It does not rewrite product source or move the Supabase schema authority: swapping an adapter (pgmq to BullMQ, the
in-process socket.io gateway to one scaled with a Redis adapter) is a product change behind the same port. The first full check intentionally reports the e2e and
integration proofs the product still needs to author; the upgrade never creates placeholder tests. Downgrade from full to lite is
not supported.

## What lite forbids

ruling:R212/case-4 permits only `.gitignore`, `workspace.yaml` metadata and `brand/**` in `app.starciwork`. The feature catalog,
shell, features, resources, UAT and business-rule records are forbidden there; any other content fails with
`HFS_STARCIWORK_LITE_FORBIDDEN`: "lite .starciwork holds only workspace.yaml and brand/ (plus .gitignore)". Lite readers read
workspace metadata normally and skip the full-edition catalog, shell and feature indexes.

R212 also forbids e2e specs, the `test:e2e`, `test:stack` and
`test:browser` scripts, the e2e workflow, the browser journey and UAT records, test containers, toxiproxy and browser-runner
dependencies, BullMQ, Kafka, Redis and graphql-ws dependencies (and their imports, through the lite `infraOwners`), and the
non-Swarm `.starcistacks` infra trees, runtime and seeds trees, plus components duplicating Supabase backing services. Lite also
forbids Edge Functions. Contract specs and `test:contract` are allowed, and lite may have multiple front-end apps.

R213 to R216 forbid a second schema authority, dynamic database DDL, unsafe policies or definer functions, unchecked database
configuration and stale generated types. R217, R219 and R220 forbid Supabase access outside its owners (the front end auth only),
unverified principals, front-end service-role use and plaintext credentials. R243 and R244 hold in both editions: the front end
serves no API and uses only the libraries of `knowledge/hfs/fe-stack.yaml`.
