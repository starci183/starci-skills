---
title: Exception identity
---

# Exception identity

## LOADS

None.


## Record

The input to this pattern is a shape already accepted: a capability, a guard, a contract or a layout
that somebody decided the application will have. That decision is not re-opened here. The output is
source architecture — which file the failure is declared in, which layer holds it, what its class is
named, what literal it passes to `super()`, what type its constructor parameter carries, and whether
it sets a status at all. The design question was "this can fail". The question here is "where does
that failure live in source, and what is it called".

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

## Situation codes

Every situation this module governs carries a code, `IDENTITY-<n>`. The code names the SITUATION; the
tier and anchor tables below name what actually holds it and where it can be checked. Those are three
different facts and this module keeps them apart on purpose.

| Code | Situation | What the source must look like |
|---|---|---|
| `IDENTITY-1` | Naming a new class that extends the house base | A class extending `AbstractException` is named `*Exception` — never `*Error`, a bare noun, or any suffix the other exception rules cannot match |
| `IDENTITY-2` | Choosing the code the client will match | The code is the class name spelled in SCREAMING_SNAKE, passed to `super()` as a literal — never a code chosen by hand, a code copied from the declaration above it, or a code assembled at runtime |
| `IDENTITY-3` | Renaming a class that already exists | A rename moves the class and the code together, on purpose, with a migration — never the silent half-rename that leaves class and code disagreeing forever |
| `IDENTITY-4` | Declaring the payload type of the failure | The constructor's metadata parameter is typed `<Class>Metadata`, even when that alias adds no field — never a parameter typed as the shared base, an untyped parameter, or a type named for something else |
| `IDENTITY-5` | Choosing an HTTP status | `httpStatus` is set only where the status IS the contract — never reached for so that one failure can be told apart from another |

`IDENTITY-3` IS A SITUATION, NOT A CODE CHANGE PROCEDURE. It fires the moment a class name is edited,
including in a refactor that looks like tidying, because the edit is client-visible whether or not
anybody intended it to be.

`IDENTITY-5` names a situation whose correct outcome is usually *omit the status entirely*. A
declaration that sets no `httpStatus` has satisfied it; a declaration that sets one has to say which
caller contract required it.

## Reading an accepted shape

1. **Read what the shape states.** It states that some path can refuse: a guard rejects, a lookup
   finds nothing, a configuration is missing, an upload is too large. Each such refusal is one class
   extending `AbstractException`, in one file, under the errors tree.
2. **Read what the shape does not state, and therefore does not resolve.** A shape never states the
   class name, the literal code, the metadata type name or the status. It also never states which
   clients, alert rules or specs match a code as a literal — so it cannot on its own resolve
   `IDENTITY-3`, which needs that list as evidence.
3. **Resolve outermost first.** The class name comes first, because the code is derived from it and
   because every other rule in this module matches on the `Exception` suffix. Then the code, then the
   metadata type, then the status last — the status is the only one that may legitimately be absent.
4. **Ask each code's question in order.** `IDENTITY-1`: does the name end in `Exception`?
   `IDENTITY-2`: is the literal passed to `super()` the same letters as the class name?
   `IDENTITY-3`: is an existing name being edited, and who matches the old code right now?
   `IDENTITY-4`: is the constructor parameter annotated `<Class>Metadata`? `IDENTITY-5`: has a named
   caller committed to this status, or is the status being reached for to make the failure look
   different?
5. **When two codes both match, take the outer one first.** A class named `SomethingError` fails
   `IDENTITY-1`, and because the rules holding `IDENTITY-2` and `IDENTITY-4` also match on the
   `Exception` suffix, neither of those is even checked — fix the name, then re-ask. A rename that
   also fixes a suffix is `IDENTITY-1` *and* `IDENTITY-3`; satisfying `IDENTITY-1` does not excuse
   `IDENTITY-3`. A declaration that reaches for a status to become distinguishable is answering
   `IDENTITY-2` with the wrong tool, and is ruled under `IDENTITY-2`, not `IDENTITY-5`.

## `IDENTITY-1` — class name ends in `Exception`

