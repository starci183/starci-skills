# Backend source pattern

This is the Nest/TypeScript implementation of the [portable responsibility pattern](portable-source-architecture.md) under [HFS](../knowledge/hfs/README.md). It is a design decision informed by source and framework contracts, not a claim that one folder tree is an industry standard. SRS owns behavior; SDS selects boundaries and deployment; implementation maps those boundaries to actual files. The rules are in `knowledge/patterns/be/*.yaml` and each cites the HFS rule ids it implements; this document explains how they fit together.

## One ownership model

An application composes a process. A feature orchestrates an externally meaningful use case. A module owns a cohesive domain, platform or provider capability. Transport adapts a protocol into a use case. Persistence adapts a named data store into the capability that owns the table. A class, file, database table or second consumer is not itself a reason to create another module.

This is the backend tree on every repository. `knowledge/hfs/slots.yaml` is its machine form, `knowledge/patterns/be/folder.yaml` (BE-FOLDER-1) and `knowledge/patterns/repo/folder.yaml` state it as law, and the checks report violations as `HFS_*` and `BE_*` codes. Create only folders with an actual responsibility:

```text
apps/<app>/src/                     # kind api | worker | migrate | cli, declared in hfs.json
  main.ts                           # reads EnvSource once, parses options, bootstraps, handles startup failure
  app.module.ts                     # AppModule.register(options): transport modules, capability modules, APP_GUARD, APP_FILTER
  <app>.options.ts                  # optional options type
  <app>.composition.spec.ts         # required: boots the REAL AppModule with stubbed options
src/
  features/<feature>/
    index.ts                        # explicit consumer API; no export-star collection
    <feature>.module.ts             # application module
    application/
      <action>.use-case.ts          # orchestration, authorization, transaction boundary
      <action>.contracts.ts         # protocol-neutral input/result
      <action>.use-case.spec.ts
    transport/
      http/<feature>-http.module.ts, <action>.controller.ts, dto/<action>.{request,response}.ts, <action>.mapper.ts
      graphql/<feature>-graphql.module.ts, <action>.resolver.ts, dto/<action>.{input,type}.ts
      message/<feature>-message.module.ts, <event>.consumer.ts       # opt-in, run by a worker app
      schedule/<feature>-schedule.module.ts, <job>.job.ts             # opt-in, run by a worker app
  modules/
    domain/<capability>/            # business invariants, owned state, errors/, persistence/, config, options
    platform/<capability>/          # config, logging, errors, primitives (required), database, scheduling, messaging, ...
    integrations/<provider>/        # external protocol/client, <provider>.config.ts, errors/, failure translation
  tests/{fixtures,e2e}/             # e2e/<area>/*.e2e-spec.ts, e2e/setup/ (containers, boot), e2e/live/<area>/ (opt-in)
contracts/<app>/schema.graphql      # opt-in committed contract
```

Within a capability use a narrow `index.ts`, `<name>.module.ts` when Nest registration is needed, `<name>.config.ts` and `<name>.options.ts` when it is configured, `errors/`, `persistence/`, meaningful services, policies and contracts, and colocated tests. A pure TypeScript library does not need a Nest module.

Tests come in two kinds (`knowledge/patterns/be/test.yaml` BE-TEST-1): unit `<name>.spec.ts` beside its subject, and e2e `*.e2e-spec.ts` under `src/tests/e2e/` with environment code in `src/tests/e2e/setup/`. E2E runs by hand: the default `tsconfig.json`, `typecheck`, lint, lint-staged and husky exclude `src/tests/e2e/**`; `typecheck:e2e` (`tsconfig.e2e.json`) runs before `test:e2e`; coverage and `test:ci` read the jest `unit` project only; any e2e CI job is `workflow_dispatch` only. The unit project maps no module into `src/tests/e2e/`.

Every backend repository is an `apps/<app>/` monorepo, including a single-application one: each deployable process composes in `apps/<app>/src` and nothing else lives there, while `src/features` and `src/modules` stay at the repository root and are shared by every app. Independently owned reusable packages sit in `packages/<capability>` and declare explicit exports; package extraction is justified by ownership, build and lifecycle, not by a wish to fill a `packages` folder. Topology never reverses dependencies.

## Dependency and contract boundaries

The direction is one matrix (BE-ARCHITECTURE-1). A feature imports domain, platform and integrations, and never another feature. A domain capability imports domain (acyclic), platform and integrations. An integration imports platform only. A platform capability imports platform only (acyclic). Apps import features and everything below. `import type` counts, every cross-owner import goes through the owner's `index.ts`, and a cycle between owners is a finding.

- A feature's transport imports its application contract. Application code never imports its transport DTO, request or session framework context, generated GraphQL type or response wrapper. Nest injection decorators are compatible with this rule; protocol semantics are not.
- A domain capability owns its invariants and its errors. An integration translates provider responses and errors into its own public contract and imports no domain. Platform contains generic runtime mechanisms and imports no domain or integration: a type that platform and domain both need moves down to platform or is passed through options.
- Serialization is an explicit projection. Do not return ORM entities or upstream SDK objects as the public contract. An explicit function is enough for identical plain data. Generated clients remain generated and are wrapped only where a protocol or domain boundary exists.
- Every feature and every transport module is composed by at least one app. Code that no app composes never runs.

