Owner: knowledge/hfs/rules.yaml
# Services of one product

A product that runs more than one back-end service stays one repository, one `package.json` and one lockfile. This page is the
policy the `starci app check` rules R163 to R168 enforce and the way the reference example, `examples/ecommerce-app`, follows it.

The code requirements apply equally to lite and full. The database requirements below apply when the product declares Supabase.

- R254 `DB_BE_ONLY_ACCESS`: Supabase data goes through the back end; browser grants, policies and realtime publication membership require declared exceptions, with anonymous reads limited to `_public_read` policies.
- R255 `DB_APP_ROLE`: use one least-privilege application role without superuser, RLS bypass or broad grants, and force RLS on its tables unless a reasoned exemption is declared.
- R256 `DB_POLICY_HARDENING`: preserve RLS, reject tautological policies, protect exposed views and definers from browser roles, and scope private storage policies to an ownership prefix.
- R257 `DB_BASELINE_SHAPE`: retiring migrations requires exactly one marked active baseline in the same diff; archived history remains immutable and accepts no new archive-only migration.
- R258 `DB_QUEUE_CRON`: queue constants and migration-created pgmq queues agree; each uniquely named pg_cron tick has one owner and only enqueues work.
- R259 `DB_CONFIG_EXT`: allowlist extensions and exposed schemas, validate database and auth configuration and seed paths, exclude seed PII and SQL vault/password writes, and restrict destructive DDL to contract migrations.
- R260 `BE_JWT_ALG_PINNED`: JWT verification pins literal asymmetric algorithms, derives the issuer from configuration and rejects a Supabase principal whose role is not `authenticated`.
- R261 `BE_EDGE_HARDENING`: API apps apply an explicit CORS allowlist, security headers, disabled `x-powered-by` and a declared bounded trust-proxy policy.
- R262 `BE_HEALTH_READY`: API apps expose live and ready probes; readiness checks required dependencies with bounded timeouts, and Docker HEALTHCHECK reaches a real live route.
- R263 `BE_WEBHOOK_SCOPE`: signed-webhook reasons belong to verified webhook doors or declared verifiers, and inbox deduplication uses the delivery, event or message identifier.
- R264 `HFS_FEATURE_LOGIC_ROLE`: every feature-tier support role stays thin; branching and business logic belong in capability modules.
- R265 `BE_COMPOSITION_TYPED`: typed module, provider, queue and scheduler collections live in `compose/<area>.ts`, never in `main.ts`, environment or options files.
- R278 `BE_REST_DOOR_EVIDENCE`: each REST route carries evidence for an allowed exception to GraphQL, and public REST operations appear in the typed operations table in both editions.
- R279 `BE_THIRD_PARTY_OWNER`: vendor SDK ownership derives from package dependencies; SDK calls stay in their owning integration, with declared pure-library exceptions.
- R281 `BE_SPEC_FORM_ALL_ROLES`: every logic-role unit spec gets its subject from a providers-only TestingModule with doubles and asserts exact outcomes, without constructing the subject or mocking modules.

## One place for a service

Every back-end service is a Nest app at `be/apps/<service>/` (`main.ts`, `<service>.env.ts` for typed, fail-fast parsing,
`<service>.options.ts` for env-derived values and port bindings, `app.module.ts`, its `compose/<area>.ts` groups, its `Dockerfile`).
`main.ts` constructs the `EnvSource`; `<service>.env.ts` alone parses the app's environment through its interface and
`read<Service>Env(env: EnvSource)` using capability parse helpers. The env file holds no module composition, business code or
feature imports, and the options file holds no parsing. The apps
share the libraries under `be/src` (`features/`, `modules/{domain,integrations,platform}/`) and nothing else:

- a folder with a `Dockerfile` or a `package.json` of its own outside `be/apps/<service>/` is a second service root and a finding
  (`HFS_SERVICE_PLACEMENT`, R163);
- a file of one service app never imports a file of another service app (`BE_SERVICE_ISOLATION`, R168, ESLint
  `starci-be/service-isolation`): shared code moves to `be/src`, and services meet over the wire;
- every one-off action (migrate, seed, sync, backup, operator commands) is a command of the one `be/apps/cli` app, never an
  argument or script of a service.

Scheduled work is owned by the app's scheduler and queue, an enqueue-only pg_cron tick, or a declared replicated-job that runs
the CLI command. Production does not install host crontabs or host timers.

## Images

`.starcistacks/application-stacks.yaml` declares every service as a component with `role: service` (`HFS_SERVICE_STACK_DECLARATION`,
R165). Every `image` of a product with more than one service is pinned (`HFS_IMAGE_UNPINNED`, R164): a digest
(`name@sha256:...`) or an exact version (`x.y.z`), never a missing tag, `latest`, a branch word or a major-only tag.

- An own service image is `<repo>/<service>:<x.y.z>` and is built from `be/apps/<service>/Dockerfile` with the app root as the
  build context. The development Compose service names the image and its `build` block; the version in the tag is the version
  of the image. Production Swarm consumes the built images.
- In full, a service the product does not own (a database, an identity server, an object store) stays a third-party image in
  the declared stack, pinned the same way. Lite uses Supabase rather than self-hosted Postgres; a permitted database-backed
  sidecar uses SQLite on a declared persistent volume. The full test world reads every image from the stack definition, so a
  version is decided once.

## The contract between services

