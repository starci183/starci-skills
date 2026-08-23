# Backend pattern context router

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@source-references` | `compilers/patterns/source-references/context.md` | context | resolve immutable StarCi backend precedent before a backend pattern invents a shared module or operation family |

## Record

This file routes an accepted backend shape to the smallest binding runtime context. Load only the
matching child `context.md` files. A directory target does not authorize loading every child, and
`en.md` and `vi.md` are publication records rather than runtime inputs.

## Routes

Child contexts are lazy routes, not eager dependencies.

| Module | Target | Load when the accepted shape contains | Do not load for |
|---|---|---|---|
| `api-evolution` | `compilers/patterns/be/api-evolution/context.md` | additive compatibility, explicit breaking-version negotiation, deprecation/removal lifecycle, stable public error/enum/pagination contracts or compatibility contract tests | internal refactoring with no public contract change |
| `async-work` | `compilers/patterns/be/async-work/context.md` | a serializable/versioned job, worker ack/retry/DLQ, bounded attempts/backoff or scheduler lease/due-time/no-overlap | in-process CQRS dispatch, broker event delivery or request-time retry |
| `authorization` | `compilers/patterns/be/authorization/context.md` | authenticated identity, a guarded handler or resolver, row ownership, refusal disclosure, entitlement state or operator-versus-user authority | authentication mechanics alone, validation, or a public operation with no authorization decision |
| `cache` | `compilers/patterns/be/cache/context.md` | canonical cache keys, derived-data authority, mutation invalidation or TTL/stale/error policy | database ownership, HTTP cache headers alone or an incidental in-memory map |
| `cdc` | `compilers/patterns/be/cdc/context.md` | a Kafka change-data-capture consumer, source-table declaration, projection recomputation, tombstone handling or consumer failure isolation | ordinary domain events, request-time queries or non-CDC Kafka messaging |
| `comments` | `compilers/patterns/be/comments/context.md` | new or changed exports, enum members, exceptional mechanics, source-language prose or a string that may be mistaken for documentation | reader-visible copy, naming alone or prose outside source |
| `concurrency` | `compilers/patterns/be/concurrency/context.md` | contested-state serialization, optimistic version/CAS, lock/isolation policy or a race-proof test | ordinary transaction propagation, event digest dedupe or retry policy |
| `configuration` | `compilers/patterns/be/configuration/context.md` | schema-validated startup config, raw environment reads, required/default/secret policy, fail-closed startup or immutable typed configuration | secret custody/projection, port allocation or ordinary domain input |
| `cqrs` | `compilers/patterns/be/cqrs/context.md` | a command/query/event operation, its folder, message, handler, dispatching service, domain failure or colocated spec | transport selection, generic service methods or event transport mechanics |
| `data-access` | `compilers/patterns/be/data-access/context.md` | a database handle, entity/table mapping, transaction boundary, secondary write or relation-loading query | business orchestration with no persistence decision or cache/storage outside the database layer |
| `delivery-assurance` | `compilers/patterns/be/delivery-assurance/context.md` | hook, CI, coverage, analysis, credential or deploy-fence adoption for a backend | feature implementation with an already-green complete delivery fence |
| `domain-modeling` | `compilers/patterns/be/domain-modeling/context.md` | aggregate invariant ownership, a value-object boundary, lifecycle transition authority, a cross-aggregate domain service or persistence/domain mapping | transport validation syntax, module placement, transaction mechanics or naming alone |
| `e2e-flow` | `compilers/patterns/be/e2e-flow/context.md` | a real business flow, named steps, polling, realtime observation, absence proof, actor setup, operational chain or external-result override | unit/integration branch coverage or an isolated provider harness |
| `event-delivery` | `compilers/patterns/be/event-delivery/context.md` | an event crossing process instances, a producer envelope, transport declaration, self-drop, digest claim, recipient/content assertion or two-instance proof | in-process events or CDC projection consumption |
| `exception-identity` | `compilers/patterns/be/exception-identity/context.md` | defining or renaming an exception class, wire code, metadata type or status-independent failure identity | deciding where failures live or how callers construct them without changing identity |
| `exceptions` | `compilers/patterns/be/exceptions/context.md` | throwing, placing or constructing a domain failure, choosing its base class or metadata payload | test-runner assertions, transport status mapping or identity naming alone |
| `files-media` | `compilers/patterns/be/files-media/context.md` | binary/metadata separation, size/MIME/content validation, storage-key tenant ownership, signed transfer capabilities or lifecycle/orphan cleanup | transport selection alone or generic data persistence |
| `idempotency` | `compilers/patterns/be/idempotency/context.md` | caller/job idempotency keys, durable claim-before-effect, replayed results, scope/retention/error semantics or one-effect proof | CDC/event digest dedupe or generic retry mechanics |
| `integration` | `compilers/patterns/be/integration/context.md` | feature-to-port boundary, provider protocol/auth adapter, provider data/error translation or adapter lifecycle registration | transport door selection, event delivery or domain policy |
| `maintainability` | `compilers/patterns/be/maintainability/context.md` | orchestration mixed with decision trees, several reasons to change, semantic duplication, volatile outcome facts, repeated normalization, contradictory lifecycle booleans, analyzer findings or authored/generated provenance | naming, module placement, test-case selection, lint detection mechanics or provider quality-gate configuration owned by their focused modules |
| `module-layering` | `compilers/patterns/be/module-layering/context.md` | choosing an import path, public surface, capability dependency, composition-root wire or cross-feature edge | naming a symbol after its file boundary is settled or data flow inside one module |
| `naming` | `compilers/patterns/be/naming/context.md` | choosing a path, filename, type/function/boolean/export name or capability vocabulary | placement/import boundaries, reader-visible wording or exception wire identity governed separately |
| `observability` | `compilers/patterns/be/observability/context.md` | logging, event-name enums, structured metadata, decision/failure telemetry, standalone stdout/stderr or telemetry process lifecycle | domain events, test output or exception construction without a log decision |
| `performance` | `compilers/patterns/be/performance/context.md` | bounded pagination/projection, hidden N+1/eager loading, index/plan evidence or explicit latency/resource budgets | cosmetic micro-optimization without measured workload evidence |
| `port-offset` | `compilers/patterns/be/port-offset/context.md` | Source family allocation, application slots, backend service declarations, resolved port projections or frontend/runtime port consumers | a one-off external endpoint that never binds on the Source host, or container-internal ports with no host publication |
| `testing` | `compilers/patterns/be/testing/context.md` | choosing a test lane, business story, consequence assertion, decision-branch coverage, e2e access path, provider harness or demo seed | production implementation or the detailed step mechanics of an accepted e2e flow |
| `transport` | `compilers/patterns/be/transport/context.md` | selecting or placing a GraphQL/REST entry point, including webhook, OAuth callback, health, metrics, upload or redirect reachability | internal handlers/services after the external door is already settled |
| `type-safety` | `compilers/patterns/be/type-safety/context.md` | unknown input, casts, destructured parameter typing, enum form, state unions or a test-lane type escape | domain naming or modeling already represented without narrowing or erasure |
| `validation` | `compilers/patterns/be/validation/context.md` | untrusted input entry, one-time normalization, cross-field/application validation or a stable field-error contract | domain invariants, TypeScript narrowing by itself or transport selection |
| `resilience` | `compilers/patterns/be/resilience/context.md` | deadlines/timeouts, bounded transient retry, breaker/bulkhead/load shedding, contract-preserving fallback or cancellation propagation | queue retry/redelivery, provider mapping or observability alone |

## Rules

1. Route from facts present in the accepted shape; do not invent a situation merely to select a module.
2. Load every matching module: routes overlap and are not alternatives.
3. Use each selected module's Situation codes to bind the exact source shape.
4. If no row matches, stop at this shelf. Do not scan child publication records for inspiration.

## Output

```text
modules: <selected child context paths>
why: <accepted-shape fact that triggered each module>
excluded: <nearby module considered and the negative scope that excluded it>
```
