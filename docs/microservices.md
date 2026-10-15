Owner: knowledge/hfs/rules.yaml
# Services of one product

A product that runs more than one back-end service stays one repository, one `package.json` and one lockfile. This page is the
policy the `starci app check` rules R163 to R168 enforce and the way the reference example, `examples/ecommerce-app`, follows it.

The code requirements apply equally to lite and full. The database requirements below apply when the product declares Supabase.

- <a id="r254"></a>R254 `DB_BE_ONLY_ACCESS`: Supabase data goes through the back end; browser grants and policies require declared exceptions, with anonymous reads limited to `_public_read` policies. `DB_REALTIME_UNLISTED` refuses realtime publication membership without a declared direct-access exception.
- <a id="r255"></a>R255 `DB_APP_ROLE`: use one least-privilege application role without superuser, RLS bypass or broad grants. `DB_FORCE_RLS_DEFAULT` requires forced RLS on its tables unless a reasoned exemption is declared.
- <a id="r256"></a>R256 `DB_POLICY_HARDENING`: preserve the existing RLS obligation. `DB_POLICY_TAUTOLOGY` refuses policies without a meaningful principal boundary; `DB_VIEW_UNSAFE` requires exposed views to preserve caller access or revoke browser access; `DB_DEFINER_REVOKE` requires exposed definers to revoke authenticated execution; `DB_STORAGE_PREFIX` scopes private storage policies to a principal's ownership prefix.
- <a id="r257"></a>R257 `DB_BASELINE_SHAPE`: retiring migrations requires exactly one marked active baseline in the same diff. `DB_ARCHIVE_MUTATED` refuses changed archive history or a new archive-only migration.
- <a id="r258"></a>R258 `DB_QUEUE_CRON`: `DB_PGMQ_DECLARED` requires queue constants and migration-created pgmq queues to agree; `DB_CRON_OWNED` requires each uniquely named pg_cron tick to have one owner and only enqueue work.
- <a id="r259"></a>R259 `DB_CONFIG_EXT`: `DB_EXTENSION_ALLOWED` enforces the extension allowlist; `DB_API_EXPOSED` closes undeclared API schema access; `DB_MIGRATION_DESTRUCTIVE` confines destructive DDL to contract migrations without live references; `HFS_SEED_PII` refuses real personal email or phone literals in seeds; `DB_VAULT_WRITE` refuses SQL vault writes and role passwords. R216 continues to validate database and auth configuration and seed paths.
- <a id="r260"></a>R260 `BE_JWT_ALG_PINNED`: JWT verification pins literal asymmetric algorithms, derives the issuer from configuration and rejects a Supabase principal whose role is not `authenticated`.
- <a id="r261"></a>R261 `BE_EDGE_HARDENING`: `BE_CORS_ALLOWLIST` requires exact browser origins; `BE_SECURITY_HEADERS` requires platform response hardening and disabled `x-powered-by`; `BE_TRUST_PROXY` requires a declared nonnegative proxy hop count.
- <a id="r262"></a>R262 `BE_HEALTH_READY`: `BE_HEALTH_SIGNALS` requires distinct live and ready probes; `BE_READY_REAL` requires readiness to check a dependency with a bounded failure timeout; `HFS_DOCKER_HEALTHCHECK_FAKE` refuses an always-successful health command or a nonexistent live route.
- <a id="r263"></a>R263 `BE_WEBHOOK_SCOPE`: signed-webhook reasons belong to verified webhook doors or declared verifiers. `BE_WEBHOOK_INBOX_KEY` requires intake to deduplicate by the stable delivery identifier, commit its inbox receipt and typed outbox event, and hand processing to a reactor or job after commit.
- <a id="r264"></a>R264 `HFS_FEATURE_LOGIC_ROLE`: every feature-tier support role stays thin; branching and business logic belong in capability modules.
- <a id="r265"></a>R265 `BE_COMPOSITION_UNTYPED`: typed module, provider, queue and scheduler collections live in `compose/<area>.ts`, never in `main.ts`, environment or options files; ownership follows resolved types rather than names.
- <a id="r278"></a> R278 `BE_REST_DOOR_EVIDENCE`: each REST route carries evidence for an allowed exception to GraphQL in both editions. `BE_REST_ROUTE_UNDECLARED` refuses a public REST operation absent from the typed operations table.
- <a id="r279"></a> R279 `BE_THIRD_PARTY_OWNER`: vendor SDK ownership derives from package dependencies; SDK calls stay in their owning integration, with declared pure-library exceptions.
- <a id="r281"></a> R281 `BE_SPEC_FORM_ALL_ROLES`: every logic-role unit spec gets its subject from a providers-only TestingModule with doubles and asserts exact outcomes, without constructing the subject or mocking modules.
- <a id="r289"></a> R289 `BE_APP_ENV_REQUIRED`: each back-end app owns a typed `<app>.env.ts` reader and `main.ts` delegates environment reads to it. `BE_APP_MODULE_LIST_INLINE` requires the app module to spread its typed composition groups rather than declare an inline module list.
- <a id="r290"></a> R290 `BE_PUBLIC_REASON_CLOSED`: in lite and full, `PublicReason` has exactly `Health`, `AuthHandshake`, `SignedWebhook` and `CatalogRead`. An API-key or tool-token route authenticates through its own guard; it cannot add a public reason to bypass authentication.

