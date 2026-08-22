# Validation

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is an accepted operation and its input shape. This module decides where untrusted data
becomes a canonical, trusted application value and how failures remain usable to callers. It does not
choose the external door, static narrowing, persistence access or refactoring shape. Validation is a
boundary contract, not a collection of convenient checks scattered through handlers.

## Law

Untrusted data is rejected at the first boundary that can name its shape. Normalization happens once
at the boundary that owns the representation, and the canonical form is carried inward without being
silently changed again. Rules involving several fields or current application state run at the layer
that can see all of those facts. Failures use one stable field-error contract with machine-readable
paths and codes; presentation text and transport status are separate concerns.

The separation is deliberate. `type-safety` narrows what the compiler can know; `transport` places the
external door; `data-access` validates database constraints and handles; `maintainability` judges
duplication or orchestration. This module decides validation ownership and its observable error
meaning only.

## Situation codes

Every governed situation carries a fixed `VALIDATE-<n>` identity.

| Code | Situation | What the source must look like |
|---|---|---|
| `VALIDATE-1` | Untrusted input reaches an application boundary | The boundary parses and rejects the declared shape before application code treats it as trusted |
| `VALIDATE-2` | Input needs canonicalization | One owning boundary trims, case-folds, parses or defaults once and passes the canonical representation inward |
| `VALIDATE-3` | A rule spans fields or application state | Cross-field and context-dependent rules run where all required facts are available, with no false claim that field syntax alone is enough |
| `VALIDATE-4` | A caller needs validation failures | Errors expose stable field paths and machine codes in one contract; wording and transport status are not the identity |

`VALIDATE-1` is about trust, while `VALIDATE-2` is about representation. `VALIDATE-3` is about rule
ownership, while `VALIDATE-4` is about failure shape. They may apply to one request independently.

## Reading an accepted shape

1. Read the operation’s declared input and identify where bytes, JSON, GraphQL variables, messages or
   provider responses first enter the application.
2. Separate syntactic shape checks from canonicalization and from rules requiring another field or
   current state.
3. Assign normalization to the first boundary that owns the representation; record the canonical
   form that downstream code receives.
4. Identify every consumer of a validation failure and choose one stable path/code contract.
5. Apply all matching codes independently. A DTO can violate `VALIDATE-1` and `VALIDATE-2` while an
   application rule separately resolves to `VALIDATE-3`.

## `VALIDATE-1` — untrusted input stops at the boundary

**Situation.** Data arrives from a client, message broker, file, environment, provider or test
fixture and is not trusted merely because a TypeScript annotation describes it.

**What it emits in source.** A boundary parser/validator checks presence, primitive shape, allowed
values and basic syntax before handing a trusted input type to application code. Invalid input exits
through the validation contract; it is not allowed to fail later as a domain or database accident.

**Recognition signs.** A handler accepts `any`-shaped data and immediately calls business methods; a
cast is treated as validation; provider payloads are used before parsing; only the happy path has a
shape check.

**Boundary.** Not `TYPE-*`: a compile-time type does not prove runtime data. Not `TRANSPORT`: the
resolver/controller is the door, but this code asks whether its input is trusted before use. Not
`DATA-*`: database constraints are a later persistence boundary.

## `VALIDATE-2` — normalize once

**Situation.** The same input can have several equivalent spellings or an omitted/default form, and
downstream code needs one canonical value.

**What it emits in source.** The owning boundary performs the normalization once — trim, case-fold,
parse, sort, convert units or apply an approved default — and names the resulting canonical field or
value. Inner layers consume it without re-trimming, re-parsing or applying a competing default.

**Recognition signs.** `trim()` or `toLowerCase()` appears in multiple layers; one caller treats an
empty string as absent while another treats it as meaningful; defaults differ between DTO, handler and
repository.

**Boundary.** Not `DOMAIN-2`: a value object may enforce domain validity after this boundary, while
this code chooses where external representation is canonicalized. Not `MAINTAIN-*`: repeated
normalization is a validation ownership error here; maintainability may separately judge duplication.

## `VALIDATE-3` — cross-field and application rules run where facts meet

**Situation.** Validity depends on two or more fields, an aggregate state, an entitlement, a clock,
an existing record or another application fact.

**What it emits in source.** Field-level shape rules stay at the input boundary. The cross-field or
context-dependent rule runs in an application/domain policy that can see all required facts, returns a
domain decision or stable failure, and cannot be bypassed by choosing another transport.

