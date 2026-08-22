# Domain modeling

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted business shape: an aggregate, a value, a state transition, a rule that
spans more than one aggregate, or a persistence representation. This module resolves the boundary
that keeps business meaning intact in source. It does not decide the business outcome and it does not
choose a transport, a database handle, a type-system escape hatch or an orchestration refactor.

## Law

Business invariants live with the smallest object that can make them true. Values cross the domain
boundary as validated value objects, not as an unbounded collection of primitives. A lifecycle is a
closed set of states with named transitions, not a bag of booleans. A rule that truly needs more than
one aggregate is calculated by a stateless domain service that receives domain objects and returns a
decision; it does not become a disguised repository. Persistence shapes are translations at the
edge, never the domain model itself.

This is binding, not advisory. Every accepted domain shape resolves each matching situation below.
When two situations describe different facts in one file, both apply and both produce their own
decision. The neighboring modules remain separate: type narrowing belongs to `type-safety`, database
handles and transactions belong to `data-access`, external entry points belong to `transport`, and
decision-tree extraction or duplication belongs to `maintainability`.

## Situation codes

Every governed situation carries a fixed `DOMAIN-<n>` identity. The number and meaning are stable.

| Code | Situation | What the source must look like |
|---|---|---|
| `DOMAIN-1` | An invariant has one aggregate owner | The aggregate exposes the command that preserves the invariant; callers do not mutate fields or reproduce the invariant beside it |
| `DOMAIN-2` | A domain value crosses a boundary | An immutable value object validates and canonicalizes its value once; domain code does not pass a naked primitive where the value has business meaning |
| `DOMAIN-3` | A lifecycle state changes | One named transition authority checks the current state and emits the next state; contradictory lifecycle booleans and arbitrary state assignment are forbidden |
| `DOMAIN-4` | One rule needs more than one aggregate | A stateless domain service owns the cross-aggregate decision and receives domain concepts; persistence, transport and framework concerns stay outside it |
| `DOMAIN-5` | A domain object is stored or loaded | An explicit mapper translates between domain and persistence shapes; ORM decorators, column defaults and database-only fields do not become domain behavior |

`DOMAIN-1` and `DOMAIN-4` are not alternatives. An aggregate still owns its local invariant when a
domain service coordinates a rule across aggregates. `DOMAIN-2` and `DOMAIN-5` can apply to the
same property at two edges: the value object owns meaning, while the mapper owns representation.

## Reading an accepted shape

1. Read the settled business language first: the objects, facts, valid outcomes and named transitions.
   Do not invent a rule to make a code fit this module.
2. Identify the narrowest owner for every invariant. If one aggregate can decide it from its own
   state, use `DOMAIN-1`; if two aggregate states are required, continue to `DOMAIN-4`.
3. Mark every value that has a unit, identity, format, range or equality rule. Those values resolve
   to `DOMAIN-2` before they are accepted by an aggregate or service.
4. Draw the lifecycle as states and allowed transitions, then identify the only authority allowed
   to perform each transition. That is `DOMAIN-3`.
5. If a domain object is persisted, separate its domain fields from the row/document fields and
   resolve `DOMAIN-5` at the mapping edge.
6. Apply every matching code independently. A handler that assigns `order.status` directly and
   also serializes the domain object has two findings, not one combined placement finding.

## `DOMAIN-1` — the aggregate owns its invariant

**Situation.** A command can change an aggregate only if a rule about that aggregate remains true.
The rule is part of the object’s meaning, so the object that holds the required state must decide it.

**What it emits in source.** A public command or named method on the aggregate that checks the
invariant and changes its state atomically. State is private or otherwise mutation-controlled. A
handler, resolver or generic service calls that method and does not set fields or copy the predicate.

**Recognition signs.** `aggregate.status = ...` outside the aggregate; a second copy of a balance,
quantity, membership or ownership predicate in a handler; a public mutable collection that callers
can update without the invariant check.

**Boundary.** Not `DOMAIN-4`: a rule using one aggregate’s state is not a cross-aggregate service.
Not `VALIDATE-3`: request-level field combinations are not aggregate invariants. Not `DATA-*`:
the manager, transaction and query are separate persistence decisions.

