# Validation

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted operation and input shape. This module decides where untrusted data becomes a
canonical application value and how failures remain useful to callers. It does not choose external
doors, static narrowing, persistence access or refactoring shape.

## Law

Reject untrusted data at the first boundary that can name its shape. Normalize once at the boundary
that owns the representation and carry the canonical form inward. Cross-field and application-state
rules run where all required facts are available. Failures use one stable field-error contract with
machine-readable paths and codes; presentation text and transport status remain separate.

`type-safety` narrows compiler knowledge; `transport` places the door; `data-access` handles database
constraints; `maintainability` judges duplication. This module decides validation ownership and error
meaning only.

## Situation codes

| Code | Situation | What the source must look like |
|---|---|---|
| `VALIDATE-1` | Untrusted input reaches an application boundary | The boundary parses and rejects the declared shape before application code treats it as trusted |
| `VALIDATE-2` | Input needs canonicalization | One owning boundary trims, parses, case-folds or defaults once and passes the canonical form inward |
| `VALIDATE-3` | A rule spans fields or application state | The rule runs where all required facts are available; field syntax alone is not claimed to be enough |
| `VALIDATE-4` | A caller needs validation failures | Errors expose stable field paths and machine codes; wording and transport status are not identity |

## Reading an accepted shape

1. Locate the first entry of bytes, JSON, GraphQL variables, messages or provider responses.
2. Separate shape checks, canonicalization and rules requiring other fields/state.
3. Assign normalization to the first boundary owning the representation and record its canonical form.
4. Identify failure consumers and choose one stable path/code contract.
5. Apply every matching code independently.

## `VALIDATE-1` — untrusted input stops at the boundary

**Situation.** Data from a client, broker, file, environment, provider or fixture is not trusted just
because a TypeScript annotation describes it.

**Source shape.** A boundary parser checks presence, primitive shape, allowed values and syntax before
handing a trusted input to application code; invalid input exits through the validation contract.

**Recognition.** `any`-shaped handler input, casts treated as validation, provider payload used before
parsing, or happy-path-only checks.

**Boundary.** This is not `TYPE-*`, `TRANSPORT` placement or later `DATA-*` persistence validation.

## `VALIDATE-2` — normalize once

**Situation.** Equivalent spellings or omitted/default forms need one canonical value.

**Source shape.** The owning boundary trims, case-folds, parses, sorts, converts units or applies an
approved default once; inner layers consume it without competing normalization.

**Recognition.** Repeated `trim()`/`toLowerCase()`, inconsistent empty handling, or defaults that differ
between DTO, handler and repository.

**Boundary.** `DOMAIN-2` may enforce domain validity afterward; `VALIDATE-2` chooses the external
representation boundary. Repeated normalization is not a general maintainability waiver.

## `VALIDATE-3` — cross-field and application rules run where facts meet

**Situation.** Validity depends on multiple fields, state, entitlement, clock, existing records or
another application fact.

**Source shape.** Field shape rules remain at the boundary; context-dependent rules run in an
application/domain policy with all required facts and return a stable decision/failure.

**Recognition.** DTO querying a database, resolver-only rules bypassed by a queue, one-sided date
checks, or uniqueness described as string format.

**Boundary.** An aggregate may be final authority for a domain invariant (`DOMAIN-1`), but this code
identifies the layer that assembles the facts. A database uniqueness constraint is not the whole rule.

## `VALIDATE-4` — field errors have a stable contract

**Situation.** Callers need to associate failures with fields across GraphQL, REST, jobs or in-process
operations.

**Source shape.** A deterministic collection carries field paths, machine codes and optional structured
parameters. Wording may change without changing path/code identity.

**Recognition.** Clients parse message text, keys differ for one field, nested paths disappear, or
transport status is used as validation code.

**Boundary.** Exception identity is separate; transport maps the contract at the door but does not
redefine its identity.

## Layer held

All four codes are `documented`: correct ownership depends on payload source, accepted shape, consumers
and application facts that a single-file canonical machine cannot safely infer.

| Code | Tier | Held by |
|---|---|---|
| `VALIDATE-1` | `documented` | Actual runtime boundary and payload source, not a TypeScript annotation |
| `VALIDATE-2` | `documented` | Flow/call graph deciding canonicalization owner and competing defaults |
| `VALIDATE-3` | `documented` | Required field/application facts unavailable to a safe one-file AST rule |
| `VALIDATE-4` | `documented` | Consumer behavior and the operation’s path/code contract |

## Inputs

| Input | Evidence required |
|---|---|
| source boundary | Where untrusted data enters and how it is parsed |
| input schema | Required fields, primitive forms, allowed values and nested paths |
| canonical form | One normalized representation and its owner |
| application facts | Other fields, state, records, clock or provider facts needed by rules |
| error consumers | Callers needing paths, codes, parameters or human text |

## Rules

1. Validate runtime data before treating it as trusted, regardless of annotation or cast.
2. Normalize once at the first boundary owning external representation.
3. Keep shape checks at the boundary and context rules where all facts meet.
4. Return stable field paths and machine codes; wording is not the contract.
5. Preserve validation meaning across transports and asynchronous consumers.
6. Apply each matching code independently.

## Exceptions

- **Trusted internal value.** A value from a validated boundary may skip `VALIDATE-1` when provenance
  is explicit and it has not crossed an untrusted boundary again.
- **Provider normalization.** An adapter may map provider spelling at its boundary but must emit the
  application canonical form.
- **Domain final authority.** An aggregate/value object may finish a `VALIDATE-3` invariant; the
  application still assembles facts and maps the failure contract.
- **Transport projection.** A controller/filter may map syntax under `VALIDATE-4`, not alter paths/codes.
- **Database constraint.** A database may reject a race or uniqueness conflict but does not erase the
  application rule or excuse input validation.

## Stops

Stop before writing source when the trust boundary is unnamed, canonicalization has competing owners,
a cross-field rule lacks a layer with all facts, or consumers disagree on path/code semantics. Stop if
the proposed proof is only a cast, message parser, database error or transport status.

## Proof

| Code | Minimum proof |
|---|---|
| `VALIDATE-1` | Boundary tests reject malformed, missing, extra and provider-shaped input before business logic |
| `VALIDATE-2` | Equivalent spellings produce one canonical value without downstream re-normalization |
| `VALIDATE-3` | Tests cover field combinations and application state, including a bypassing consumer |
| `VALIDATE-4` | Contract tests assert deterministic paths/codes independent of message or transport changes |

## Output

```text
boundary:   <first untrusted boundary or owning application layer>
canonical:   <canonical representation, or none>
rule:        <field, cross-field or application rule>
errors:      <stable field paths and machine codes>
situation:   <VALIDATE-1 | VALIDATE-2 | VALIDATE-3 | VALIDATE-4>
verdict:     <holds | violates | stop>
reason:      <trust, normalization, rule-ownership or error-contract fact>
proof:       <test or evidence proving the boundary>
```
