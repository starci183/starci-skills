---
id: be-patterns-exception-identity-index
title: INDEX.md
slug: /be/patterns/exception-identity
sidebar_label: exception-identity
sidebar_position: 0
description: Binding rules for the one word a failure is known by, written in three alphabets that must agree.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `exception-identity`

## Law

A failure's identity is the word that tells it apart from every other failure the application can
produce. That a failure IS a named thing with data attached is settled elsewhere. This module settles
the name: **one word, written in three alphabets, and all three say the same thing.**

The class name, the code and the metadata type are not three decisions. They are one decision spelled
three ways, because three consumers read it and none of them can read the others:

- The **class name** is what the gates see. Every rule guarding exceptions matches a name ending in
  `Exception`, so a failure that spells its name differently is enforced by none of them.
- The **code** is what the client sees. It is stamped onto every GraphQL error and put in the body of
  every REST error, and the caller matches on it rather than on the status, because one response can
  carry several errors of different severities.
- The **metadata type** is what the throw site sees. It is the contract the caller has to satisfy,
  and the place the failure's second field will land.

The question that settles whether a declaration has an identity: **if this failure and the one
declared above it both arrived at a client, could anything tell them apart without reading English?**
If the answer is the message, it has no identity — it has a sentence.

**This is binding, not advisory.** Every class extending the house exception base has an identity
situation, and that situation has a code below. There is no failure too small to carry one: a
misconfigured header check is `IDENTITY-1` for the same reason a domain refusal is, and "it is only
an internal error nobody catches" is the most common place this gets skipped.

## Situation Codes

Every situation this module governs carries a code, `IDENTITY-<n>`. The code names the SITUATION; the
tier and anchor tables below name what actually holds it and where it can be checked. Those are three
different facts and this module keeps them apart on purpose.

| Code | What it requires | What it forbids |
|---|---|---|
| `IDENTITY-1` | A class extending `AbstractException` is named `*Exception` | `*Error`, a bare noun, or any suffix the other exception rules cannot match |
| `IDENTITY-2` | The code is the class name spelled in SCREAMING_SNAKE, passed to `super()` as a literal | A code chosen by hand, a code copied from the declaration above it, a code assembled at runtime |
| `IDENTITY-3` | A rename moves the class and the code together, on purpose, with a migration | The silent half-rename that leaves class and code disagreeing forever |
| `IDENTITY-4` | The constructor's metadata parameter is typed `<Class>Metadata`, even when that alias adds no field | A parameter typed as the shared base, an untyped parameter, or a type named for something else |
| `IDENTITY-5` | `httpStatus` is set only where the status IS the contract | Reaching for a status so that one failure can be told apart from another |

`IDENTITY-3` IS A SITUATION, NOT A CODE CHANGE PROCEDURE. It fires the moment a class name is edited,
including in a refactor that looks like tidying, because the edit is client-visible whether or not
anybody intended it to be.

`IDENTITY-5` names a situation whose correct outcome is usually *omit the status entirely*. A
declaration that sets no `httpStatus` has satisfied it; a declaration that sets one has to say which
caller contract required it.

## Tầng giữ

Which tier actually holds each code — not which tier we would like to hold it.

| Code | Tier | Held by |
|---|---|---|
| `IDENTITY-1` | `enforced` | `exception-name-ends-in-exception` (export `exceptionNameEndsInException`) — reports any `ClassDeclaration` whose superclass is `AbstractException` and whose name fails `/Exception$/` |
| `IDENTITY-2` | `enforced` | `exception-code-matches-class-name` (export `exceptionCodeMatchesClassName`) — two messages: `notLiteral` for an assembled code, `mismatch` when the letters of the code and the letters of the class name differ |
| `IDENTITY-3` | `documented` | Nothing mechanical. A rename is two revisions of one file; a rule that reads one file at a time cannot see the previous name |
| `IDENTITY-4` | `enforced` | `exception-metadata-type-named-for-class` (export `exceptionMetadataTypeNamedForClass`) — two messages: `untyped` for a bare destructuring, `named` when the annotation is not `<Class>Metadata` |
| `IDENTITY-5` | `documented` | Nothing mechanical. Whether a status was set because a caller contract demands it or because the author wanted this failure to look different is intent, and intent is not in the AST |

No code in this module is held at `unrepresentable`. It could be: a branded `ExceptionCode` type
derived from the class name would make a wrong code unwritable rather than merely reported. That is a
proposal, not the state of the source, and this table states the state of the source.

Three of five enforced, two documented. That gap is the point of this table, not a defect in it —
`IDENTITY-3` and `IDENTITY-5` were stated as review-held from the first version of this law, for the
stated reason that neither is visible in one file.

## Anchor

