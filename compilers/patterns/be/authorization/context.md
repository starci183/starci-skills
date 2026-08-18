---
title: Authorization
runtime: true
source: en.md
sourceHash: d79a1224283891c166a7c6b730dc3a4a19ecdc452c931cff25c096440177794f
contextVersion: 1
---

# Authorization

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is a shape already accepted: an operation someone signed off on — a mutation, a query, a
subscription, a job, a webhook — together with the subject it serves and the record it reaches for.
This pattern does not re-open that decision. Its output is source architecture: which file carries
the guard, which file carries the ownership comparison, what the refusal is named, and which layer
must stay ignorant of the whole question.

## Law

Authentication asks **who is this**. Authorization asks **whether they may do this, to this**. They
are different questions, they are answered in different places, and the reason they are separate is
that one of them can be answered without reading any data and the other cannot.

A guard sees the request. It can prove a token, resolve a user and refuse an anonymous caller — and
that is the whole of what it can do, because the row the caller is reaching for has not been loaded
yet. Whether this caller owns this record, holds a paid relationship to this product, or belongs to
the tenant that owns this row are questions about a row, and only the handler holds both the row and
the identity at the same moment.

The question that settles where a check belongs: **does the answer depend on the request's data?**
"Is anyone signed in" does not, and belongs to the door. "May this person edit *that*" does, and
belongs to the handler.

**This is binding, not advisory.** Every door that reads an identity and every handler that reaches
for a row sits under exactly one of the codes below. There is no operation too small to carry one: a
one-line delete is `AUTHZ-3` for the same reason a premium content query is `AUTHZ-5`. "It is only an
internal mutation" is where this rule gets skipped most often, because an internal mutation is
exactly the one that later grows a second caller.

Most of this law is not machine-checkable, and the **Layer held** table below says so rather than
implying uniform enforcement. Authorization is decided against a row; a parser does not know which
row a handler is reaching for or what owning it means.

## Situation codes