**Situation.** You are naming a class that extends `AbstractException`. This is the place everyone
assumes is cosmetics, and it is not.

**What it emits in source.** One class declaration in the errors tree whose name ends in `Exception`.
The suffix is the only thing every other rule can see: the rule requiring an object parameter, the
rule requiring the house base, the rule requiring the errors folder — all of them match on that
suffix, while the throw-site rule recognises only `Error` and framework names. So a class named
`SomethingError` sits in the right folder, extends the right house base, is thrown at a real call
site, and **no rule checks it**. The gate stays silent, and silence reads as approval.

**Recognition signs.** The name ends in `Error`, or is a bare noun (`InvalidToken`, `QuotaExceeded`).
The class extends `AbstractException` but lint never says anything about it — even when you
deliberately break something else in the same file. Grepping the class name in the lint report
returns no line. The self-test: if I deliberately break another exception rule inside this class, does
the gate turn red? If not, the class is invisible.

**Boundary.** Not `EXCEPTION-3`: that is the same trap seen from the other end. `EXCEPTION-3` catches
a class extending a framework base — it looks like the house at the throw site. `IDENTITY-1` catches
a class named outside the convention — it looks like the house inside the folder. Both are failures
that pass every gate by being invisible to the gate. Not `IDENTITY-2`: `IDENTITY-1` rules on the
class name, `IDENTITY-2` on the code following that name; break `IDENTITY-1` and `IDENTITY-2` is not
checked at all, because its rule matches on the suffix too.

**Common business situations.** Porting an error in from an outside library (`ParseError`, kept by
inertia) · a short validation failure (`SlugTaken`) · an infrastructure failure (`S3UploadFailure`) ·
a timeout (`UpstreamTimeoutError`) · an error generated by codegen from a schema that already carries
a name.

## `IDENTITY-2` — the code is the class name in SCREAMING_SNAKE

**Situation.** You are writing the second argument of `super()`. This code is what the client matches,
so it is an outward contract. It is **derived** from the class name, never **chosen** beside it.

**What it emits in source.** A string literal at the declaration site, the same letters as the class
name, in SCREAMING_SNAKE. Two consequences of deriving it, both of them the point. First: nobody has
to look anything up. Whoever holds the class name knows the code; whoever holds the code finds the
class in one grep. A hand-chosen code is a **second name** for the same failure — and the second name
is the one that ends up in the client, the alert rule and the support ticket, while the first name is
the only one present in source. Second: uniqueness without effort. A code copied from the exception
declared just above is the most common way two unrelated failures share one identity. This has
actually happened: an OTP challenge and a course challenge reported one code, so a client matching on
code could not tell "missing lesson" from "missing sign-in step" — exactly the defect `EXCEPTION-1`
refuses framework exceptions to avoid, except this time it happened inside the house vocabulary.

**Recognition signs.** The code is visibly shorter than the class name (`REVIEW_FORBIDDEN` for
`DocumentNotOwnedException`). The code is a generic noun many failures could use (`NOT_FOUND`,
`FORBIDDEN`, `INVALID_INPUT`). The code is assembled from a template string, a constant, or
`${prefix}_NOT_FOUND`. Two files side by side in one folder carry the same code. The self-test: if I
grep this exact code string in the repository, do I land on the class? If not, the code is a second
name.

**Boundary.** Not `IDENTITY-1`: see above. Not `IDENTITY-3`: `IDENTITY-2` applies when **writing
new**, `IDENTITY-3` when **editing what exists**. Same law that the code follows the class name, but
the cost differs completely: writing new is free, editing has clients. Not `IDENTITY-5`: if you find
yourself choosing a status so two failures differ, you are answering `IDENTITY-2` with the wrong
tool. Underscore placement inside an acronym is not part of this law: `GRAPHQL_DATA_...` and
`GRAPH_QL_DATA_...` name the same class, there is no correct split, and a rule forcing one would fire
on code that is right. **The letters are the ruling, not the underscores.**

**Common business situations.** Copying the neighbouring error file and changing the class name but
not the code · a "not found" failure for a new entity · a code named after the endpoint instead of the
failure · a code assembled per tenant or per provider · a code shortened to keep the line short.