## `DOMAIN-2` — a value object owns its boundary

**Situation.** A value has business meaning beyond its primitive representation: a money amount,
email address, course slug, date range, currency or external identifier.

**What it emits in source.** An immutable value object with a named factory or constructor that
rejects invalid input, stores one canonical representation and defines equality by value. Domain
methods accept that object rather than repeating primitive checks at every caller.

**Recognition signs.** `string` or `number` parameters with repeated format/range checks; a primitive
whose unit is conveyed only by its variable name; a value object with public mutable fields or with
normalization performed by each caller.

**Boundary.** Not `TYPE-*`: this code decides business meaning and ownership, not whether an unknown
value is narrowed safely. Not `VALIDATE-2`: external normalization is a boundary operation; the value
object still guarantees the canonical domain value after construction.

## `DOMAIN-3` — lifecycle transitions have one authority

**Situation.** An entity or aggregate moves through named states with legal and illegal transitions.
The current state and the transition rule belong together; otherwise callers can manufacture an
impossible lifecycle.

**What it emits in source.** A closed state representation and one named transition method (or one
state machine owned by the aggregate) that checks the current state, records the next state and
returns the resulting domain fact. Callers request `approve`, `cancel`, `complete` or equivalent;
they do not assign a state or maintain parallel booleans.

**Recognition signs.** `isPaid`, `isCancelled` and `isOpen` can be true together; a public `state`
setter; transition predicates repeated in multiple handlers; an unknown string silently accepted as
a state.

**Boundary.** Not `MAINTAIN-*`: contradictory booleans are a domain lifecycle error here; the
maintainability module may separately judge duplication or complexity. Not transport status mapping:
an HTTP status is not a domain lifecycle.

## `DOMAIN-4` — cross-aggregate rules belong to a domain service

**Situation.** A business decision requires state from two or more aggregate roots and cannot be
made by either root alone.

**What it emits in source.** A stateless domain service with a business name, domain inputs and a
domain result or decision. It coordinates the rule without owning persistence handles, transport
decorators, framework lifecycle or mutable request state. Aggregates still protect their own local
invariants when the service calls them.

**Recognition signs.** A handler reads two aggregates and contains the business predicate; one
aggregate reaches inside another’s internals; a class called a “domain service” injects an ORM manager
or resolver and returns a transport response.

**Boundary.** Not `DATA-4`: transaction scope and manager propagation are persistence concerns. Not
`CQRS` or `TRANSPORT`: command placement and external doors do not decide where a domain predicate
lives. Use this code only when more than one aggregate’s state is genuinely required.

## `DOMAIN-5` — persistence and domain shapes are mapped explicitly

**Situation.** A domain object must be stored or reconstructed from a row/document. Persistence
constraints and ORM annotations are not business behavior and must not leak through the domain.

**What it emits in source.** A mapper or named conversion boundary that maps domain values to the
persistence shape and back, including explicit handling of ids, timestamps, nullable fields and value
objects. The domain object has no ORM decorator, lazy relation, database default or column-only flag.

**Recognition signs.** A domain method reads a column decorator or ORM relation; an entity is passed
straight into a use case as if it were the aggregate; a mapper silently drops a domain field or lets a
database default decide a business default.

**Boundary.** Not `DATA-3`: table names and entity declarations belong to data access. This code asks
whether the domain/persistence boundary is explicit. Not `DOMAIN-2`: a value object may be serialized
by the mapper, but its invariant remains in the value object.

## Layer held

`documented` means the decision depends on business semantics or a call graph that the current
single-file canonical machine cannot safely infer. No canonical rule is claimed here until one exists.

| Code | Tier | Held by |
|---|---|---|
| `DOMAIN-1` | `documented` | The aggregate’s invariant owner is a semantic decision; a parser cannot know whether a predicate is complete or duplicated elsewhere |
| `DOMAIN-2` | `documented` | Validity, units and equality are domain facts; type syntax alone cannot distinguish a meaningful primitive from an ordinary one |
| `DOMAIN-3` | `documented` | Legal transitions require the accepted lifecycle graph and call-graph intent; a local AST check would accept an incomplete state machine |
| `DOMAIN-4` | `documented` | Whether a rule truly needs multiple aggregate roots is a business fact, not a safe filename or decorator heuristic |
| `DOMAIN-5` | `documented` | Correct mapping requires both domain intent and persistence schema; data-access lint must not be misrepresented as domain enforcement |

