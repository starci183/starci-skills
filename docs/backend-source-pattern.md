# Backend source pattern

This is the adopted Nest/TypeScript implementation of the [portable responsibility pattern](portable-source-architecture.md), reviewed 2026-09-16. It is a design decision informed by source and framework contracts, not a claim that one folder tree is an industry standard. SRS owns behavior; SDS selects boundaries and deployment; implementation maps those boundaries to actual files. Existing Academy source supplies examples and counterexamples, not automatic authority.

## One ownership model

An application composes a process. A feature orchestrates an externally meaningful use case. A module owns a cohesive domain, platform, or provider capability. Transport adapts a protocol into a use case. Persistence adapts a named data store into its owning capability. A class, file, database table, or second consumer is not itself a reason to create another module.

Use this default tree for new source. Create only folders with an actual responsibility:

```text
apps/<app>/src/
  main.ts                         # startup, shutdown, process wiring
  app.module.ts                   # feature/module composition and app-wide adapters
src/
  features/<feature>/
    index.ts                      # explicit consumer API; no export-star collection
    <feature>.module.ts           # Nest registration
    application/
      <action>.use-case.ts         # orchestration, authorization, transaction boundary
      <action>.contracts.ts       # protocol-neutral input/result
      <action>.use-case.spec.ts
    transport/
      http/<action>.controller.ts # or graphql/<action>.resolver.ts, message/<event>.consumer.ts
      http/dto/<action>.request.ts
      http/dto/<action>.response.ts
      http/<action>.mapper.ts     # only if conversion has substance
  modules/
    domain/<capability>/          # reusable business invariants and owned state
    platform/<capability>/        # configuration, database, logging, health, runtime facilities
    integrations/<provider>/     # external protocol/client, validation, failure translation
  tests/{integration,fixtures,harness}/
```

Within a module use a narrow `index.ts`, `<name>.module.ts` when Nest registration is needed, meaningful services/policies/contracts, and colocated tests. An independently configurable module may add `<name>.module-definition.ts`. A pure TypeScript library does not need a Nest module. A database module can own `entities/` and `migrations/`; another persistence layout must still identify one connection, schema/migration owner, and transaction owner. Do not scatter schema ownership among feature transports.

For a standard single application the composition files may be `src/main.ts` and `src/app.module.ts`, with `src/features` and `src/modules` unchanged. In a package monorepo put each deployable process in `apps/<app>` and independently owned reusable packages in `packages/<capability>`; each package declares its explicit exports. Package extraction is justified by ownership/build/lifecycle, not by a wish to fill a `packages` folder. Configure the actual roots in `architecture.json`; topology never reverses dependencies.

The Academy transport-first `src/features/api/core/graphql/...` tree remains a mapped existing layout. New cohesive features use the domain-first layout above so HTTP, messages and GraphQL can call the same use case. A source transition is an authorized change with fresh evidence; installing this runtime does not move project files or bless existing violations.

## Dependency and contract boundaries

- Apps consume feature and module public APIs. Features consume module APIs. Modules never import features or apps. Features do not call another feature's private use case; share the owned capability or define an explicit orchestration owner.
- A feature's transport imports its application contract. Application code never imports its transport DTO, request/session framework context, generated GraphQL type or response wrapper. Nest injection decorators are compatible with this rule; protocol semantics are not.
- Across ownership boundaries use explicit public exports; inside one owner use relative paths. Keep runtime DI exports and TypeScript exports consistent. A public barrel must not expose all implementation files or create a cycle.
- A domain capability owns its invariants and errors. A technical integration translates provider responses/errors into its public contract. Shared platform errors contain generic error representation and mapping infrastructure, not every feature's policy.
- Serialization is an explicit projection. Do not return ORM entities or upstream SDK objects as the public contract. Avoid a redundant mapper class for identical plain data; an explicit function/projection is enough. Generated clients remain generated and are wrapped only where a protocol/domain boundary exists.

### DTO means a boundary representation

`transport/http/dto/create.request.ts` or `transport/graphql/dto/create.input.ts` is owned by that adapter. Use runtime classes/decorators when the installed validation/GraphQL system relies on runtime metadata; an erased TypeScript interface cannot perform runtime validation. A GraphQL `ID` field alone does not validate UUID format, ownership, tenant, size, or permitted state. Validate the constraints actually specified by the contract, including nested objects and unknown-field handling. Do not blindly enable coercion that changes meaning.

`application/create.contracts.ts` defines plain inputs/results: identifiers, bounded values, authenticated principal context, and explicit outcomes. Never pass an ORM user entity or raw token through every layer for convenience. A shared module owns its own contract; it must not reuse a feature DTO by importing upward. Immutable message payloads are the default; mutable deserialization classes may be used where the installed tooling requires them. Response nullability follows the actual API contract, not a universal `data: null` wrapper.

