# Domain modeling

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted business shape: an aggregate, a value, a lifecycle transition, a rule
spanning aggregates, or a persistence representation. This module resolves the boundary that keeps
business meaning intact in source. It does not decide the business outcome and does not choose
transport, database handles, type-system escapes or orchestration refactors.

## Law

Business invariants live with the smallest object that can make them true. Values cross the domain
boundary as validated immutable value objects. Lifecycles use a closed state set with named
transitions. A rule requiring more than one aggregate is calculated by a stateless domain service
that receives domain objects and returns a decision. Persistence shapes are translated at the edge;
they are not the domain model. Type narrowing belongs to `type-safety`, database handles and
transactions to `data-access`, external doors to `transport`, and duplication/decision-tree concerns
to `maintainability`.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `DOMAIN-1` | An invariant has one aggregate owner | The aggregate exposes the command that preserves the invariant; callers do not mutate fields or reproduce the invariant |
| `DOMAIN-2` | A domain value crosses a boundary | An immutable value object validates and canonicalizes once; domain code does not pass a naked primitive for a meaningful value |
| `DOMAIN-3` | A lifecycle state changes | One named transition authority checks current state and emits next state; arbitrary state assignment and contradictory booleans are forbidden |
| `DOMAIN-4` | One rule needs more than one aggregate | A stateless domain service owns the cross-aggregate decision and receives domain concepts; persistence and transport stay outside |
| `DOMAIN-5` | A domain object is stored or loaded | An explicit mapper translates domain and persistence shapes; ORM/database-only details do not become domain behavior |

## Reading an accepted shape

1. Read the settled business objects, facts, outcomes and transitions; do not invent a rule to fit a
   code.
2. Assign each invariant to the narrowest owner. One aggregate is `DOMAIN-1`; multiple aggregate
   roots may require `DOMAIN-4`.
3. Mark values with a unit, identity, format, range or equality rule for `DOMAIN-2`.
4. Resolve the closed lifecycle graph and its sole transition authority as `DOMAIN-3`.
5. Separate domain fields from row/document fields and resolve `DOMAIN-5` at the mapping edge.
6. Apply all matching codes independently; one source file can produce multiple domain findings.

## `DOMAIN-1` — the aggregate owns its invariant

**Situation.** A command changes an aggregate only if an invariant about that aggregate remains true.

**Source shape.** A public command or named aggregate method checks and changes state atomically;
callers do not set fields or copy the predicate.

**Recognition.** External `aggregate.status = ...`, duplicated balance/quantity/ownership predicates,
or a public mutable collection bypassing the check.

**Boundary.** This is not `DOMAIN-4` (one aggregate is enough), not `VALIDATE-3` (request field
combinations), and not `DATA-*` (manager, transaction and query decisions).

## `DOMAIN-2` — a value object owns its boundary

**Situation.** A value has business meaning beyond its primitive representation.

**Source shape.** An immutable value object validates, canonicalizes and defines value equality;
domain methods accept it instead of repeating primitive checks.

**Recognition.** Repeated format/range checks on `string`/`number`, units conveyed only by names, or
mutable value-object fields.

**Boundary.** This is not `TYPE-*` (static narrowing) and not `VALIDATE-2` (external normalization);
the value object guarantees the canonical domain value after construction.

## `DOMAIN-3` — lifecycle transitions have one authority

**Situation.** An entity or aggregate moves through named legal and illegal states.

**Source shape.** One closed state representation and one named transition authority checks current
state and emits the next state; callers request a transition, never assign state or parallel booleans.

**Recognition.** Contradictory flags, public state setters, repeated transition predicates, or unknown
strings accepted as states.

**Boundary.** This is a domain lifecycle decision, separate from maintainability duplication and
transport status mapping.

## `DOMAIN-4` — cross-aggregate rules belong to a domain service

**Situation.** A business decision requires state from at least two aggregate roots.

**Source shape.** A stateless domain service with domain inputs and a domain result owns the decision;
it has no ORM manager, transport decorator, framework lifecycle or mutable request state.

**Recognition.** A handler contains a predicate over two aggregates, one aggregate reaches into
another’s internals, or a “domain service” returns a transport response.

**Boundary.** Transaction scope and manager propagation remain `data-access`; command placement and
external doors remain `CQRS`/`TRANSPORT`. Use this only when multiple aggregate state is necessary.