**Recognition signs.** A DTO tries to query a database; a resolver checks a rule that a queue consumer
can bypass; only one of `start`/`end` is checked; a uniqueness rule is described as a string format.

**Boundary.** Not `DOMAIN-1`: an aggregate invariant may be the final authority once application
facts are assembled, but this code first identifies the layer that can see all inputs. Not
`DATA-*`: a database uniqueness constraint is not the complete application rule.

## `VALIDATE-4` — field errors have a stable contract

**Situation.** A caller needs to associate one or more validation failures with input fields and act
on them consistently across GraphQL, REST, jobs or in-process callers.

**What it emits in source.** A deterministic error collection with stable field paths, machine codes
and optional structured parameters. The contract has one shape for one operation family; human message
text may be localized or revised without changing the code/path identity.

**Recognition signs.** Clients parse message text; errors use different keys for the same field; an
array index or nested path is lost; a transport status is used as the validation code; a cross-field
error has no path or named relation.

**Boundary.** Not exception identity: the exception class/code may be chosen elsewhere; this code
defines field-level validation payload. Not `TRANSPORT`: HTTP/GraphQL formatting maps the contract at
the door but does not redefine its identity.

## Layer held

All four situations are currently `documented`. Their correct owner depends on accepted input shape,
consumer behavior and application facts; no existing canonical rule is claimed for them.

| Code | Tier | Held by |
|---|---|---|
| `VALIDATE-1` | `documented` | Runtime trust depends on the actual boundary and payload source, not a TypeScript annotation |
| `VALIDATE-2` | `documented` | Canonicalization ownership and competing defaults require a flow/call-graph reading |
| `VALIDATE-3` | `documented` | The required field and application facts cannot be safely inferred from one AST |
| `VALIDATE-4` | `documented` | Stable path/code meaning depends on consumers and the operation’s error contract |

## Inputs

| Input | Evidence required |
|---|---|
| source boundary | Where untrusted bytes/objects first enter and how they are parsed |
| input schema | Required fields, primitive forms, allowed values and nested paths |
| canonical form | One normalized representation and the boundary that owns it |
| application facts | Other fields, current state, existing records, clock or provider facts needed by rules |
| error consumers | Callers that need field paths, codes, parameters or human text |

## Rules

1. Validate runtime data before treating it as trusted, regardless of static annotations or casts.
2. Normalize once at the first boundary that owns the external representation.
3. Keep field shape checks at the boundary and cross-field/application rules where all facts meet.
4. Return stable field paths and machine codes; do not make message wording the contract.
5. Preserve the same validation meaning across transports and asynchronous consumers.
6. Apply each matching situation independently; one input may have trust, normalization, rule and
   error-contract decisions at once.

## Exceptions

- **Trusted internal value.** A value produced by a validated boundary may skip `VALIDATE-1` when its
  provenance is explicit and it has not crossed an untrusted boundary again.
- **Normalization required by a provider.** An adapter may translate provider spelling at its own
  boundary; it must emit the application’s canonical form and not force every caller to repeat it.
- **Cross-field rule in a domain object.** An aggregate/value object may be the final authority for a
  domain invariant under `VALIDATE-3`; the application layer still assembles the facts and maps the
  failure contract.
- **Transport projection.** A controller or filter may map field errors into GraphQL/HTTP syntax under
  `VALIDATE-4`; it may not change machine paths/codes per transport.
- **Database constraint.** A database may reject a race or uniqueness conflict, but that does not
  erase the application rule or excuse unvalidated input.

## Stops

Stop before writing source when the trust boundary is unnamed, the canonical form has competing
owners, a cross-field rule lacks one layer with all required facts, or consumers disagree on field path
and code semantics. Stop if a proposed fix relies on a cast, a message-string parser, a database error
or a transport status as validation proof.

## Proof

| Code | Minimum proof |
|---|---|
| `VALIDATE-1` | Boundary tests reject malformed, missing, extra and provider-shaped input before business logic runs |
| `VALIDATE-2` | Equivalent spellings produce one canonical value and downstream tests prove no second normalization is needed |
| `VALIDATE-3` | Tests cover each field combination and relevant application state, including a bypassing consumer |
| `VALIDATE-4` | Contract tests assert deterministic field paths/codes and prove message/transport changes do not alter them |

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