## Inputs

| Input | Evidence required |
|---|---|
| accepted business shape | Objects, invariants, value meanings, lifecycle states and legal outcomes already accepted |
| invariant ownership | The state required to decide each invariant and the smallest object that owns it |
| value boundary | Primitive representation, canonical form, invalid forms and equality semantics |
| lifecycle graph | Current states, allowed transitions, rejected transitions and transition authority |
| aggregate set | The aggregate roots whose state is needed for a cross-aggregate decision |
| persistence shape | Row/document fields, nullability, generated fields and the explicit domain conversion boundary |

## Rules

1. Keep each invariant at the smallest aggregate that can decide it from owned state.
2. Construct business values once as immutable value objects and pass those objects inward.
3. Represent one lifecycle with one closed state and named transitions, never contradictory booleans.
4. Use a stateless domain service only when multiple aggregate roots are necessary for one decision.
5. Keep transport, framework and persistence handles outside domain services and aggregates.
6. Map domain and persistence shapes explicitly in both directions; do not use an ORM entity as a
   substitute for a domain aggregate.
7. Apply all matching situation codes independently; one file may have several domain findings.

## Exceptions

Exceptions are closed exits from this pattern, not general waivers.

- **A read model or projection.** A projection may be an intentionally flat persistence/read shape.
  `DOMAIN-5` still requires an explicit boundary before it is treated as a domain object; a read row
  is not an aggregate merely because it has a class.
- **A primitive with no business meaning.** A local loop index, pagination offset or framework token
  does not need `DOMAIN-2` when no domain rule attaches to it.
- **An aggregate factory.** Construction may be the transition authority for the initial state under
  `DOMAIN-3`; it must still reject an impossible initial state.
- **A cross-aggregate transaction.** A transaction may surround a domain service call, but the
  manager, repository and commit policy remain `data-access`, not an exception to `DOMAIN-4`.
- **A persistence entity.** ORM decorators may live on the persistence representation under
  `DOMAIN-5`; the exception does not permit those decorators or database defaults in domain code.

## Stops

Stop before writing source when any of these facts is unresolved:

- no accepted invariant, value meaning, lifecycle graph or aggregate set exists;
- two candidate owners can both mutate the same invariant and no owner has been approved;
- a primitive’s unit, canonical form or invalid range is unknown;
- a transition is requested without a closed set of states and rejected transitions;
- a proposed domain service needs a database handle, transport object or framework lifecycle;
- the persistence schema is being guessed instead of read from the declared data-access contract.

## Proof

The record is proven when each applicable code has a named owner, a source boundary and a consequence
test. The proof is architectural rather than a claim that an absent lint rule exists.

| Code | Minimum proof |
|---|---|
| `DOMAIN-1` | A test changes the aggregate through its command and proves the invariant cannot be bypassed by the caller |
| `DOMAIN-2` | Factory tests cover canonicalization, invalid values and equality; callers receive the value object |
| `DOMAIN-3` | Transition tests cover every legal edge and every rejected edge, including repeated transitions |
| `DOMAIN-4` | A service test supplies two aggregate states and proves the decision has no persistence or transport side effect |
| `DOMAIN-5` | Round-trip mapping tests prove domain meaning survives persistence conversion without leaking ORM details inward |

## Output

One block per applicable situation:

```text
shape:       <accepted business shape>
owner:       <aggregate, value object, transition authority, domain service or mapper>
boundary:    <source boundary that holds the decision>
situation:   <DOMAIN-1 | DOMAIN-2 | DOMAIN-3 | DOMAIN-4 | DOMAIN-5>
verdict:     <holds | violates | stop>
reason:      <invariant, value, transition, aggregate set or mapping fact>
proof:       <test or evidence that proves the boundary>
```