## `DOMAIN-5` — persistence and domain shapes are mapped explicitly

**Situation.** A domain object is stored or reconstructed from a row/document.

**Source shape.** A named mapper converts both directions and handles ids, timestamps, nullability and
value objects; ORM decorators, lazy relations and database defaults stay outside domain code.

**Recognition.** A domain method reads ORM metadata, an entity is used directly as an aggregate, or a
mapper drops domain fields or delegates business defaults to the database.

**Boundary.** Table/entity declarations remain `data-access` (`DATA-3`); value-object invariants
remain `DOMAIN-2` even when the mapper serializes them.

## Layer held

All five codes are `documented`: their decisions depend on business semantics, accepted lifecycle
graphs, schemas or call graphs that the current single-file canonical machine cannot safely infer.
No canonical rule is claimed until one exists.

| Code | Tier | Held by |
|---|---|---|
| `DOMAIN-1` | `documented` | Semantic invariant ownership; a parser cannot know whether a predicate is complete or duplicated |
| `DOMAIN-2` | `documented` | Domain validity, units and equality, not type syntax |
| `DOMAIN-3` | `documented` | Accepted lifecycle graph and transition intent, not a local AST heuristic |
| `DOMAIN-4` | `documented` | Whether multiple aggregate roots are truly required, a business fact |
| `DOMAIN-5` | `documented` | Domain intent plus persistence schema; no data-access rule is misrepresented as domain enforcement |

## Inputs

| Input | Evidence required |
|---|---|
| accepted business shape | Objects, invariants, value meanings, lifecycle states and outcomes |
| invariant ownership | Required state and the smallest owning object |
| value boundary | Primitive form, canonical form, invalid forms and equality |
| lifecycle graph | States, legal/rejected edges and transition authority |
| aggregate set | Roots required for a cross-aggregate decision |
| persistence shape | Fields, nullability, generated fields and conversion boundary |

## Rules

1. Keep an invariant at the smallest aggregate that can decide it.
2. Construct meaningful business values once as immutable value objects.
3. Use one closed lifecycle state and named transitions, not contradictory booleans.
4. Use a stateless domain service only when multiple aggregate roots are necessary.
5. Keep transport, framework and persistence handles outside domain services and aggregates.
6. Map domain and persistence shapes explicitly in both directions.
7. Apply every matching situation code independently.

## Exceptions

- **Read model or projection.** It may be a flat persistence shape, but `DOMAIN-5` still requires an
  explicit boundary before treating it as domain.
- **Primitive without business meaning.** Local indexes, pagination offsets and framework tokens do
  not need `DOMAIN-2`.
- **Aggregate factory.** It may own the initial `DOMAIN-3` state, but must reject impossible input.
- **Cross-aggregate transaction.** The transaction may wrap `DOMAIN-4`; manager and commit policy
  remain `data-access`.
- **Persistence entity.** ORM decorators may live on the persistence representation under
  `DOMAIN-5`, never in domain code.

## Stops

Stop before writing source when the accepted invariant/value/lifecycle/aggregate set is missing, two
owners can mutate one invariant without an approved owner, a value’s canonical form is unknown, a
transition lacks a closed state graph, a domain service needs transport/framework/persistence handles,
or the persistence schema is being guessed.

## Proof

Proof is architectural and must pair each applicable code with an owner, boundary and consequence test:

| Code | Minimum proof |
|---|---|
| `DOMAIN-1` | Aggregate command tests prove callers cannot bypass the invariant |
| `DOMAIN-2` | Factory tests cover canonicalization, invalid values and equality |
| `DOMAIN-3` | Transition tests cover every legal and rejected edge, including repeats |
| `DOMAIN-4` | Service tests prove a multi-aggregate decision has no persistence/transport side effect |
| `DOMAIN-5` | Round-trip mapper tests prove domain meaning survives without ORM leakage |

## Output

```text
shape:       <accepted business shape>
owner:       <aggregate, value object, transition authority, domain service or mapper>
boundary:    <source boundary holding the decision>
situation:   <DOMAIN-1 | DOMAIN-2 | DOMAIN-3 | DOMAIN-4 | DOMAIN-5>
verdict:     <holds | violates | stop>
reason:      <invariant, value, transition, aggregate-set or mapping fact>
proof:       <test or evidence proving the boundary>
```
