# Backend lint router

## LOADS

None.

## Routes

Run the repository's canonical backend lint gate before loading a child gate. Child gates are routed
only after the lint machine emits a finding. A clean run stops here: do not load every lint module.
For each emitted rule, load the exact child runtime record below. Load more than one child only when
the machine emitted rules from more than one row. Bare and plugin-qualified rule names route identically.

| Emitted rule | Situation | Trigger | Load |
|---|---|---|---|
| `identity-needs-guard` | AUTHZ-2 | an identity-bearing parameter lacks its authorization guard | `authorization/context.md` |
| `projection-listener-contract` | CDC-1, CDC-2, CDC-3 | a projection listener violates its event, checkpoint or delivery contract | `cdc/context.md` |
| `no-dynamic-projection-group-id` | CDC-2 | a projection consumer group is computed at boot instead of being stable | `cdc/context.md` |
| `projection-recompute-must-upsert` | CDC-4 | a projection recompute applies a delta or omits replay-safe upsert | `cdc/context.md` |
| `require-export-jsdoc` | COMMENT-1 | an exported declaration lacks its required JSDoc | `comments/context.md` |
| `require-enum-member-jsdoc` | COMMENT-2 | an exported enum member lacks its own JSDoc | `comments/context.md` |
| `no-non-ascii-source` | COMMENT-4 | governed source contains non-ASCII prose or pictographs | `comments/context.md` |
| `no-restated-name-jsdoc` | COMMENT-3 | a JSDoc block only re-spells the declaration name | `comments/context.md` |
| `require-vn-ok-reason` | COMMENT-5 | a `vn-ok` marker omits the reason for retaining the line | `comments/context.md` |
| `message-carries-params-only` | CQRS-2 | a command/query message carries behavior or non-parameter state | `cqrs/context.md` |
| `handler-overrides-process` | CQRS-3 | a handler does not override the required process entry | `cqrs/context.md` |
| `handler-has-twin-spec` | CQRS-7 | a handler lacks its operation-matched twin spec | `cqrs/context.md` |
| `no-handler-encoded-failure` | CQRS-5 | a handler returns an encoded failure instead of throwing its domain exception | `cqrs/context.md` |
| `must-inject-entity-manager` | DATA-1 | `EntityManager` injection lacks the required injection shape | `data-access/context.md` |
| `no-injected-repository` | DATA-2 | a repository is injected directly | `data-access/context.md` |
| `require-entity-table-name` | DATA-3 | `@Entity` omits an explicit table name | `data-access/context.md` |
| `no-outer-manager-in-transaction` | DATA-4 | a transaction callback reaches back to the outer manager | `data-access/context.md` |
| `no-eager-relation` | DATA-5 | an entity relation declares `eager: true` instead of letting the query opt in | `data-access/context.md` |
| `no-api-shaped-e2e-filename` | E2E-1 / TESTING-1 | an end-to-end filename names an API surface instead of a business flow | `e2e-flow/context.md` and `testing/context.md` |
| `no-sleep-in-flow` | E2E-3 | an end-to-end flow sleeps or constructs a timer | `e2e-flow/context.md` |
| `e2e-asserts-persisted-state` | E2E-4 / TESTING-2 | an end-to-end spec has no persisted-state assertion | `e2e-flow/context.md` and `testing/context.md` |
| `no-branch-in-flow-step` | E2E-7 | a flow step contains control-flow branching | `e2e-flow/context.md` |
| `no-wiring-in-flow-spec` | E2E-8 | an end-to-end spec builds its own testing module instead of using the shared world | `e2e-flow/context.md` |
| `e2e-uses-production-transport` | E2E-11 / TESTING-3 | an end-to-end spec bypasses production transport | `e2e-flow/context.md` and `testing/context.md` |
| `no-model-call-in-e2e` | E2E-12 / TESTING-9 | an end-to-end spec imports or calls a model provider | `e2e-flow/context.md` and `testing/context.md` |
| `nats-bridge-delivery-contract` | DELIVERY-3, DELIVERY-4 | a NATS bridge violates ack or delivery ownership | `event-delivery/context.md` |
| `no-call-site-transport-override` | DELIVERY-2 | an emit call chooses local or NATS transport at the call site | `event-delivery/context.md` |
| `exception-name-ends-in-exception` | IDENTITY-1 | an exception class lacks the `Exception` suffix | `exception-identity/context.md` |
| `exception-code-matches-class-name` | IDENTITY-2 | an exception code differs from its class identity | `exception-identity/context.md` |
| `exception-metadata-type-named-for-class` | IDENTITY-4 | exception metadata is missing or not class-named | `exception-identity/context.md` |
| `throw-abstract-exception` | EXCEPTION-1 | code throws a bare or non-house error | `exceptions/context.md` |
| `require-exception-object-arg` | EXCEPTION-2 | an exception is constructed without the required object argument | `exceptions/context.md` |
| `exception-extends-abstract` | EXCEPTION-3 | an exception class bypasses the abstract base | `exceptions/context.md` |
| `exception-in-errors-folder` | EXCEPTION-4 | an exception class lives outside the errors folder | `exceptions/context.md` |
| `must-deep-module-import` | LAYERING-1 | a capability is imported through its barrel instead of a file | `module-layering/context.md` |
| `no-self-module-alias` | LAYERING-2 | a capability imports itself through its module alias | `module-layering/context.md` |
| `no-self-global-module` | LAYERING-4 | a capability declares itself global instead of leaving that decision to the composition root | `module-layering/context.md` |
| `no-folder-reexport` | LAYERING-5 | a file re-exports a folder or forms an index barrel | `module-layering/context.md` |
| `no-relative-capability-escape` | LAYERING-8 | a relative import walks out of its owning capability | `module-layering/context.md` |
| `no-vendor-module-factory-name` | NAME-1 | a house module factory borrows a vendor dynamic-module factory name | `naming/context.md` |
| `no-version-in-name` | NAME-2 | a declaration bakes a version into its name | `naming/context.md` |
| `no-bare-verb-export` | NAME-5 | an exported identifier is only a bare verb | `naming/context.md` |
| `no-framework-logger` | OBSERVABILITY-1 | code imports or constructs a framework logger | `observability/context.md` |
| `no-interpolated-log-message` | OBSERVABILITY-2 | a house log message is dynamically built | `observability/context.md` |
| `no-error-wording-as-log-identity` | OBSERVABILITY-5 | a failure log carries wording but not the exception code used for grouping | `observability/context.md` |
| `no-call-only-spec` | TESTING-6 | a unit spec asserts calls but no result or state | `testing/context.md` |
| `unit-test-colocated` | TESTING-7 | a backend unit must be a colocated `.spec.ts` beside its owner; `.test.ts` and separate unit buckets are refused | `testing/context.md` |
| `no-marker-model-stub` | TESTING-7 | model test infrastructure returns a marker string instead of a parseable answer | `testing/context.md` |
| `harness-calls-provider-directly` | TESTING-10 | a model-quality harness bypasses the approved provider path | `testing/context.md` |
| `rest-door-needs-a-reason` | TRANSPORT-2 | a REST controller has no documented exception reason | `transport/context.md` |
| `door-lives-in-features` | TRANSPORT-3 | a transport door lives outside the feature tree | `transport/context.md` |
| `no-capability-imports-features` | TRANSPORT-6 | a capability under `modules/` imports back into the transport feature tree | `transport/context.md` |
| `no-double-cast` | TYPE-2 | a value is cast through an intermediate type | `type-safety/context.md` |
| `no-inline-param-type` | TYPE-3 | a destructured parameter carries an inline object type | `type-safety/context.md` |
| `no-inline-object-type` | TYPE-3 | an object type is written inline outside a parameter position | `type-safety/context.md` |
| `no-const-enum` | TYPE-4 | a declaration uses `const enum` | `type-safety/context.md` |
| `no-unguarded-unknown-cast` | TYPE-1 | an `unknown` value is cast to a concrete type without a visible guard | `type-safety/context.md` |
| `no-line-suppression` | TYPE-6 | a line disables a type-safety rule instead of using a declared lane | `type-safety/context.md` |

## Shared emitted identities

Four rules are published by both the focused E2E-flow and broader Testing records. For
`no-api-shaped-e2e-filename`, `e2e-asserts-persisted-state`, `e2e-uses-production-transport`, or `no-model-call-in-e2e`, load both
listed records: neither situation identity may be silently discarded.

## Unknown findings

If the canonical backend gate emits a rule absent from this table, stop and report an unaccountable machine rule. Do
not guess a neighboring module and do not load the full shelf.