A law that cannot be pointed at in real code is a proposal. Every code here points at source, with
what to read there.

| Code | Anchor | What to look for |
|---|---|---|
| `IDENTITY-1` | `src/modules/platform/exceptions/errors/` | 283 classes extend `AbstractException` across the folder tree and every declared name ends in `Exception`. A search for `class \w+Error extends AbstractException` returns nothing — that emptiness is the anchor, because it is what the rule bought |
| `IDENTITY-2` | `src/modules/platform/exceptions/errors/api/graphql.ts` | `GraphQLDataNotFoundException` passes the literal `"GRAPHQL_DATA_NOT_FOUND_EXCEPTION"`. The acronym carve-out is not hypothetical: the naive split would read `GRAPH_QL_`, the rule compares letters, and real source depends on that |
| `IDENTITY-3` | `src/modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts` (`formatError` copies `original.code` into `extensions.code`), `src/modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`code: exception.code` in the response body), and the code literals asserted across `src/tests/e2e/*.e2e-spec.ts` | The chain from class name to wire, in three files. The e2e assertions on literal codes are the mechanical witness that a code is a contract somebody pinned |
| `IDENTITY-4` | `src/modules/platform/exceptions/errors/guards/admin-api-key-not-configured.ts` | `export type AdminApiKeyNotConfiguredExceptionMetadata = AbstractExceptionMetadata` — the empty alias, declared anyway. 45 declarations in the tree carry one |
| `IDENTITY-5` | `src/modules/platform/exceptions/errors/abstract.ts` (`readonly httpStatus?: number`) and `src/modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR`) | The status is optional on the base and defaults at the boundary. 90 of 283 declarations set one, and not one of them is told apart from its neighbour by it |

Every code in this module is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| class | The `class X extends AbstractException` declaration, read whole — not the filename |
| code | The second argument of the `super()` call, exactly as written |
| metadata type | The type annotation on the constructor's first parameter, including through an `= {}` default |
| consumers | Which clients, alert rules or specs match this code as a literal |
| status contract | Whether a named caller requires a specific HTTP status, or the default is correct |

## Invariants

- The class name, the code and the metadata type name are one word in three alphabets.
- The code is derived from the class name, never chosen beside it.
- The code is a literal at the declaration site, never assembled.
- The metadata type is named for its own exception, even when it holds no field.
- The HTTP status never distinguishes two failures.
- A situation code maps to exactly one ruling, and no ruling serves two codes.
- Every class extending the house base resolves to a verdict under every code. No declaration is out
  of scope for being small, internal, or unlikely to be caught.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Acronym split.** `IDENTITY-2` does not rule on underscore placement inside an acronym.
  `GRAPHQL_DATA_NOT_FOUND_EXCEPTION` and `GRAPH_QL_DATA_NOT_FOUND_EXCEPTION` name the same class,
  there is no correct split, and a rule insisting on one would fire on code that is right. The
  letters are the ruling.
- **Released client.** `IDENTITY-3` allows the old code to stay on the wire for a released client —
  by keeping the OLD CLASS NAME until that client is retired. What is refused is the half-rename, not
  the delay.
- **Status as contract.** `IDENTITY-5` allows `httpStatus` where the status is the thing the caller
  agreed to: a guard answering 401, an upload refused as 413, a misconfiguration that is honestly a
  500. Setting it there does not excuse any other code.
- **Framework-shaped failures.** A class extending a framework base is not this module's business; it
  is refused upstream by `EXCEPTION-3`. This module governs identity within the house base only.
- **The empty payload.** `IDENTITY-4` has no small-case exemption. An exception with nothing of its
  own to say still declares its alias, for the same reason `EXCEPTION-2` keeps the empty object: it
  is the place the first field lands.

## Output

```text
class:    <declaration as written>
code:     <literal passed to super()>
metadata: <type of the constructor's first parameter>
status:   <httpStatus, or "default">
situation: <IDENTITY-1 | IDENTITY-2 | IDENTITY-3 | IDENTITY-4 | IDENTITY-5>
verdict:  <holds | violates>
reason:   <the consumer that could not tell this failure from its neighbour>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, `audit.md` only while reviewing the canon, and
`changelog.md` when a version marker disagrees with what you are reading.

## Scope

This module states a rule true of any back end that names its failures. Examples are ordinary
TypeScript in the shape a Nest application writes, naming no product, no private module and no
repository. The `Anchor` table is the one place that cites repository-relative paths, because a law
that cannot be pointed at in real code is a proposal.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
major bump (`x.00`) is reserved for a change to the module's shape or the shelf it sits on. Situation
codes are never renumbered: they are cited from other law files and from historical task records, and
a renumbering silently breaks a citation somebody already made.
