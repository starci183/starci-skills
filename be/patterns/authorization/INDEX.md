---
id: be-patterns-authorization-index
title: INDEX.md
slug: /be/patterns/authorization
sidebar_label: authorization
sidebar_position: 0
description: Binding rules for where an authorization check belongs, what it reads, and how it refuses.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `authorization`

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

Most of this law is not machine-checkable, and the `Tầng giữ` table below says so rather than
implying uniform enforcement. Authorization is decided against a row; a parser does not know which
row a handler is reaching for or what owning it means.

## Situation Codes

Every situation this module governs carries a code, `AUTHZ-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `AUTHZ-1` | The handler checks its own identity precondition, above every other gate | Deleting a handler's `if (!user)` on the grounds that the resolver in front of it carries a guard |
| `AUTHZ-2` | A method reading the authenticated user carries a guard on that method or its class | A door that reads an identity parameter while nothing on the method or the class established one |
| `AUTHZ-3` | The row is loaded, and ownership is compared against the loaded row's owner | Comparing two ids the caller supplied, or trusting an owner id carried in the request |
| `AUTHZ-4` | The refusal names which fact it is — forbidden or not-found — and a private row's refusal is a not-found | Answering "forbidden" for a row the caller could not otherwise know exists; answering "not found" where the caller legitimately knows the row |
| `AUTHZ-5` | The query names the field that distinguishes the entitled state from the merely-related row | Treating the existence of a relationship row as the entitlement |
| `AUTHZ-6` | One guard per subject: product viewer, platform operator, service token | Hanging operators, service tokens and product users off one guard |

Six codes, and it ends at six. A situation that genuinely has no code is a rule change recorded in
`changelog.md`, not a seventh number added in passing.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/authorization.mjs`](../../../sources/be/authorization.mjs) catches it; `documented`
means nothing mechanical holds it and only a reader does.

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
to answer that. Every `documented` row is named again in `audit.md` under "Rủi ro còn mở", with what
a rule would have to see in order to hold it — or why no rule can.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `AUTHZ-1` | `src/features/api/core/graphql/mutations/courses/submit-course-review/submit-course-review.handler.ts` · `src/features/api/core/graphql/mutations/installment-plans/pay-next-installment/pay-next-installment.handler.ts` | An `if (!user)` refusal at the top of `process`, above the cheap validation and both queries, in handlers whose resolvers already carry a guard. That redundancy is the code |
| `AUTHZ-2` | `sources/be/authorization.mjs` → `IDENTITY_PARAM_DECORATORS`, `hasGuard`, `identityNeedsGuard` · `src/features/api/core/graphql/mutations/courses/update-course-review/update-course-review.resolver.ts` | The three parameter decorators the rule counts as identity readers, the climb from the method to its class, and a live door carrying `@UseGuards(...)` above the parameter that reads the user |
| `AUTHZ-3` | `src/features/api/core/graphql/mutations/courses/delete-course-review/delete-course-review.handler.ts` | `findOne` by the requested id, a not-found on the miss, then `review.userId !== user.id` — the comparison reads the loaded row, and the request supplied only which row to load |
| `AUTHZ-4` | `src/features/api/core/graphql/mutations/installment-plans/pay-next-installment/pay-next-installment.handler.ts` · `src/tests/e2e/installment-plan-queries.e2e-spec.ts` | `if (!plan \|\| plan.userId !== user.id)` collapses "missing" and "not yours" into one not-found; the flow proves an intruder gets that answer and that nothing was written |
| `AUTHZ-5` | `src/modules/bussiness/guards/graphql-must-enrolled.guard.ts` · `src/modules/bussiness/guards/graphql-enrollment.guard.ts` · `src/modules/bussiness/user/user.service.ts` → `checkEnrollment`, `resolveOrCreateTrialEnrollment` | Two guards over one relationship: one resolves-or-creates a trial row and always returns true, the other reads the paid flag and refuses. The pair is the proof that the row and the state are different facts |
| `AUTHZ-6` | `src/modules/bussiness/guards/admin-access.guard.ts` · `src/modules/bussiness/guards/graphql-admin-access.guard.ts` · `src/modules/integrations/keycloak/guards/keycloak-auth-graphql.guard.ts` | Two subjects, two guard families, no shared base: an operator authenticates with a mounted key on a header, a viewer with a session token, and neither can be reached through the other |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| subject | Product viewer, platform operator or service token |
| door | The method or class that reads the identity, and what establishes it |
| row | The record being reached for, and how it is loaded |
| owner | The field on the loaded row that carries ownership |
| state | The field that distinguishes the entitled state from the related row |
| disclosure | Whether the caller could know the row exists without being told |

## Invariants

- A door that reads an identity carries the guard that establishes it.
- A handler states its own identity precondition regardless of the door in front of it.
- Ownership is read off a loaded row, never off the request.
- A refusal names which of the two facts it is, and a private row's refusal is a not-found.
- The log carries the real reason a refusal was softened; the caller does not.
- An entitlement check names the field that carries the state.
- One guard serves one subject.
- An authorization rule lives in the handler, where a second caller can reach it.

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

```text
operation: <mutation | query | subscription | job | webhook>
subject: <viewer | operator | service token>
situation: <AUTHZ-1 … AUTHZ-6>
door: <the guard that establishes the identity, or none>
row: <the record loaded, and the field compared>
refusal: <forbidden | not-found, and why that one>
reason: <the business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end that authenticates at a transport boundary and decides
authorization inside handlers. Examples are ordinary TypeScript in a NestJS-shaped application: they
name no product, no repository and no course. The rule id and the decorator names the rule matches
are the only proper nouns, because they are the enforcement identity and a renamed rule cannot be
cited in a config.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering an `AUTHZ-<n>` code is a major change, not an increment.