### DTO means a boundary representation

`transport/http/dto/place-order.request.ts` or `transport/graphql/dto/place-order.input.ts` is owned by that adapter. Use runtime classes and decorators when the installed validation or GraphQL system relies on runtime metadata; an erased TypeScript interface cannot perform runtime validation. A GraphQL `ID` field alone does not validate UUID format, ownership, tenant, size or permitted state. Validate the constraints actually specified by the contract, including nested objects, unknown-field handling and a length bound on every string. Do not blindly enable coercion that changes meaning.

`application/place-order.contracts.ts` defines plain inputs and results: identifiers, bounded values, an authenticated principal (id and role) and explicit outcomes. Never pass an ORM user entity or raw token through every layer for convenience. A shared module owns its own contract and never reuses a feature DTO. Immutable message payloads are the default. Response nullability follows the actual API contract, not a universal wrapper.

### The smallest useful execution path

```text
validated transport input + verified principal
  -> useCase.execute(plain input, principal)
  -> authorize scenario and resource scope
  -> invoke capability API(s) under the selected transaction/effect policy
  -> plain result (typed union for expected outcomes)
  -> explicit transport projection
```

A direct injectable use case is the default. A resolver or controller performs protocol adaptation, not business decisions. Do not add a forwarding service between it and the use case to match a file inventory. A capability API may be called directly when it already is the whole scenario; do not invent an empty use case layer.

