# Backend source pattern

This is the Nest/TypeScript implementation of the [portable responsibility pattern](portable-source-architecture.md) under [HFS](../knowledge/hfs/README.md). It is the owner-locked back-end convention of 2026-09-30: one pattern per concern, no legacy and no second path. SRS owns behavior; SDS selects boundaries and deployment; implementation maps those boundaries to actual files. The rules are in `knowledge/patterns/be/*.yaml` and each cites the HFS rule ids it implements (the one catalog is `knowledge/hfs/rules.yaml`); this document explains how they fit together.

## One ownership model

An application composes a process. A feature exposes externally meaningful operations as CQRS commands and queries. A module owns a cohesive domain, platform or provider capability. Transport maps a protocol onto one bus dispatch. Persistence sits with the capability that owns the table and is reached through the shared `EntityManager` of one named connection. A class, file, database table or second consumer is not itself a reason to create another module.

This is the back-end tree of every app, under `be/` (all paths below are relative to `be/`, so `src/features` is `be/src/features` of the app). `knowledge/hfs/slots.yaml` is its machine form, `knowledge/patterns/be/folder.yaml` (BE-FOLDER-1) and `knowledge/patterns/repo/folder.yaml` state it as law, and the checks report violations as `HFS_*` and `BE_*` codes. Create only folders with an actual responsibility:

```text
apps/<app>/src/                     # kind api | worker | migrate | cli, declared in hfs.json sides.be.apps
  main.ts                           # at most 80 lines: builds EnvSource once, parses options, bootstraps, handles startup failure
  app.module.ts                     # at most 250 lines: AppModule.register(options), each capability once with isGlobal true, transports, APP_GUARD, APP_FILTER
  <app>.options.ts                  # the options type of the app
src/
  features/<feature>/
    index.ts                        # explicit consumer API; no export-star collection
    <feature>.module.ts             # application module: the handlers
    application/
      <action>.command.ts | <action>.query.ts   # typed Command<R> / Query<R> carrying one params
      <action>.handler.ts                       # extends ICQRSHandler, overrides process; thin, calls one service method, no spec
      <action>.contracts.ts                     # protocol-neutral request and result
    transport/
      graphql/<feature>-graphql.module.ts, <action>.resolver.ts, <action>.mapper.ts, dto/<action>.{input,type,args}.ts
      http/<feature>-http.module.ts, <action>.controller.ts, dto/<action>.{request,response}.ts   # webhooks, OAuth, health, byte streams only
      websocket/, message/, schedule/, cli/   # opt-in: <feature>-<protocol>.module.ts and the protocol files
    messages/<feature>.messages.ts  # opt-in: the feature's vi and en copy
  modules/
    domain/<capability>/            # business invariants, owned state: index.ts, module, module-definition, options, config, decorators, errors/, persistence/, services
    platform/<capability>/          # composition, config, errors, logging, clock, cqrs, database, ... each with its port and injector
    integrations/<provider>/        # index.ts, <provider>.config.ts, <provider>.decorators.ts, <provider>.client.ts, errors/
  tests/{world,fixtures,integration,e2e,contract}/   # world/ (the only infrastructure: global-setup, useTestWorld, fakes/<provider>/), integration/<capability>/, e2e/<area>/, contract/<provider>/
contracts/<app>/schema.graphql      # opt-in committed contract (hfs emit-contracts); the front end reads it in place
```

Nothing else exists at `src/` level, and no `types`, `constants`, `utils`, `helpers`, `shared`, `common`, `testing` or `exceptions` folder exists under `src/modules` or `src/features`. Within a capability create only what it owns: one `index.ts` at the root, `<c>.module.ts` and `<c>.module-definition.ts` when it registers providers, `<c>.config.ts` and `<c>.options.ts` when it is configured, `<c>.decorators.ts` for its injectors, `<c>.log-events.ts`, `errors/`, `messages/`, `persistence/`, services, policies, contracts and colocated service specs.

Tests come in four kinds by folder and suffix (`knowledge/patterns/be/test.yaml` BE-TEST-1): unit `<name>.service.spec.ts` beside its `<name>.service.ts` (only services are unit-tested; handlers, resolvers, controllers and consumers are thin and have no unit spec), integration `src/tests/integration/<capability>/*.integration-spec.ts`, e2e `src/tests/e2e/<area>/*.e2e-spec.ts` and contract `src/tests/contract/<provider>/*.contract-spec.ts`; the only test infrastructure is `src/tests/world/` (`useTestWorld`, network-edge fakes). Integration, e2e and contract run by hand: the default `be/tsconfig.json`, `typecheck` and husky exclude those trees; the root `typecheck:tests` (`be/src/tests/tsconfig.json`) runs before `test:integration`, `test:e2e` and `test:contract`; coverage and `test` read the jest `unit` project only, whose coverage is `src/**/*.service.ts` at per-file 100 (Sonar takes no coverage); any e2e CI job is `workflow_dispatch` only. The unit project maps no module into `src/tests/{world,integration,e2e,contract}/`.