Every situation this module governs carries a code, `AUTHZ-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `AUTHZ-1` | The handler states its own precondition even though the door already carries a guard | Requires: the handler checks its own identity precondition, above every other gate. Forbids: deleting a handler's `if (!user)` on the grounds that the resolver in front of it carries a guard |
| `AUTHZ-2` | A door reads an identity | Requires: a method reading the authenticated user carries a guard on that method or its class. Forbids: a door that reads an identity parameter while nothing on the method or the class established one |
| `AUTHZ-3` | Ownership is decided on the loaded row, not on the request | Requires: the row is loaded, and ownership is compared against the loaded row's owner. Forbids: comparing two ids the caller supplied, or trusting an owner id carried in the request |
| `AUTHZ-4` | Which refusal to answer with is a deliberate decision | Requires: the refusal names which fact it is — forbidden or not-found — and a private row's refusal is a not-found. Forbids: answering "forbidden" for a row the caller could not otherwise know exists; answering "not found" where the caller legitimately knows the row |
| `AUTHZ-5` | Entitlement is a state; a relationship row is not that state | Requires: the query names the field that distinguishes the entitled state from the merely-related row. Forbids: treating the existence of a relationship row as the entitlement |
| `AUTHZ-6` | Operator, service token and product user are three different subjects | Requires: one guard per subject — product viewer, platform operator, service token. Forbids: hanging operators, service tokens and product users off one guard |

Six codes, and it ends at six. A situation that genuinely has no code is a recorded rule change, not
a seventh number added in passing.

## Reading an accepted shape

1. **Read what the shape states.** It states the operation kind, the subject it serves, and the
   record the operation reaches for. Those three facts are settled; do not renegotiate them here.
2. **Read what it does not state, and therefore does not resolve.** A shape rarely states which
   guard establishes the identity, which field on the loaded row carries ownership, which field
   distinguishes the entitled state, or whether the caller could know the row exists. Each of those
   is an input this pattern must be given before it can emit a file.
3. **Resolve outermost first.** Start at the door: does this method or its class read an identity,
   and what establishes it (`AUTHZ-2`, and `AUTHZ-6` for which subject's guard). Then move inward to
   the handler: its own precondition (`AUTHZ-1`), the loaded row (`AUTHZ-3`), the entitled state
   (`AUTHZ-5`), and last the wording of the refusal (`AUTHZ-4`).
4. **Ask each code's question.** `AUTHZ-1`: if a second caller reached this handler tomorrow without
   the old door, is the operation still safe? `AUTHZ-2`: what proved that the identity this door
   reads belongs to the caller? `AUTHZ-3`: does this check read anything the caller could not choose
   for itself? `AUTHZ-4`: iterating ids and reading only the error code, would I learn something I
   am not allowed to know? `AUTHZ-5`: if the system creates this relationship row for every visitor,
   whom does my check still refuse? `AUTHZ-6`: if a product user is elevated inside their own
   organisation, can they reach this door?
5. **When two codes both match.** They are not alternatives — a single operation ordinarily carries
   several, one per file position. `AUTHZ-1` is the door-independent precondition inside the
   handler; `AUTHZ-2` is the door itself. `AUTHZ-3` decides whether to refuse; `AUTHZ-4` decides
   which refusal is said. `AUTHZ-2` asks whether there is a guard; `AUTHZ-6` asks whose guard it is —
   an operator door carrying a viewer guard satisfies `AUTHZ-2` and violates `AUTHZ-6`. Emit an
   output block for each, and let each block's `reason` name the fact that excludes its neighbour.

## `AUTHZ-1` — the handler owns its own precondition

**Situation.** The handler receives `user` in the command and checks for itself that `user` exists,
even though the resolver in front of it carries a guard. A later reader can see two layers of check
and mistake them for redundancy.

**What it emits in source.** An `if (!user)` refusal at the top of the handler's `process`, above the
cheap validation and above every query, in a handler whose resolver already carries a guard. That
redundancy is the code. The authorization rule lives in the handler, where a second caller can reach
it — not in a service beside the handler, because a service has no message and the next door will
grow its own copy.

**Boundary.** It is not `AUTHZ-2`: that code is about the **door**, where the identity is
established; this one is about the **handler**, where the identity is used, and a correct system has
both rather than choosing one. It is not `AUTHZ-3`: `AUTHZ-1` only asks "is there anyone". The moment
the question becomes "is it this person", it is `AUTHZ-3`, and that question needs a row.

## `AUTHZ-2` — the door that reads an identity carries the guard

**Situation.** A resolver method (or controller method) has a parameter that reads the authenticated
user, but neither the method nor the class carries a guard. The code compiles, runs, and the handler
still receives something called `user`.

**What it emits in source.** A guard decorator on the method that reads the identity, or on its
class: `@UseGuards(...)` standing above the parameter that reads the user. The lint rule
`identity-needs-guard` (export `identityNeedsGuard`, in `@canon-be`) counts three
parameter decorators as identity readers — `IDENTITY_PARAM_DECORATORS` — and climbs from the method
to its class via `hasGuard`.

**Boundary.** It is not `AUTHZ-1`, which lives in the handler rather than at the door. It is not
`AUTHZ-6`: `AUTHZ-2` asks **whether there is a guard**, `AUTHZ-6` asks **whose subject's guard it
is** — an operator door wearing a user guard satisfies `AUTHZ-2` and violates `AUTHZ-6`. This is the
only code in the module with a lint rule, because the question is answerable inside **one file**:
does this method, or its class, carry a guard. Nothing about the row is needed to answer it.

## `AUTHZ-3` — ownership is decided on the loaded row

**Situation.** The request names which record, not **whose** record. `request.reviewId` is the record
the caller **named**, not the record the caller **owns**.

**What it emits in source.** A `findOne` by the requested id, a not-found on the miss, then a
comparison such as `review.userId !== user.id` — the comparison reads the loaded row, and the request
supplied only which row to load.

**Boundary.** It is not `AUTHZ-1`, which only asks whether anyone is signed in. It is not `AUTHZ-4`:
`AUTHZ-3` decides **whether to refuse**, `AUTHZ-4` decides **which refusal is said** — a correct
`AUTHZ-3` can still leak at `AUTHZ-4`. It is not `AUTHZ-5`: `AUTHZ-3` asks "whose row is this",
`AUTHZ-5` asks "what state is this relationship in".

## `AUTHZ-4` — which refusal is said is a decision

**Situation.** "You may not edit this" and "this does not exist" are two **different facts**, and
clients usually display them in two different ways. Ordinarily each case deserves its own exception.
The exception is the record the caller **could not have known exists**: there, answering "forbidden"
is itself the confirmation that the record exists, and existence was the secret.

**What it emits in source.** A collapsed refusal such as `if (!plan || plan.userId !== user.id)`
answering one not-found for both "missing" and "not yours", with an e2e flow proving an intruder gets
that answer and that nothing was written. The log carries the real reason the refusal was softened;
the caller does not — if the log loses the reason too, the next investigation has nothing to read.

**Boundary.** It is not `AUTHZ-3`, which decides whether to refuse at all. Its **mirror failure** is
answering "not found" for a record the caller **legitimately knows** — they just saw it in a listing
they were entitled to see — which sends a valid user chasing a bug that does not exist. Both
directions are invisible, so the choice has to be **stated**.

## `AUTHZ-5` — entitlement is a state, not a row

**Situation.** Enrollment, membership, subscription, trial. A row says this person **has a
relationship** with a product; it does not say **which** relationship. A trial row and a paid row are
both "enrollment", and they grant two different rights.

**What it emits in source.** A query that names the state column. The canonical proof is a pair of
guards over one relationship: one resolves-or-creates a trial row and always returns true, the other
reads the paid flag and refuses — the pair is the proof that the row and the state are different
facts. Name the state in the query, not in a comment.

**Boundary.** It is not `AUTHZ-3`, which asks whose row this is. It is not `AUTHZ-6`: `AUTHZ-5` is a
state of the **same subject**, `AUTHZ-6` is a **different subject**.

## `AUTHZ-6` — an operator is a different subject from a user

**Situation.** A platform operator, a service token and a product user are **three identities**.
Folding all three into one guard can let a customer's administrator operate the platform.

**What it emits in source.** Two subjects, two guard families, no shared base: an operator
authenticates with a mounted key on a header, a viewer with a session token, and neither can be
reached through the other. The subject also decides the transport: a door serving a non-user subject
says so, and that is one of the few valid reasons for that door not to be GraphQL.

**Boundary.** It is not `AUTHZ-2`, which asks only whether a guard exists at all; `AUTHZ-6` asks
which subject the guard serves, so a door can pass one and fail the other.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in `@canon-be`
catches it; `documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `AUTHZ-1` | `documented` | — |
| `AUTHZ-2` | `enforced` | `identity-needs-guard` (export `identityNeedsGuard`) |
| `AUTHZ-3` | `documented` | — |
| `AUTHZ-4` | `documented` | — |
| `AUTHZ-5` | `documented` | — |
| `AUTHZ-6` | `documented` | — |