If the accepted design needs command and query dispatch, use `application/<action>.command.ts` or `.query.ts` and `.handler.ts`, and implement the installed bus interface. The handler owns the use case, so do not duplicate the logic in a service. CQRS separates mutation and read responsibilities. It does not inherently require separate databases, a message broker, event sourcing or eventual consistency; choose those only for an identified constraint and record the resulting consistency contract. [Nest CQRS](https://docs.nestjs.com/recipes/cqrs), [CQRS tradeoffs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).

## Module definition and dependency identity

A Nest module declares providers, controllers, imports and exports. A `ConfigurableModuleBuilder<Options>` module with a `static register(options)` defines a dynamic registration API and its options token; it is appropriate for caller-supplied configuration or intentionally distinct configured instances and always has a real options type. A normal static `@Module(...)` is the default when registration is fixed. Each transport has exactly one Nest module plus one application module per feature, never one module per operation. `@Global()` is allowed only on `platform/{config,logging,database}`. [Nest dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules).

```ts
// Static transport registration: one owner, explicit imports and providers.
@Module({
    imports: [OrdersModule],
    providers: [PlaceOrderResolver],
})
export class OrdersGraphqlModule {}

// Configurable capability: options have actual runtime meaning and arrive from parseOrdersConfig.
export interface OrdersOptions {
    readonly ttlSeconds: number
    readonly currency: string
}
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<OrdersOptions>().build()
```

These snippets illustrate registration responsibility, not a complete boot-tested project. Named databases, tenant or workspace instances and differently configured clients keep distinct tokens; a globally imported module does not make every instance interchangeable. The composition spec boots the real AppModule and resolves real tokens; direct construction with mocks cannot establish DI correctness.

## Schema, errors, logging, configuration, authentication, background work

**Schema authority** (`be/persistence.yaml`). Migrations are the only schema authority. `synchronize` is the literal `false` everywhere, including e2e databases, there is no runtime DDL, and `apps/migrate` is the only process that runs migrations, once per connection, before api and worker start. Entities and migrations live in `persistence/` of the capability that owns the table, `connection.ts` names one connection from `hfs.json`, each capability exports explicit `entities` and `migrations` lists, and the app composes them per connection. Raw SQL appears only in `<name>.repository.ts`.

**Errors** (`be/error.yaml`). `platform/errors` owns `DomainError` (stable `code`, `cause`), one HTTP filter, one GraphQL `formatError`, the transport-owned code to status table and the masking of undeclared errors. Each capability declares its errors in its own `errors/` folder. Expected outcomes are typed unions. A domain never throws a platform error, and every `catch` logs, rethrows or returns a typed outcome that carries the cause.

**Logging** (`be/logging.yaml`). `platform/logging` is mandatory: a `Logger` port with an enum identity and a structured payload. `console.*` and the Nest logger are forbidden.

**Configuration** (`be/config.yaml`). Only `platform/config` reads `process.env`. Each capability parses its own config into typed options in `<name>.config.ts`; `main.ts` reads the environment once and passes options to `AppModule.register(options)`. Secret keys and infrastructure URLs have no default, and a missing value stops boot with an error that names the key. Secrets exist only sealed at `.starcistacks/<env>/secrets/<slug>.enc`.

**Authentication** (`be/api-auth.yaml`). Default deny: `APP_GUARD` from `domain/identity`, and `@Public({ reason })` for every open operation. Webhooks verify a signature and compare with `timingSafeEqual`. No `unknown` body, no `GraphQLJSON`, no operation-name switch. Input strings are bounded, and the auth and webhook doors are rate limited.

**Background work** (`be/background.yaml`). A job (`transport/schedule/<job>.job.ts`) or a consumer (`transport/message/<event>.consumer.ts`) calls a use case exactly as a controller does, and only an app of kind `worker` composes it. A sweep, delivery, reconcile or retry method that no job or consumer calls is a finding.

## Data, authorization and durable effects

These are consequences of ownership, not mandatory subsystems in every project.

**Identity and authority.** The protocol guard authenticates credentials using the chosen provider contract, implemented in `domain/identity` over an `integrations` client. For JWT, verify allowed algorithms, issuer and intended audience; decoding is not verification. The use case or capability checks permission, resource ownership and tenant or workspace scope so jobs and alternative entry points cannot bypass a controller guard. A workspace header or request field is a selector, never proof of access. Service credentials identify a service and its granted scope, not an arbitrary end user. Cookie-based mutations need their specified CSRF protection; CORS is not authorization. [JWT BCP](https://www.rfc-editor.org/rfc/rfc8725.html).

**Transactions.** One use case or capability explicitly owns a local transaction. Every read and write in that atomic unit uses the same transaction-scoped connection or manager, not the injected outer manager. A real port is valid when it isolates a meaningful boundary and preserves transaction identity; a `Store.manager` escape hatch merely obscures it. Do not nest independent commits and label them atomic. Avoid network waits under a database lock; when an external effect is involved, specify the durable recovery boundary.

**Idempotency and concurrency.** Find-then-insert alone is not safe against two concurrent requests. Put the invariant in a unique constraint, an atomic conditional mutation or a lock, handle the conflict according to the API contract, and test two competing attempts. A request idempotency key is bound to principal or workspace, operation and request digest; a reused key with different content must not silently replay another result. Persist the effect and result relationship and the expiry policy. Do not claim `ON CONFLICT DO NOTHING RETURNING` always returns the pre-existing row; account for isolation and retry behavior. [PostgreSQL INSERT](https://www.postgresql.org/docs/16/sql-insert.html).

**Outbox and inbox.** When a database change must lead to a durable external message, write the outbox record in the same local transaction. The publisher job retries with bounded backoff and an effect identity; consumers deduplicate transactionally with their local effect where possible. A publish acknowledgement and a consumed business result are different facts. In-process event emission does not prove durable broker delivery, and an outbox alone is not exactly-once processing. Tables and migrations live in the owning platform capability's `persistence/`, the publisher is a `transport/schedule` job, the message schema and version live in its public contract. [Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

**Long-running coordination.** Use a persisted process manager or saga only when a scenario spans independent transactions or asynchronous effects needing recovery. Its owning capability defines versioned steps, durable progress, forward or compensation direction, retries and terminal or manual-recovery outcomes. The reusable runtime executes that definition; business compensation stays with the owning capability. Compensation is a new effect and can fail; it is not database rollback. Test crashes before and after the external effect and before and after its local acknowledgement. Nest's in-process `@Saga` stream is not by itself a persistent crash-recovery engine. [Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga).

**Lease and fencing.** Lease expiry permits a new claimant; it does not stop an old process. A monotonic execution token must be checked atomically by the resource that accepts the write. Updating a local record with a fence after an unfenced external API call does not fence that remote effect. If the provider cannot enforce fencing, use its idempotency or reconciliation contract, constrain overlap, and represent unknown effects explicitly before retry. Test a paused old worker resuming after reassignment; its stale writes and settlement must be rejected by the actual authority. [Fencing analysis](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html).

Configuration, startup, readiness, liveness and deployment ownership follow [runtime config and health](application-runtime-config-and-health.md). A remote application API follows [remote application API](remote-application-api.md); caller access, application rollout and cluster administration are separate responsibilities. None requires creating a cluster just to call an API.

## What enforcement proves

`node scripts/checks/architecture.mjs <repository>` resolves actual imports and checks the tier direction matrix, feature isolation, acyclic owners, thin app source roles, declared package exports, feature composition, transport placement and mechanically decidable filename and declaration forms. Unknown roles and dynamic decorator or name expressions are unavailable coverage rather than accepted exceptions. The checker does not infer error, persistence or capability ownership from a folder name beyond the slots; those remain design and behavioral review. `node scripts/checks/check-stales.mjs` compares canonical Work and bound source evidence. Scoped lint checks the selected project's installed rules and actual files. These are separate results, not a combined certificate of correctness.

Static analysis cannot prove cohesive ownership, complete public API design, DI identity, resource authorization, transaction isolation, idempotency, crash recovery or remote fencing. Those require the composition spec, contract tests, database-concurrency tests and failure-injection tests with evidence against the exact source and contract revision. Do not create all test categories for a pure helper; select them from actual effects and invariants. Missing proof is an explicit finding, not an inferred pass. Consuming this standard changes runtime guidance; it neither rewrites existing approvals nor marks stale product evidence current.