The back end of every app is a `be/apps/<app>/` monorepo, including a single-application one: each deployable process composes in `be/apps/<app>/src` and nothing else lives there, while `be/src/features` and `be/src/modules` are shared by every back-end app. Independently owned reusable packages sit in `be/packages/<capability>` (npm workspaces of the app root) and declare explicit exports. Topology never reverses dependencies.

## Dependency and contract boundaries

The direction is one matrix (BE-ARCHITECTURE-1). A feature imports domain, platform and integrations, and never another feature. A domain capability imports domain (acyclic), platform and integrations. An integration imports platform only. A platform capability imports platform only (acyclic). Apps import features and everything below. `import type` counts, every cross-owner import goes through the owner's single `index.ts`, and a cycle between owners is a finding.

- A feature's transport imports its application messages and contracts. Application code never imports its transport DTO, request or session framework context, generated GraphQL type or response wrapper.
- A domain capability owns its invariants and its errors. An integration translates provider responses and errors into its own public contract and imports no domain. Platform contains generic runtime mechanisms and imports no domain or integration: a type that platform and domain both need moves down to platform or is passed through options.
- Serialization is an explicit projection. No ORM entity or upstream SDK object is a public contract; `ExecuteParams` carries a plain request and a `Principal`, never an entity.
- Every feature and every transport module is composed by at least one app. Code that no app composes never runs.

### DTO means a boundary representation

`transport/graphql/dto/place-order.input.ts` or `transport/http/dto/place-order.request.ts` is owned by that adapter. Use runtime classes and decorators, because an erased TypeScript interface cannot validate. A GraphQL `ID` field alone does not validate UUID format, ownership, tenant, size or permitted state. Validate the constraints the contract specifies under the global `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })`, with a `@MaxLength` on every string, `@IsEnum` on enums and `@ValidateNested() @Type(...)` on nested objects. `application/place-order.contracts.ts` defines the plain request and the handler's `<Action>Result`. A shared module owns its own contract and never reuses a feature DTO.

### The execution path

```text
transport: validated input + verified principal
  -> commandBus.execute(new PlaceOrderCommand({ request, principal }))    # InjectCommandBus(), the only injection of a transport
  -> PlaceOrderHandler.process: authorize scenario and resource scope, entityManager.transaction(async (manager) => ...)
  -> domain services take { manager, ... } and use manager; SQL is a SqlText constant of the owner's persistence folder
  -> Outcome<Value, Code> for expected refusals (returned) or a plain projection
  -> transport: unwrapOutcome(outcome, <C>Error) is the only place a refusal becomes a throw, then the mapper
```

A message is `Command<R>` or `Query<R>` from `@nestjs/cqrs` 11 with one `readonly params`; a handler `extends ICQRSHandler<Message, Result>` and overrides `process`, and the inherited `execute` logs `OperationFailed` and rethrows (BE-CQRS-1..4). There is no use-case class, no forwarding service between a transport and a handler and no in-process event: a side effect that must happen anyway is an outbox message written in the handler's transaction and consumed in `transport/message/`. CQRS separates mutation and read responsibilities; it does not inherently require separate databases, a message broker, event sourcing or eventual consistency. [Nest CQRS](https://docs.nestjs.com/recipes/cqrs), [CQRS tradeoffs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).

## Module definition, injection and dependency identity

A Nest module declares providers, controllers, imports and exports. Every capability module is `@Module({...}) export class XModule extends ConfigurableModuleClass {}` with a `<c>.module-definition.ts` built by `ConfigurableModuleBuilder<XOptions>` (a capability without options declares `XOptions = Record<string, never>`); the only registration method is `register`. Each capability has one representative module, registered exactly once per app in `apps/<app>/src/app.module.ts` as `X.register({ isGlobal: true, ...options.x })`. A representative may import its own sub-modules as plain `imports`; a sub-module is never registered in an app and has one importer. No module imports another capability's representative: other capabilities reach it only through its injectors. `isGlobal: true` appears only in app roots and `@Global()` nowhere. Feature modules are static: one application module and one module per transport, never one per operation. [Nest dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules).