## `IDENTITY-3` — renaming a class changes the contract on the wire

**Situation.** The class exists, it has clients, and you want to rename it to something more correct.
Because the code is derived from the class name, a rename **is not a refactor** — it is a
client-visible change.

**What it emits in source.** Two edits in one revision — the class name and the `super()` literal
moved together — plus a migration for whoever matches the old code. That is the honest consequence,
and the reason to keep it. The alternative is a class carrying a code that preserves a name it no
longer has; this too has actually happened: a path-lookup failure still reported the code of an old
folder lookup, and no reader of either name could guess the other. So a rename is **a decision with a
migration**, not a tidy-up done in passing. If the old code must stay on the wire for a released
client, then **the class keeps its old name** until that client is retired. What is refused is the
silent half-rename that leaves the two names disagreeing forever.

**Recognition signs.** The diff renames the class without touching the `super(...)` line. The diff
changes the code without renaming the class. The commit message says "rename", "cleanup" or "chore"
for a file in the errors folder. An e2e spec asserts that exact code string and the spec is not in
the diff. The self-test: who matches this code right now — which client, which alert, which spec? If
I cannot answer, I am not yet entitled to rename. One thing here is expensive because it is believed
and cheap because it is measured: the assumption that changing a code forces a synchronised release
was believed for a long time; measured, across three front ends, five codes were matched in total, and
none of them belonged to a declaration that had drifted. Measuring is cheap; believing is expensive.

**Boundary.** Not `IDENTITY-2`: see above. Not `IDENTITY-1`: changing `SomethingError` to
`SomethingException` is **also** a rename with a consequence on the wire; fixing `IDENTITY-1` does not
excuse `IDENTITY-3`.

**Common business situations.** A domain rename (`Folder` → `Path`) · merging two modules · fixing a
spelling mistake in a class name · renaming while splitting out a service · a bulk rename through IDE
refactoring.

## `IDENTITY-4` — the metadata type is named for its own exception

**Situation.** You are declaring the type of the constructor's destructured parameter.

**What it emits in source.** A type named `<Class>Metadata`, extending `AbstractExceptionMetadata` —
**even when it adds no field**, in which case it is an empty alias:
`export type XExceptionMetadata = AbstractExceptionMetadata`. The empty alias is not ceremony, for
the same reason the empty object of `EXCEPTION-2` is not ceremony: **it is the place the first field
will land.** A parameter typed straight to the base says "this failure carries nothing" — which stops
being true the moment somebody has an id to attach. And at exactly that moment the base is shared by
**every** other exception, so the new field cannot be added there, and the declaration has to be torn
open and reshaped before it can be extended. Naming the type after the exception also means a reader
holding the failure's name finds its payload **without opening the file**.

**Recognition signs.** The parameter is typed straight to `AbstractExceptionMetadata`. The parameter
carries no annotation at all (bare destructuring) — accepting any object, including one missing
exactly the id this failure exists to carry. The type is named after the entity rather than the
exception (`ReviewMetadata` for `DocumentNotOwnedException`). One metadata type is reused for two
different exceptions. The self-test: tomorrow this failure needs to say **which** thing was refused —
where do I add the field? If the answer is "to the base every failure shares", wrong code.

**Boundary.** Not `EXCEPTION-2`: `EXCEPTION-2` requires the constructor to take **one object**;
`IDENTITY-4` requires that object to have **a name of its own**. Satisfying the former while breaking
the latter is common. Not `IDENTITY-1`: the rule holding `IDENTITY-4` also matches on the `Exception`
suffix, so a class breaking `IDENTITY-1` is not checked for `IDENTITY-4` either.

**Common business situations.** A failure with no payload (missing header, missing config) · a failure
reusing a sibling failure's type · a failure generated from an existing snippet · a failure wrapping
an upstream error and carrying only `originalError`.

## `IDENTITY-5` — HTTP status is not identity

**Situation.** You are considering `httpStatus`.