GraphQL is the default synchronous door in both editions. REST is limited to probes, auth handshakes, signed webhooks, byte
streams and the declared public v1 table; its evidence belongs to each route decorator, not to a class-level import or label.
When Supabase is declared, the front end uses it for Auth only and reads product data through the back end.

A synchronous API keeps its snapshot under `be/contracts/<service>/` (`schema.graphql`, `openapi.json`), emitted by `npm run
contract:emit` and judged for drift (R23) and by its consumers (R113). The messages a service publishes follow the same pattern:

```ts
// be/apps/order/src/events.ts - the literal table of the events the order service publishes
export const EVENTS = {
    "order.placed": { version: 1, payload: { orderId: "string", personId: "string", totalMinorUnits: "number" } },
} as const
```

`starci app emit` writes `be/contracts/order/events.json` (`starci/event-contract@1`) from it. A consumer states what it reads
in `be/apps/<app>/src/consumes.ts`:

```ts
export const CONSUMES = { order: { "order.placed": 1 } } as const
```

`HFS_EVENT_CONTRACT` (R166) refuses a snapshot that no longer equals the provider's table, a consumed event the provider's
snapshot does not declare, a version mismatch and an event that `compensates` an event no contract declares. A breaking change bumps the `version`; every consumer that has not
followed fails the check.

## Messages, idempotency, retries

Asynchronous messages travel on the Kafka topics of `platform/event-bus`; the topic of an event is the events topic of its service. A
publisher writes the outbox row in the transaction of its change, so the event exists exactly when the change commits, and the relay
hands it to Kafka after the commit. A consumer is a `transport/message/<event>.consumer.ts` of a worker app that
dispatches one command; the receiver dedupes on the event id, either with the inbox claim (R80) or because the effect is
idempotent by state (cancelling an order that is already cancelled changes nothing). A delivery that fails is delivered again
after an exponential backoff; a message that runs out of attempts stays in the dead letters of its topic, where an operator
command reads it.

## Sagas and compensation

A saga is a chain of services reacting to each other's events; the canon has no in-process event (R87). A product declares the
pattern (`"patterns": ["saga"]` in `hfs.json` `sides.be`), which enables the saga slots; a saga folder in a product that has not
declared it is `HFS_SLOT_NOT_ENABLED`. The saga is a feature of the saga kind (`knowledge/patterns/be/saga.yaml` lists every path with its slot):

```text
be/src/features/saga/<saga>/
  <saga>.saga.service.ts          the orchestrator: lists the steps and compensations, a service unit-tested beside it
  <saga>.saga-state.ts            the typed state of a run: status and the version fence
  <saga>.module.ts                its application module (handlers, orchestrator, steps, compensations)
  steps/<step>.saga-step.ts            one step: names its event; the domain does its work and announces the event
  compensations/<step>.compensation.ts   REQUIRED for every step: names the failure event, dispatches one command
  application/                    the commands the consumers and compensations dispatch
  transport/message/              the consumers that advance the run (<event>.consumer.ts) and its message module
```

The consumers (`transport/message/<event>.consumer.ts`) hand the delivery id to a command, and the saga takes every event through
the inbox. The state machine, the version fence and the inbox of a run are `platform/saga`: a run is started in the transaction of
the first step (`begin`), moved to `compensating` at the version it read when the failure event arrives, settled as `compensated`
once the compensation ran (a failing compensation gives the event back, so the redelivery resumes the run), or settled as
`completed` when the last step is confirmed. The failure of a step is an event whose contract declares `compensates: "<event of
the step it undoes>"`. Five checks keep it honest: `BE_SAGA_STEP_COMPENSATION` (R169), `BE_SAGA_STATE_VERSIONED` (R170),
`BE_SAGA_EVENT_CONTRACT` (R171), `BE_SAGA_CONSUMER_DEDUPE` (R172) and `BE_SAGA_E2E_MISSING` (R173: every compensation path has a full
e2e spec that names its event and injects a failure through the world). Lite proves its declared saga scenarios in the integration
lane (R284). In the example, `order.placed` starts the billing service's
invoice; when the invoice is above the limit `billing.invoice-rejected` (which compensates `order.placed`) makes the order service
cancel the order and release its stock, and `billing.invoice-issued` completes the run. The e2e spec
`order/invoice-rejected` also cuts the order database while the rejection is delivered and proves the compensation resumes on the retry.

## Specs

In full, every consumed event is named by an e2e spec, a file `be/src/tests/e2e/<area>/*.e2e-spec.ts` that boots the real apps through
`useTestWorld`, publishes the event, reads the persisted effect back and redelivers it (`BE_ASYNC_SPEC_MISSING`, R167). The spec of a
saga step also names the compensated event, so it drives the whole flow: the step, the failure, then the compensated state.
Sibling services run as real apps in the world, never as fakes; a third-party SaaS stays a fake at the network edge.
Lite proves declared asynchronous pattern scenarios in `be/src/tests/integration/<area>/*.integration-spec.ts` against the local
Supabase CLI stack; it has no e2e world.

## The reference example

`examples/ecommerce-app` runs four back-end apps: `identity` and `order` (GraphQL, calling each other), `billing` (consumes
`order.placed`, records an invoice, announces a rejection) and `migrate`; the order service also consumes `billing.invoice-rejected`, the compensating
step of its saga. Its e2e specs `billing/order-placed` and `order/invoice-rejected` prove the asynchronous path, the redelivery and
the compensation on the real stack; `integration/messaging` proves the queue adapter against Redis.