## One place for a service

<a id="r163"></a>

R163 `HFS_SERVICE_PLACEMENT` applies to lite and full: keep service Dockerfiles in `be/apps/<service>/` and share the repository's package manifest.

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

<a id="r164"></a>

R164 `HFS_IMAGE_UNPINNED` applies to every component of a product with multiple back-end services in either edition. Exact version tags and SHA-256 digests pass; moving image references fail.

<a id="r165"></a>

R165 `HFS_SERVICE_STACK_DECLARATION` requires every API and worker app of that product to have a component with the same name and `role: service`, in lite and full.

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

## Pinned event compatibility

<a id="r177"></a>R177 `BE_CONTRACT_BREAKING` compares each service's `be/contracts/<service>/events.json`
with its published `events.pin.json` in lite and full. Keep every pinned event, stream, version, payload field,
type and optionality. Add optional fields or a new `<event>.v2` key beside the old event; removing a field or
adding a required one breaks consumers already using the published contract. Pins are service-owned release snapshots.

## Declared feature kinds

<a id="r179"></a>R179 `BE_KIND_DECLARATION` requires `hfs.json` `sides.be.kinds` to equal the kinds
present under `be/src/features/` in lite and full. Each used kind also declares its required patterns and tracks
their platform capabilities. `starci app add` creates the first member and registers those dependencies; unused
kind declarations, undeclared used kinds, missing patterns and missing capabilities fail the check.

<a id="r180"></a>R180 `BE_KIND_EMPTY` requires a kind folder to contain instance folders with TypeScript
source. A file directly under `be/src/features/<kind>/`, including `.gitkeep`, or a member containing only a
README fails in either edition. Keep populated members such as `jobs/send/transport/queue/send.processor.ts`.

## Messages, idempotency, retries

Asynchronous messages travel on the Kafka topics of `platform/event-bus`; the topic of an event is the events topic of its service. A
publisher writes the outbox row in the transaction of its change, so the event exists exactly when the change commits, and the relay
hands it to Kafka after the commit. A consumer is a `transport/message/<event>.consumer.ts` of a worker app that
dispatches one command; the receiver dedupes on the event id, either with the inbox claim (R80) or because the effect is
idempotent by state (cancelling an order that is already cancelled changes nothing). A delivery that fails is delivered again
after an exponential backoff; a message that runs out of attempts stays in the dead letters of its topic, where an operator
command reads it.

## Sagas and compensation

<a id="r169"></a>R169 `BE_SAGA_STEP_COMPENSATION` requires matching steps and compensations and an orchestrator importing every pair in both editions.

<a id="r170"></a>R170 `BE_SAGA_STATE_VERSIONED` requires an exported state type with `status` and a numeric `version`, and an orchestrator using the fenced `platform/saga` store in both editions.

<a id="r171"></a>R171 `BE_SAGA_EVENT_CONTRACT` requires literal step and compensation events in vendored contracts, with the compensation declaring the forward event it undoes in both editions.

<a id="r173"></a>

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

## Webhook and realtime doors

<a id="r182"></a>

`BE_WEBHOOK_SHAPE` (R182) keeps a provider's webhook HTTP file to one signed POST intake and an optional signed GET
challenge. The POST performs proof and one domain intake without branching or returning domain data; it returns empty or
the feature's declared literal `PROVIDER_ACK`. The GET echoes only its declared verifier result. Command dispatch belongs
after the durable receipt commits, in a reactor or job.

