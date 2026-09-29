# The sds family: source-independent architecture

Business records (fr, br, nfr, data, journey, decision; see [business-srs.md](business-srs.md)) define observable behavior, rules, journeys and acceptance. The `sds` family maps those outcomes to logical components, interfaces, data ownership, quality mechanisms, deployment and recovery. Together they are the upstream source of truth. An sds record never contains repository roles, file paths, symbols, signatures, call graphs, source revisions or executed proof. Implementation owns the mapping from this logical design to actual code.

Write all current canonical content in English, including natural-language prose, YAML and schema
keys, stable IDs and refs, enum literals, protocol identifiers, API fields, variables, types,
operation names and source symbols. Conversation or presentation locale never translates canonical
records.

Architecture may inspect a small relevant source/configuration/API surface to check feasibility and
transition impact. Those observations inform a design decision but never become sds content or
authority. Record the selected logical design, rationale, impact and transition; record actual code
mapping and conformance under Implementation.

## Progressive authoring

For a not-yet-implemented capability, author the smallest design-complete records for the next selected
implementation slice. They settle logical ownership, public contracts, authority, durable state and
effects, material failure/recovery, compatibility and planned verification. They do not predict endpoint
names, database tables, event topics, file layout, private helpers or library calls unless an accepted
constraint makes one of those details part of the logical contract.

A reviewed record remains `state: todo` while implementation, test/E2E or UAT evidence is open.
Use `activity: investigating|implementing|verifying` to show current work and `blockers[]` for impediments;
do not invent another lifecycle state. The bounded `architecture.decide` job may pass once the records are
usable downstream, but that job result is not Work completion. Implementation feedback first gets
classified. Reversible source-local choices stay in Implementation. A proven gap in logical ownership,
contract, authority, durable state/effect, compatibility, material failure/recovery or quality mechanism
opens a bounded revision. Preserve unaffected design and invalidate only downstream proof touched by
that delta.

## Layout

Design records are flat family folders directly under their feature, next to the business families. There is no `architecture/` or `sds/` grouping folder; `modules/schemas/work-layout.yaml` owns where a record lives.

```text
.starciwork/features/<feature>/
├── sds/<name>/index.yaml            # work/sds-component@1
├── contract/<name>/index.yaml       # work/contract@1
├── integration/<name>/index.yaml    # work/integration@1
├── event/<name>/index.yaml          # work/event@1
└── decision/<name>/index.yaml       # work/policy-decision@1 (shared with business)
```

| Family | Schema | File |
| --- | --- | --- |
| Logical component | `work/sds-component@1` | `modules/schemas/work-sds-component.schema.yaml` |
| Contract between parties | `work/contract@1` | `modules/schemas/work-contract.schema.yaml` |
| External integration | `work/integration@1` | `modules/schemas/work-integration.schema.yaml` |
| Event | `work/event@1` | `modules/schemas/work-event.schema.yaml` |
| Decision | `work/policy-decision@1` | `modules/schemas/work-policy-decision.schema.yaml` |

The schemas own each record's required fields; `modules/schemas/index.yaml` catalogs them. There is no separate flow, data-model, quality, deployment or verification family: those concerns are carried by the component record (`sequence`, `stateMachine`, `interfaces`), by the business `data` and `nfr` records it refs, and by `requiresProof`/`provenBy`.

## Components

`sds/<name>/index.yaml` owns one logical responsibility. It states its `responsibility`, the `interfaces` other parts of the system may assume (who may write, who must go through whom), its `refs` to the business records it serves, its `dependsOn` allowed dependencies, an optional `stateMachine` and a `sequence` tracing the paths from exact business ids to an observable result through entry points, contracts, data, quality controls, deployment and verification.

A component exists because the design needs one responsibility boundary. Components are not required to mirror processes or files; deployment separately decides whether components share a process or cross a network. A component must not name a repository, source path, class, function, symbol, signature or source call graph in its design content.

`architecture.decide` leaves `owners` absent. `review.verify` final reconciliation writes `owners: [{role, path}]`, module-root directories that exist on disk, from the done implementation records that prove the component. Before any done implementation proves it, a component without owners is `SDS_OWNERS_PENDING` (info); after that, a done one without owners is refused and a todo one is warned (`SDS_OWNERS_MISSING`).

## Contracts, integrations and decisions

A `contract` names its `owner`, the parties it sits `between`, the `surface` it exposes, what it `guarantees` and what each consumer must do (`consumerObligations`). An `integration` names an external `provider`, its `boundary`, `endpoints`, `credential` custody and `sandbox`. An `event` names its payload fields and the delivery guarantee and ordering the transport promises; async interactions identify message identity, ordering and duplicate handling.

Decisions compare viable alternatives and record the question, options, outcome, rationale, tradeoffs and affected refs. Do not invent business SLAs or retention; unresolved targets stay linked to the business decision that owns them. For a monolith, show logical module boundaries and in-process interfaces without inventing network concerns. For microservices, show independent ownership and failure, partial completion and reconciliation. Shared-database or cross-service writes require an explicit decision.

## Logical example

For `FR-CHAT-01`, an sds sequence may say:

```text
Chat UI surface
  -> Conversation API component
  -> Authorization component
  -> Conversation state component
  -> Knowledge retrieval component
  -> Language model gateway
  -> Conversation state component
  -> Chat UI surface
```

Each boundary resolves to a logical component and, where interaction semantics matter, a contract.
The design still covers invalid input, denial without disclosure, clarification, duplicate request,
timeout, accepted asynchronous work, late-result reconciliation, cancellation races and partial
delivery. It does not prescribe controllers, handlers, repositories, method names or files.

## Review and completion

Validate with `node bin/starci.mjs validate <work-root>`. Structural validity proves only internal
shape and traceability. Review checks that significant business branches reach logical components and
observable outcomes, contract and data ownership is unambiguous and material edge cases have selected
mechanisms. Implementation separately maps actual source to these ids and proves conformance.

A reviewed record is authored as `todo` and remains the current design input to implementation. An
implementation op reports an `sds-gap` blocker only when concrete code or test facts prove a bounded
contradiction or missing design decision; the kernel routes it to `architecture.revise`
(modules/models/kinds.yaml `sds-gap-revises-the-design`) and reopens the implementation behind it. `todo + activity: idle` means defined but not currently
being worked; `todo + activity: investigating|implementing|verifying` means in progress. Only final
reconciliation may author `done`, after current business, design, code, test/E2E and UAT evidence bind the same
delivery revision and every required assertion passes. Missing, stale or mismatched evidence leaves the
record `todo` and the workflow partial or blocked. Changing an accepted business record invalidates dependent design review;
changing logical design invalidates affected Implementation and UAT. Preserve unrelated completed scopes and
historical local run state.