Every infrastructure dependency (`EntityManager`, `CommandBus`, `Clock`, `Logger`, `Cache`, `HttpClient`, SDK clients, module options) is injected through a zero-argument `Inject<Thing>()` exported from its owner's `<owner>.decorators.ts`, built with `injector<T>(token)` over a `unique symbol` token (`knowledge/patterns/be/injection.yaml`). Raw `@Inject(` exists only in `*.decorators.ts`; `ModuleRef`, `forwardRef` and property injection are not used. Only a domain service of `src/modules/domain/**` is injected by class.

```ts
// Injector: name, type and token in one file.
export const CLOCK: unique symbol = Symbol("platform.clock")
export const InjectClock = (): TypedParameterDecorator<Clock> => injector<Clock>(CLOCK)

// Module: one representative, options through register.
@Module({})
export class PurchaseModule extends ConfigurableModuleClass {}
// apps/api/src/app.module.ts: PurchaseModule.register({ isGlobal: true, ...options.purchase })
```

These snippets illustrate responsibility, not a complete boot-tested project. One physical database is one connection with one injector (`Inject<Conn>EntityManager`), so a globally registered module never makes two databases interchangeable. The e2e world (`useTestWorld({ apps })`) boots the real AppModule and resolves real tokens; a unit spec of a service builds it from `Test.createTestingModule` with exactly its constructor dependencies.

## Schema, errors, logging, configuration, authentication, background work

**Persistence** (`be/persistence.yaml`). Migrations are the only schema authority. `synchronize` is the literal `false` everywhere, including e2e databases, there is no runtime DDL, and `apps/migrate` is the only process that runs migrations, once per connection, before api and worker start. Entities and migrations live in `persistence/{entities,migrations}/` of the capability that owns the table; migrations are `<epochMs13>-<kebab-name>.ts`; the owner's `index.ts` exports `<c>Entities` and `<c>Migrations`; the app composes them per connection. Data access is `this.entityManager.<op>(Entity, ...)` on the shared manager of one named connection, never a repository, `getRepository`, QueryBuilder or `TypeOrmModule.forFeature`. Raw SQL is a `sql`-tagged `SqlText` constant in `persistence/<name>.sql.ts`, row shapes are `<Name>Row` in `<name>.rows.ts`, and `.query()` accepts only `SqlText`. SQL writes only its own capability's tables, and every multi-row read is bounded.

**Errors** (`be/error.yaml`). `platform/errors` owns `DomainError`, the closed `ErrorKind`, the one kind-to-HTTP table, one REST filter and one GraphQL `formatError`, and masks every undeclared error. Each capability owns `errors/<c>.error.ts`: a code enum (`<CAPABILITY>_<WHAT>`), an exhaustive `Record<Code, ErrorKind>` table and one error class. Expected refusals are `Outcome` values, returned; exceptional failures are thrown as the capability error with a `cause`. A domain never throws a platform error, and every `catch` logs, rethrows or returns an outcome that carries the cause. Display text is resolved by code through the message catalog.

**Logging** (`be/logging.yaml`). `platform/logging` is mandatory: a `Logger` port injected with `InjectLogger()`, an enum identity from the owner's `<owner>.log-events.ts` and structured fields, written as JSON lines. `console.*`, the Nest logger and `winston` outside `platform/logging` do not exist.

**Configuration** (`be/config.yaml`). Only `platform/config` reads `process.env` through `EnvSource` and its typed readers. Each capability parses its own config into typed options in `<c>.config.ts`; `main.ts` builds `EnvSource` once and passes options to `AppModule.register(options)`, and classes read them with `Inject<C>Options()`. A secret, host, URL, remote port, bucket or database name has no default, and an optional integration is all-or-nothing. Secrets exist only sealed at `.starcistacks/<env>/secrets/<slug>.enc`.

**Authentication** (`be/api-auth.yaml`). Default deny: `APP_GUARD` throttler, CSRF origin guard and `AuthGuard` in that order, and `@Public({ reason: PublicReason.X })` for every open operation. Webhooks verify a signature and compare with `timingSafeEqual`. No `unknown` body, no `GraphQLJSON`, no operation-name switch. Input is validated and bounded, pagination is by cursor, and the auth and webhook doors are strictly rate limited.

**Background work** (`be/background.yaml`). A job (`transport/schedule/<job>.job.ts`) or a consumer (`transport/message/<event>.consumer.ts`) dispatches one command exactly as a resolver does, registered into `platform/scheduling` or `platform/messaging`, and only an app of kind `worker` composes it. A sweep, delivery, reconcile, retry or relay method that no job or consumer calls is a finding. Every consumer and signed webhook claims its event through `InjectInbox()` first.

