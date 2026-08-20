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
| `require-export-jsdoc` | COMMENT-1 | an exported declaration lacks its required JSDoc | `comments/context.md` |
| `require-enum-member-jsdoc` | COMMENT-2 | an exported enum member lacks its own JSDoc | `comments/context.md` |
| `no-non-ascii-source` | COMMENT-4 | governed source contains non-ASCII prose or pictographs | `comments/context.md` |
| `message-carries-params-only` | CQRS-2 | a command/query message carries behavior or non-parameter state | `cqrs/context.md` |
| `handler-overrides-process` | CQRS-3 | a handler does not override the required process entry | `cqrs/context.md` |
| `handler-has-twin-spec` | CQRS-7 | a handler lacks its operation-matched twin spec | `cqrs/context.md` |
| `must-inject-entity-manager` | DATA-1 | `EntityManager` injection lacks the required injection shape | `data-access/context.md` |
| `no-injected-repository` | DATA-2 | a repository is injected directly | `data-access/context.md` |
| `require-entity-table-name` | DATA-3 | `@Entity` omits an explicit table name | `data-access/context.md` |
| `no-sleep-in-flow` | E2E-3 | an end-to-end flow sleeps or constructs a timer | `e2e-flow/context.md` |
| `e2e-asserts-persisted-state` | E2E-4 / TESTING-2 | an end-to-end spec has no persisted-state assertion | `e2e-flow/context.md` and `testing/context.md` |
| `no-branch-in-flow-step` | E2E-7 | a flow step contains control-flow branching | `e2e-flow/context.md` |
| `e2e-uses-production-transport` | E2E-11 / TESTING-3 | an end-to-end spec bypasses production transport | `e2e-flow/context.md` and `testing/context.md` |
| `no-model-call-in-e2e` | E2E-12 / TESTING-9 | an end-to-end spec imports or calls a model provider | `e2e-flow/context.md` and `testing/context.md` |
| `nats-bridge-delivery-contract` | DELIVERY-3, DELIVERY-4 | a NATS bridge violates ack or delivery ownership | `event-delivery/context.md` |
| `exception-name-ends-in-exception` | IDENTITY-1 | an exception class lacks the `Exception` suffix | `exception-identity/context.md` |
| `exception-code-matches-class-name` | IDENTITY-2 | an exception code differs from its class identity | `exception-identity/context.md` |
| `exception-metadata-type-named-for-class` | IDENTITY-4 | exception metadata is missing or not class-named | `exception-identity/context.md` |
| `throw-abstract-exception` | EXCEPTION-1 | code throws a bare or non-house error | `exceptions/context.md` |
| `require-exception-object-arg` | EXCEPTION-2 | an exception is constructed without the required object argument | `exceptions/context.md` |
| `exception-extends-abstract` | EXCEPTION-3 | an exception class bypasses the abstract base | `exceptions/context.md` |
| `exception-in-errors-folder` | EXCEPTION-4 | an exception class lives outside the errors folder | `exceptions/context.md` |
| `must-deep-module-import` | LAYERING-1 | a capability is imported through its barrel instead of a file | `module-layering/context.md` |
| `no-self-module-alias` | LAYERING-2 | a capability imports itself through its module alias | `module-layering/context.md` |
| `no-version-in-name` | NAME-2 | a declaration bakes a version into its name | `naming/context.md` |
| `no-bare-verb-export` | NAME-5 | an exported identifier is only a bare verb | `naming/context.md` |
| `no-framework-logger` | OBSERVABILITY-1 | code imports or constructs a framework logger | `observability/context.md` |
| `no-interpolated-log-message` | OBSERVABILITY-2 | a house log message is dynamically built | `observability/context.md` |
| `no-call-only-spec` | TESTING-6 | a unit spec asserts calls but no result or state | `testing/context.md` |
| `unit-test-colocated` | TESTING-7 | a backend unit uses `.test.` or lives in a separate unit bucket | `testing/context.md` |
| `harness-calls-provider-directly` | TESTING-10 | a model-quality harness bypasses the approved provider path | `testing/context.md` |
| `rest-door-needs-a-reason` | TRANSPORT-2 | a REST controller has no documented exception reason | `transport/context.md` |
| `door-lives-in-features` | TRANSPORT-3 | a transport door lives outside the feature tree | `transport/context.md` |
| `no-double-cast` | TYPE-2 | a value is cast through an intermediate type | `type-safety/context.md` |
| `no-inline-param-type` | TYPE-3 | a destructured parameter carries an inline object type | `type-safety/context.md` |
| `no-const-enum` | TYPE-4 | a declaration uses `const enum` | `type-safety/context.md` |

## Shared emitted identities

Three rules are published by both the focused E2E-flow and broader Testing records. For
`e2e-asserts-persisted-state`, `e2e-uses-production-transport`, or `no-model-call-in-e2e`, load both
listed records: neither situation identity may be silently discarded.

## Unknown findings

If the canonical backend gate emits a rule absent from this table, stop and report an unaccountable machine rule. Do
not guess a neighboring module and do not load the full shelf.