<a id="r183"></a>

`BE_WEBHOOK_UNVERIFIED` (R183) requires the first handler statement to complete the shared signature proof or declared domain
verifier, awaiting an async proof. An intake, a data read or argument evaluation that performs work before proof is refused.
The same ordering applies to a GET subscription challenge.

<a id="r184"></a>

`BE_REALTIME_SHAPE` (R184) requires one socket gateway or one GraphQL subscription resolver in the matching file role, with
only that protocol's subscription operations or authenticated server push streams. API queries, mutations and REST routes
belong in API features. Lite serves the socket.io gateway in its API process; GraphQL subscriptions belong to full.

<a id="r185"></a>

`BE_REALTIME_WRITES` (R185) permits a realtime door to inject only the platform `RealtimeHub`. Domain services, buses,
repositories and queues stay outside the door; reactors feed the hub after their own work commits.

<a id="r186"></a>

`BE_REALTIME_TOPIC_SCOPE` (R186) requires every hub subscription topic to use the handler's authenticated
`@CurrentPrincipal()` parameter, or the platform `Principal` supplied to a server push stream. A constant or client-only topic
does not establish the subscriber's ownership. These webhook and realtime boundaries apply in both editions.

## Specs

<a id="r167"></a>

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

## Backend implementation safety

These backend rules apply to both lite and full.

- <a id="r68"></a>R68 `BE_SQL_INTERPOLATED`: SQL values use numbered parameters. SQL text is never built from runtime values by interpolation or concatenation; the `sql` tag permits only checked `SqlIdent` substitutions for identifiers.
- <a id="r69"></a>R69 `BE_QUERY_UNBOUNDED`: reads that can return many rows state a visible bound or use cursor pagination. EntityManager list reads supply `take`; replace unbounded `findBy` and `findAndCountBy` calls with bounded options.
- <a id="r70"></a>R70 `BE_HTTP_TIMEOUT`: outbound fetch calls supply an abort signal, and axios or HttpService request configuration states a timeout or signal. An axios client created with `axios.create` also declares its deadline.
- <a id="r71"></a>R71 `BE_LOG_SECRET`: Logger arguments exclude `Secret` and `Pii` values and raw credential or personal identifier fields. Log an id, count or masked value. Constructed errors also exclude secret values and credential text.
- <a id="r72"></a>R72 `BE_TYPE_ESCAPE`: use typed call signatures and ordinary callbacks instead of the global `Function` type, `eval` or the `Function` constructor. The managed TypeScript rules also reject explicit `any`, non-null assertions and type assertions other than `as const`, including in specs.
- <a id="r73"></a>R73 `BE_ASYNC_NO_AWAIT`: an async implementation awaits work; otherwise remove `async`. The enforcer retains the declared Promise contract exemptions for framework lifecycle and interface methods.
- <a id="r74"></a>R74 `BE_MIGRATION_REVERSIBLE`: a TypeORM migration with `up()` declares a meaningful `down()` that reverses the change. An absent or empty body, or a body that only throws, does not provide a reversal.
- <a id="r75"></a>R75 `BE_RETURN_TYPE`: handlers and public methods of Injectable, Resolver and Controller classes declare their return type. Keep the result contract visible at the method boundary.
- <a id="r76"></a>R76 `BE_JSON_PARSE_UNGUARDED`: put `JSON.parse` inside a try block in the same function and return a typed failure outcome when parsing fails. A surrounding function, catch block or finally block does not guard a parse in its own right.
- <a id="r77"></a>R77 `BE_QUERY_IN_LOOP`: batch shared EntityManager reads before iterating, using the collected keys. Do not repeat a database read for each element of a loop or collection callback.
- <a id="r78"></a>R78 `BE_USER_COPY_LITERAL`: exception messages, notification text and response copy come from the capability messages catalog through the typed `MessageCatalog` port. Select a catalog entry instead of embedding user-facing text in source.
- <a id="r79"></a>R79 `BE_AMBIENT_CLOCK`: read time through the injected `Clock` port and use `FakeClock` in specs. Ambient `Date.now`, bare `new Date()`, `performance.now`, `process.hrtime` and `Temporal.Now` belong only in the platform clock implementation.
- <a id="r80"></a>R80 `BE_INBOX_DEDUPE_MISSING`: a delivery service claims the stable event id through the shared Inbox before other awaited work and returns early on a false claim. A receipt transaction claims first, records the receipt and writes its typed outbox event; processing and command dispatch follow commit.
- <a id="r81"></a>R81 `BE_HAND_ROLLED_RETRY`: use the shared platform retry helper for an operation that catches a failure, waits and tries again. Keep application loops free of handwritten retry scheduling.
- <a id="r82"></a>R82 `BE_TRANSACTION_EXTERNAL_CALL`: a transaction contains database work and same-transaction outbox publication. Commit before making external HTTP or other network calls, or record an outbox message for later delivery.
- <a id="r83"></a>R83 `BE_UNNAMED_DATA_ACCESS`: inject a declared connection through its named EntityManager injector and call that manager directly. Repository injection or wrapper classes, eager relations, unnamed entity tables and use of the outer manager inside a transaction are rejected. Keep DataSource and QueryRunner ownership within the permitted platform database, CLI and test-world surfaces.