**What it emits in source.** Usually nothing — no `httpStatus` at the declaration at all. The base
takes it as an **optional** parameter, most failures omit it and fall back to the default 500 at the
boundary. It is a concession to the transport layer, for the cases where **the status IS the
contract**: a guard answering 401, an upload refused as 413, a missing configuration that honestly is
a 500. The status is **never** how two failures are told apart, because a status is a **category**
hundreds of failures belong to. That is why an exception that sets a status still has to satisfy every
code above, and why the reviewer's question is always "what does the client match?" — that question is
about the code. A declaration reaching for a status **in order to become distinguishable** is a
declaration that has answered the wrong question.

**Recognition signs.** Two neighbouring failures carry equally generic codes and are told apart by 403
versus 404. The code is the name of a status (`FORBIDDEN_EXCEPTION`, `BAD_REQUEST_EXCEPTION`). The
reason given for the status is "so the other side knows this is a different failure", not "this
endpoint commits to that status". A status is set on a failure that only runs in a background job,
where no transport reads it. The self-test: has any caller **already committed** to this status? If
not, drop it and let the default do its work.

**Boundary.** Not `IDENTITY-2`: see above. The status answers "how should the transport reply"; the
code answers "which failure is this". Using the former to do the latter's job is a layer mistake. Not
`EXCEPTION-1`: do not go back to framework exceptions just because they "come with a status" — a
status does not buy back the loss of identity.

**Common business situations.** An authentication guard (401) · an authorisation guard (403) · a file
too large (413) · a rate limit (429) · an unconfigured secret (500, and it really is a 500) · an
ordinary domain failure (nothing set).

