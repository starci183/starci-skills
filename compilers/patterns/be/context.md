# Backend pattern context router

## LOADS

None.

## Record

This file routes an accepted backend shape to the smallest binding runtime context. Load only the
matching child `context.md` files. A directory target does not authorize loading every child, and
`en.md` and `vi.md` are publication records rather than runtime inputs.

## Routes

Child contexts are lazy routes, not eager dependencies.

| Module | Target | Load when the accepted shape contains | Do not load for |
|---|---|---|---|
| `authorization` | `compilers/patterns/be/authorization/context.md` | authenticated identity, a guarded handler or resolver, row ownership, refusal disclosure, entitlement state or operator-versus-user authority | authentication mechanics alone, validation, or a public operation with no authorization decision |
| `cdc` | `compilers/patterns/be/cdc/context.md` | a Kafka change-data-capture consumer, source-table declaration, projection recomputation, tombstone handling or consumer failure isolation | ordinary domain events, request-time queries or non-CDC Kafka messaging |
| `comments` | `compilers/patterns/be/comments/context.md` | new or changed exports, enum members, exceptional mechanics, source-language prose or a string that may be mistaken for documentation | reader-visible copy, naming alone or prose outside source |
| `cqrs` | `compilers/patterns/be/cqrs/context.md` | a command/query/event operation, its folder, message, handler, dispatching service, domain failure or colocated spec | transport selection, generic service methods or event transport mechanics |
| `data-access` | `compilers/patterns/be/data-access/context.md` | a database handle, entity/table mapping, transaction boundary, secondary write or relation-loading query | business orchestration with no persistence decision or cache/storage outside the database layer |
| `delivery-assurance` | `compilers/patterns/be/delivery-assurance/context.md` | hook, CI, coverage, analysis, credential or deploy-fence adoption for a backend | feature implementation with an already-green complete delivery fence |
| `e2e-flow` | `compilers/patterns/be/e2e-flow/context.md` | a real business flow, named steps, polling, realtime observation, absence proof, actor setup, operational chain or external-result override | unit/integration branch coverage or an isolated provider harness |
| `event-delivery` | `compilers/patterns/be/event-delivery/context.md` | an event crossing process instances, a producer envelope, transport declaration, self-drop, digest claim, recipient/content assertion or two-instance proof | in-process events or CDC projection consumption |
| `exception-identity` | `compilers/patterns/be/exception-identity/context.md` | defining or renaming an exception class, wire code, metadata type or status-independent failure identity | deciding where failures live or how callers construct them without changing identity |
| `exceptions` | `compilers/patterns/be/exceptions/context.md` | throwing, placing or constructing a domain failure, choosing its base class or metadata payload | test-runner assertions, transport status mapping or identity naming alone |
| `module-layering` | `compilers/patterns/be/module-layering/context.md` | choosing an import path, public surface, capability dependency, composition-root wire or cross-feature edge | naming a symbol after its file boundary is settled or data flow inside one module |
| `naming` | `compilers/patterns/be/naming/context.md` | choosing a path, filename, type/function/boolean/export name or capability vocabulary | placement/import boundaries, reader-visible wording or exception wire identity governed separately |
| `observability` | `compilers/patterns/be/observability/context.md` | logging, event-name enums, structured metadata, decision/failure telemetry, standalone stdout/stderr or telemetry process lifecycle | domain events, test output or exception construction without a log decision |
| `port-offset` | `compilers/patterns/be/port-offset/context.md` | Source family allocation, application slots, backend service declarations, resolved port projections or frontend/runtime port consumers | a one-off external endpoint that never binds on the Source host, or container-internal ports with no host publication |
| `testing` | `compilers/patterns/be/testing/context.md` | choosing a test lane, business story, consequence assertion, decision-branch coverage, e2e access path, provider harness or demo seed | production implementation or the detailed step mechanics of an accepted e2e flow |
| `transport` | `compilers/patterns/be/transport/context.md` | selecting or placing a GraphQL/REST entry point, including webhook, OAuth callback, health, metrics, upload or redirect reachability | internal handlers/services after the external door is already settled |
| `type-safety` | `compilers/patterns/be/type-safety/context.md` | unknown input, casts, destructured parameter typing, enum form, state unions or a test-lane type escape | domain naming or modeling already represented without narrowing or erasure |

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