### The smallest useful execution path

```text
validated transport input + verified principal
  -> useCase.execute(plain input, principal)
  -> authorize scenario and resource scope
  -> invoke capability API(s) under the selected transaction/effect policy
  -> plain result
  -> explicit transport projection
```

A direct injectable use case is the default. A resolver/controller performs protocol adaptation, not business decisions. Do not add a forwarding service between it and the use case just to match a file inventory. A capability API may be called directly when it already is the whole scenario and there is no extra orchestration responsibility; do not invent an empty use case layer.

If the accepted design actually needs command/query dispatch, use `application/<action>.command.ts` or `.query.ts` and `.handler.ts`; implement the installed bus interface. The handler owns the use case, so do not duplicate the logic in a service. A base handler is justified by shared behavior, not an `execute -> process` forwarding method. Existing `ICQRSHandler` subclasses retain their real public `execute` contract until explicitly updated; do not bypass their inherited behavior.

CQRS separates mutation and read responsibilities. It does not inherently require separate databases, a message broker, event sourcing, or eventual consistency. Choose those only for an identified constraint and record the resulting consistency contract. A simple CRUD scenario does not gain correctness from additional bus classes. [Nest CQRS](https://docs.nestjs.com/recipes/cqrs), [CQRS tradeoffs](https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs).

## Module definition and dependency identity

A Nest module declares providers/controllers/imports/exports. A `module-definition.ts` using `ConfigurableModuleBuilder<Options>` defines a dynamic registration API and its options token. It is appropriate for caller-supplied configuration or intentionally distinct configured instances. A normal static `@Module(...)` is the default when registration is fixed. Do not generate an empty configurable module for every mutation. [Nest dynamic modules](https://docs.nestjs.com/fundamentals/dynamic-modules).

```ts
// Static feature registration: one owner, explicit imports and providers.
@Module({
  imports: [CartModule],
  providers: [AddToCartUseCase, AddToCartResolver],
})
export class CartFeatureModule {}

// Configurable provider boundary: options have actual runtime meaning.
export interface ControlplaneOptions {
  readonly baseUrl: string;
  readonly timeoutMs: number;
}
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } =
  new ConfigurableModuleBuilder<ControlplaneOptions>().build();
```

These snippets illustrate registration responsibility, not a complete boot-tested project. Validate options through the app configuration boundary before startup; inject secret credentials through custody-controlled providers, not source literals. Register genuinely app-wide infrastructure once. Named databases, tenant/workspace instances and differently configured clients must keep distinct tokens. A globally imported module does not make every instance interchangeable. Test the actual app container and exports; direct construction with mocks cannot establish DI correctness.

## Data, authorization and durable effects

These are consequences of ownership, not mandatory subsystems in every project.

**Identity and authority.** The protocol guard authenticates credentials using the chosen provider contract. For JWT, verify allowed algorithms, issuer and intended audience; decoding is not verification. The use case/capability checks permission, resource ownership and tenant/workspace scope so jobs and alternative entry points cannot bypass a controller guard. A workspace header or request field is a selector, never proof of access. Service credentials identify a service and its granted scope, not an arbitrary end user. Cookie-based mutations need their specified CSRF protection; CORS is not authorization. Keep credential handling in the integration/platform boundary and resource policy with its owner. [JWT BCP](https://www.rfc-editor.org/rfc/rfc8725.html).

**Transactions.** One use case or capability explicitly owns a local transaction. Every read/write in that atomic unit uses the same transaction-scoped connection/manager, not the injected outer manager. The Academy TypeORM profile uses the correct named `EntityManager` decorator; this is a profile choice, not an industry ban on repository abstractions. A real port is valid when it isolates a meaningful boundary and preserves transaction identity; a `Store.manager` escape hatch merely obscures it. Do not nest independent commits and label them atomic. Avoid network waits under a database lock; when an external effect is involved, specify the durable recovery boundary.

**Idempotency and concurrency.** Find-then-insert alone is not safe against two concurrent requests. Put the invariant in an appropriate unique constraint/atomic conditional mutation or lock, handle the conflict according to the API contract, and test two competing attempts. A request idempotency key is bound to principal/workspace, operation and request digest; a reused key with different content must not silently replay another result. Persist the effect/result relationship and expiry policy. Do not claim `ON CONFLICT DO NOTHING RETURNING` always returns the pre-existing row; account for database isolation and retry behavior. [PostgreSQL INSERT](https://www.postgresql.org/docs/16/sql-insert.html).

**Outbox and inbox.** When a database change must lead to a durable external message, write the outbox record in the same local transaction. The publisher retries with bounded backoff and an effect identity; consumers deduplicate transactionally with their local effect where possible. A publish acknowledgement and a consumed business result are different facts. In-process event emission does not prove durable broker delivery. Duplicate delivery remains possible, so an outbox alone is not exactly-once processing. Own tables/migrations in the data owner, publisher/consumer machinery in the messaging capability, and message schema/version in its public contract. [Transactional outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).

**Long-running coordination.** Use a persisted process manager/saga only when a scenario spans independent transactions or asynchronous effects needing recovery. Its owning capability defines versioned steps, durable progress, forward/compensation direction, retries and terminal/manual-recovery outcomes. The reusable runtime executes that definition; business compensation stays with the owning capability. Compensation is a new effect and can fail; it is not database rollback. Test crashes before/after the external effect and before/after its local acknowledgement. Nest's in-process `@Saga` stream is not by itself a persistent crash-recovery engine. [Saga pattern](https://learn.microsoft.com/en-us/azure/architecture/patterns/saga).

**Lease and fencing.** Lease expiry permits a new claimant; it does not stop an old process. A monotonic execution token must be checked atomically by the resource that accepts the write. Updating a local record with a fence after an unfenced external API call does not fence that remote effect. If the provider cannot enforce fencing, use its idempotency/reconciliation contract, constrain overlap, and represent unknown effects explicitly before retry. Test a paused old worker resuming after reassignment; its stale writes/settlement must be rejected by the actual authority. [Fencing analysis](https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html).

Configuration, startup/readiness/liveness and deployment ownership follow [runtime config and health](application-runtime-config-and-health.md). A remote application API follows [remote application API](remote-application-api.md); caller access, application rollout and cluster administration are separate responsibilities. None requires creating a cluster just to call an API.

## Source critique and adoption

Inspected Academy backend `1731b15ba4ed526477e3c572b9d82c31ab64f1d5`:

| Source observation | Adopted decision |
| --- | --- |
| `apps/core/src/app.module.ts` composes features, named databases and platform facilities | Retain thin composition and named identity; global registration is deliberate, not universal. |
| `src/features/api/core/graphql/mutations/courses/add-to-cart/` splits resolver, forwarding service, message, handler and dynamic module | Retain protocol/use-case separation; remove mandatory forwarding/template/dynamic-module boilerplate from the standard. |
| `src/modules/platform/cqrs/icqrs-handler.ts` forwards `execute` to `process` | Existing API remains supported; forwarding alone does not justify a mandatory base for new code. |
| `src/modules/databases/postgresql/primary/primary.module-definition.ts` has real typed database options | Valid configurable-module example; an empty-options feature definition is not equivalent. |
| Add-to-cart checks then saves; GraphQL request declares `ID`; response uses ORM entity | Those shapes do not prove concurrent idempotency, semantic validation or a safe public projection. Require the actual constraints and behavioral evidence. |
| `src/modules/bussiness/community/community-outbox-publisher.service.ts` claims a row, emits locally, then updates by id | Atomic outbox creation is useful; this source alone does not prove durable subscriber acknowledgement or stale-claim settlement rejection. |

Read-only Nivo saga inspection also found the external step precedes local fenced acknowledgement. That is a recovery case to investigate, not evidence that the remote resource honors the fence. This runtime change does not claim those product defects are repaired.

## What enforcement proves

`node scripts/checks/architecture.mjs <repository>` resolves actual imports and checks app/feature/module direction, thin app source roles, declared package exports, supported application/transport placement, statically identified TypeORM/GraphQL placement, and mechanically decidable filename/declaration forms. Unknown roles, dynamic decorator/name expressions and explicit `legacyRoots` entries are unavailable coverage rather than accepted exceptions. The checker does not infer error, persistence or capability ownership from a folder name; those remain design and behavioral review. `node scripts/checks/check-stales.mjs` compares canonical Work and bound source evidence. Scoped lint checks the selected project's installed rules and actual files. These are separate results, not a combined certificate of correctness.

Static analysis cannot prove cohesive ownership, complete public API design, DI identity, resource authorization, transaction isolation, idempotency, crash recovery or remote fencing. Those require applicable boot, contract, database-concurrency and failure-injection tests with evidence against the exact source/contract revision. Do not create all test categories for a pure helper; select them from actual effects and invariants. Missing proof is an explicit finding, not an inferred pass.

Existing profile-specific lint can conflict with a deliberately revised pattern (for example mandatory `process` handlers or centralized domain exceptions). Record that conflict and update the owning lint and source coherently within authorized scope, with regression cases. Do not disable a rule to manufacture a clean result. Installing this standard changes runtime guidance; it neither rewrites existing approvals nor marks stale product evidence current.