## Layer held

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
| `IDENTITY-1` | `modules/platform/exceptions/errors/` | 283 classes extend `AbstractException` across the folder tree and every declared name ends in `Exception`. A search for `class \w+Error extends AbstractException` returns nothing — that emptiness is the anchor, because it is what the rule bought |
| `IDENTITY-2` | `modules/platform/exceptions/errors/api/graphql.ts` | `GraphQLDataNotFoundException` passes the literal `"GRAPHQL_DATA_NOT_FOUND_EXCEPTION"`. The acronym carve-out is not hypothetical: the naive split would read `GRAPH_QL_`, the rule compares letters, and real source depends on that |
| `IDENTITY-3` | `modules/api/apollo/server/monolithic/monolithic-apollo-server.module.ts` (`formatError` copies `original.code` into `extensions.code`), `modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`code: exception.code` in the response body), and the code literals asserted across `tests/e2e/*.e2e-spec.ts` | The chain from class name to wire, in three files. The e2e assertions on literal codes are the mechanical witness that a code is a contract somebody pinned |
| `IDENTITY-4` | `modules/platform/exceptions/errors/guards/admin-api-key-not-configured.ts` | `export type AdminApiKeyNotConfiguredExceptionMetadata = AbstractExceptionMetadata` — the empty alias, declared anyway. 45 declarations in the tree carry one |
| `IDENTITY-5` | `modules/platform/exceptions/errors/abstract.ts` (`readonly httpStatus?: number`) and `modules/platform/exceptions/filters/abstract-exception-http.filter.ts` (`exception.httpStatus ?? HttpStatus.INTERNAL_SERVER_ERROR`) | The status is optional on the base and defaults at the boundary. 90 of 283 declarations set one, and not one of them is told apart from its neighbour by it |

Every code in this module is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| class | The `class X extends AbstractException` declaration, read whole — not the filename |
| code | The second argument of the `super()` call, exactly as written |
| metadata type | The type annotation on the constructor's first parameter, including through an `= {}` default |
| consumers | Which clients, alert rules or specs match this code as a literal |
| status contract | Whether a named caller requires a specific HTTP status, or the default is correct |

## Rules

1. The class name, the code and the metadata type name are one word in three alphabets.
2. The class name ends in `Exception`. There is no exemption for size or for being internal.
3. The code is derived from the class name, never chosen beside it.
4. The code is a literal at the declaration site, never assembled.
5. Underscore placement inside an acronym is not part of the law; the letters are.
6. Renaming a class changes the contract on the wire. Change both, or keep both until the old client
   is retired.
7. The metadata type is named for its own exception, even when it holds no field.
8. The HTTP status never distinguishes two failures. `httpStatus` is set only where the status is the
   caller's contract; identity lives in the code.
9. A situation code maps to exactly one ruling, and no ruling serves two codes.
10. Every class extending the house base resolves to a verdict under every code. No declaration is out
    of scope for being small, internal, or unlikely to be caught.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Acronym split.** (`IDENTITY-2`) This code does not rule on underscore placement inside an acronym.
  `GRAPHQL_DATA_NOT_FOUND_EXCEPTION` and `GRAPH_QL_DATA_NOT_FOUND_EXCEPTION` name the same class,
  there is no correct split, and a rule insisting on one would fire on code that is right. The
  letters are the ruling.
- **Released client.** (`IDENTITY-3`) The old code may stay on the wire for a released client — by
  keeping the OLD CLASS NAME until that client is retired. What is refused is the half-rename, not
  the delay.
- **Status as contract.** (`IDENTITY-5`) `httpStatus` is allowed where the status is the thing the
  caller agreed to: a guard answering 401, an upload refused as 413, a misconfiguration that is
  honestly a 500. Setting it there does not excuse any other code.
- **Framework-shaped failures.** A class extending a framework base is not this module's business; it
  is refused upstream by `EXCEPTION-3`. This module governs identity within the house base only.
- **The empty payload.** (`IDENTITY-4`) There is no small-case exemption. An exception with nothing of
  its own to say still declares its alias, for the same reason `EXCEPTION-2` keeps the empty object:
  it is the place the first field lands.

## Output

One block per file the shape produces.

```text
class:    <declaration as written>
code:     <literal passed to super()>
metadata: <type of the constructor's first parameter>
status:   <httpStatus, or "default">
situation: <IDENTITY-1 | IDENTITY-2 | IDENTITY-3 | IDENTITY-4 | IDENTITY-5>
verdict:  <holds | violates>
reason:   <the consumer that could not tell this failure from its neighbour>
```

## Worked example

**The accepted shape.** An admin-only GraphQL query that reads one record by id, reachable only when
an admin API key is configured — so it can refuse in two places: the guard refuses when the key is not
configured, and the read refuses when the record is absent.

The shape produces two declaration files.

```text
class:    class AdminApiKeyNotConfiguredException extends AbstractException
code:     "ADMIN_API_KEY_NOT_CONFIGURED_EXCEPTION"
metadata: AdminApiKeyNotConfiguredExceptionMetadata (= AbstractExceptionMetadata, empty alias)
status:   500
situation: IDENTITY-4
verdict:  holds
reason:   the failure carries no payload today, and the empty alias is the place the first field lands — this is IDENTITY-4, not IDENTITY-5, because the 500 is not what distinguishes it: the code is, and the status is set only because a misconfigured secret honestly is a 500
```

```text
class:    class GraphQLDataNotFoundException extends AbstractException
code:     "GRAPHQL_DATA_NOT_FOUND_EXCEPTION"
metadata: GraphQLDataNotFoundExceptionMetadata
status:   default
situation: IDENTITY-2
verdict:  holds
reason:   the literal is the same letters as the class name, so a client matching the code lands on the class in one grep — this is IDENTITY-2, not IDENTITY-3, because the class is being written new and no released client matches an older code for it; the underscore inside GRAPHQL is not ruled on, the letters are
```

**What the shape does not state, and therefore does not resolve.** It does not name which client,
alert rule or e2e spec will match either literal, so `IDENTITY-3` is not resolved here — it opens the
next time either class name is edited, and it needs that consumer list as evidence before anyone is
entitled to rename. It also does not state intent behind the 500, and intent is not in the AST:
`IDENTITY-5` on the first block is held at review, not by a gate.

## Scope

This rule holds for any code of this kind in this stack — any back end that names its failures. It
names no single feature, no product, no private module and no repository. Examples are ordinary
TypeScript in the shape a Nest application writes. The `Anchor` table is the one place that cites
repository-relative paths, because a law that cannot be pointed at in real code is a proposal.