**Infrastructure ownership** (`be/infra.yaml`). Each raw library (HTTP, cache, queue, scheduler, logger, date, config, events) is imported only by its one owning platform or integration capability; the rest of the code uses that capability's port. `HttpClient.request` requires `timeoutMs`.

## Data, authorization and durable effects

These are consequences of ownership, not mandatory subsystems in every project.

**Identity and authority.** The protocol guard authenticates credentials using the chosen provider contract, implemented in `domain/identity` over an `integrations` client. For JWT, verify allowed algorithms, issuer and intended audience; decoding is not verification. The handler or domain service checks permission, resource ownership and tenant or workspace scope so jobs and alternative entry points cannot bypass a guard. A workspace header or request field is a selector, never proof of access. Cookie-based mutations need the origin check; CORS is not authorization. [JWT BCP](https://www.rfc-editor.org/rfc/rfc8725.html).

**Transactions.** One handler explicitly owns a local transaction: `this.entityManager.transaction(async (manager) => ...)`. Every read and write in that atomic unit uses `manager`, never the injected outer manager, and a domain-service method that writes takes `manager` as a required field of its params so it joins the caller's transaction. Do not nest independent commits and label them atomic. No external call (HTTP, SDK, publish) runs inside a transaction; the effect goes through the outbox in the same transaction.

**Idempotency and concurrency.** Find-then-insert alone is not safe against two concurrent requests. Put the invariant in a unique constraint, an atomic conditional mutation or a lock (`lock: { mode: "pessimistic_write" }` or `FOR UPDATE` in a `.sql.ts`, `InjectAdvisoryLock()` across replicas), handle the conflict according to the API contract, and test two competing attempts. A request idempotency key is bound to principal or workspace, operation and request digest. [PostgreSQL INSERT](https://www.postgresql.org/docs/16/sql-insert.html).

**Outbox and inbox.** When a database change must lead to a durable external message, `InjectOutbox()` `enqueue(manager, message)` writes the outbox row in the same transaction and the `platform/outbox` job relays it with bounded backoff and an effect identity. Consumers deduplicate through the inbox (`inbox_claims`, unique on `(source, event_id)`, owned by `platform/inbox`) before they act. A publish acknowledgement and a consumed business result are different facts, and an outbox alone is not exactly-once processing. [Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

**Long-running coordination.** Use a persisted process manager or saga only when a scenario spans independent transactions or asynchronous effects needing recovery. Its owning capability defines versioned steps, durable progress, forward or compensation direction, retries and terminal or manual-recovery outcomes. Compensation is a new effect and can fail; it is not database rollback. Test crashes before and after the external effect and before and after its local acknowledgement. [Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga).

**Lease and fencing.** Lease expiry permits a new claimant; it does not stop an old process. A monotonic execution token must be checked atomically by the resource that accepts the write. If the provider cannot enforce fencing, use its idempotency or reconciliation contract, constrain overlap, and represent unknown effects explicitly before retry. Test a paused old worker resuming after reassignment; its stale writes and settlement must be rejected by the actual authority. [Fencing analysis](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html).

Configuration, startup, readiness, liveness and deployment ownership follow [runtime config and health](application-runtime-config-and-health.md). A remote application API follows [remote application API](remote-application-api.md); caller access, application rollout and cluster administration are separate responsibilities. None requires creating a cluster just to call an API.

## What enforcement proves

`node scripts/checks/architecture.mjs <repository>` resolves actual imports and checks the tier direction matrix, feature isolation, acyclic owners, thin app source roles, declared package exports, feature composition, transport placement and mechanically decidable filename and declaration forms. Unknown roles and dynamic decorator or name expressions are unavailable coverage rather than accepted exceptions. The eslint canon (`@starci/eslint-canon-be`) is type-aware: it identifies a receiver by its declared type and the slot of its declaration, never by a variable name or a path pattern. These are separate results, not a combined certificate of correctness.

Static analysis cannot prove cohesive ownership, complete public API design, DI identity, resource authorization, transaction isolation, idempotency, crash recovery or remote fencing. Those require the e2e world, contract tests, database-concurrency tests and failure-injection tests with evidence against the exact source and contract revision. Do not create all test categories for a pure helper; select them from actual effects and invariants. Missing proof is an explicit finding, not an inferred pass. Consuming this standard changes runtime guidance; it neither rewrites existing approvals nor marks stale product evidence current.