**One enforced, five documented, none unrepresentable.** The gap is the point of this table, and it
is not a backlog. A rule aimed at `AUTHZ-3`, `AUTHZ-4` or `AUTHZ-5` would have to know which row a
handler is reaching for and what owning it means, so it could only fire on shape — and a rule that
fires on shape is one authors learn to disable, which leaves the law worse off than when nothing
enforced it. `AUTHZ-1` was measured and deliberately left alone: a rule refusing a handler's
`if (!user)` would fire on the majority of correct handlers in a CQRS tree.

`AUTHZ-2` is the one half that is decidable inside a single file: whether the method that reads the
identity, or its class, carries the decorator that establishes one. Nothing about the row is needed
to answer that. Every `documented` row is a risk that remains open, and what a rule would have to see
in order to hold it — or why no rule can — is recorded with it.

The transport layer holds `AUTHZ-2` and `AUTHZ-6`; the handler holds `AUTHZ-1`, `AUTHZ-3`, `AUTHZ-4`
and `AUTHZ-5`. A service beside the handler must stay ignorant of all six: it has no message, so the
next door would grow its own copy of the rule.

## Inputs

| Input | Evidence required |
|---|---|
| subject | Product viewer, platform operator or service token |
| door | The method or class that reads the identity, and what establishes it |
| row | The record being reached for, and how it is loaded |
| owner | The field on the loaded row that carries ownership |
| state | The field that distinguishes the entitled state from the related row |
| disclosure | Whether the caller could know the row exists without being told |

## Rules

1. A door that reads an identity carries the guard that establishes it.
2. A handler states its own identity precondition regardless of the door in front of it.
3. Ownership is read off a loaded row, never off the request.
4. A refusal names which of the two facts it is, and a private row's refusal is a not-found.
5. The log carries the real reason a refusal was softened; the caller does not.
6. An entitlement check names the field that carries the state.
7. One guard serves one subject.
8. An authorization rule lives in the handler, where a second caller can reach it.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **A public read.** `AUTHZ-2` applies to a door that READS an identity. A door that reads none is
  not exempt from authorization — it has no identity to authorize, which is a different fact and
  belongs in the operation's own description.
- **Optional identity.** `AUTHZ-2` is satisfied by a guard that permits an anonymous caller and
  populates the identity when there is one, because the identity is still established rather than
  assumed. What it refuses is the absence of any guard at all.
- **Ownership by relationship.** `AUTHZ-3` accepts a load that scopes by owner in the `where` clause
  instead of comparing afterwards, provided the owner value comes from the authenticated identity and
  not from the request. The invariant is which side of the comparison the caller controls.
- **A legitimately known row.** `AUTHZ-4` wants a named forbidden when the caller reached the row
  through a listing they were entitled to see. Softening that one to a not-found is the mirror
  failure, and it costs a support ticket rather than a secret.
- **A single-state relationship.** `AUTHZ-5` collapses to an existence check only where the
  relationship has exactly one meaning and the schema cannot express a second. The moment a second
  state is added, every existence check over that relationship is a defect.
- **An operator acting as a viewer.** `AUTHZ-6` allows an operator surface to read a viewer's data,
  provided it authenticates as an operator and says whose data it is reading. What it refuses is one
  guard that answers "yes" to both subjects.

## Output

One block per file the accepted shape produces.

```text
operation: <mutation | query | subscription | job | webhook>
subject: <viewer | operator | service token>
situation: <AUTHZ-1 … AUTHZ-6>
door: <the guard that establishes the identity, or none>
row: <the record loaded, and the field compared>
refusal: <forbidden | not-found, and why that one>
reason: <the business fact that excludes the adjacent code>
```