## Back-end ownership checks

<a id="r40"></a>
### Logging

`BE_LOGGER_REQUIRED` requires the platform logging port and an accounted catch: handle the failure, rethrow it, or record it with its cause. Keep log event identity stable, put changing values in structured fields, and avoid framework loggers, interpolated messages and error wording used as event identity.

<a id="r41"></a>
### Default deny

`BE_DEFAULT_DENY` requires the app's default-deny `APP_GUARD`, explicit reasons for public doors, typed request bodies and timing-safe credential comparisons. Authentication belongs to the app guard chain rather than route-level `UseGuards` declarations.

<a id="r42"></a>
### Bounded input

`BE_INPUT_BOUNDED` requires input DTO fields to declare bounds appropriate to their types. Use cursor pagination instead of offsets, and give authentication handshakes and signed webhook doors their strict rate tier.

<a id="r43"></a>
### Configuration ownership

`BE_CONFIG_OWNER` confines environment reads and parsing to their declared configuration, boot and test-world owners. Parse configuration at boot and pass typed options into capabilities instead of reading the environment from a service.

<a id="r44"></a>
### Required secrets

`BE_SECRET_DEFAULT` refuses default arguments and fallback values for secrets and infrastructure URLs supplied by the configuration owner. Read the required value through `EnvSource` without a default so its absence stops boot and identifies the missing key.

<a id="r45"></a>
### Module composition

`BE_MODULE_SHAPE` requires owned capability and transport modules, typed module definitions and static registration. Keep global scope decisions at the app root, avoid cross-owner module imports and register each capability once. `BE_MODULE_HANDLER_REGISTRATION` requires transport handlers to be registered in their owning module, and `BE_MODULE_PROVIDER_REREGISTRATION` refuses registering a provider again outside its owner.

<a id="r46"></a>
### Owned background work

`BE_BACKGROUND_UNOWNED` requires every sweep, retry or outbox to have a job or consumer composed by an app. Keep the work in its owning service or compose a worker app when it needs independent scaling.

## Bounded contexts

<a id="bounded-context-coverage"></a>

Both lite and full identify a bounded context by its declared database connection.
`BE_CONTEXT_OWNER` (R174) refuses app composition or imports of another app's context;
CLI and migration apps compose every declared connection.
`BE_CONTEXT_COUPLING` (R175) refuses cross-context capability imports, entity relations
and migration foreign keys; connect contexts through events and store foreign IDs as plain columns.
`BE_CONTEXT_TRANSACTION` (R176) keeps each transaction on one connection and refuses
manager use or capability calls into another context; a saga coordinates their separate transactions.
`BE_CONTEXT_PLATFORM_TABLES` (R178) requires a per-connection platform capability's
entities and migrations on every connection whose manager its calls receive.

## SQL returning rows

<a id="r181"></a>

In lite and full, `BE_SQL_RETURNING_SHAPE` refuses a bare `UPDATE ... RETURNING` or `DELETE ... RETURNING` in a capability's
persistence SQL constant: `EntityManager.query` returns `[rows, affectedCount]` for those statements. Wrap the write in
`WITH changed AS (UPDATE ... RETURNING ...) SELECT ... FROM changed` to return rows instead. The same wrapper applies to a
deleting CTE; `INSERT ... RETURNING` and writes without `RETURNING` remain valid.
