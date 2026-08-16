---
id: be-patterns-exceptions-index
title: INDEX.md
slug: /be/patterns/exceptions
sidebar_label: exceptions
sidebar_position: 0
description: Binding rules for a failure being a named thing with data attached, not a sentence.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `exceptions`

## Law

Every failure this back end produces is an `AbstractException` subclass, declared in one folder, and
thrown with a metadata object. Those are three rules about one idea: **a failure is a named thing
with data attached, not a string.**

A `new Error("record not found")` carries a sentence. Nothing downstream can group on it, match on
it, decide whether it is retryable, translate it, or recover the id without parsing English. A
framework built-in is barely better — it carries an HTTP status and nothing else, which is a
transport concern standing in for a domain one.

The question that settles it: **could a caller, a log pipeline or a client want to act differently on
this than on the failure declared beside it?** If yes it needs its own class, and it nearly always
does.

That the failure has a name is this module. WHICH name, spelled in which three alphabets, is settled
by the adjacent `exception-identity` module; this one settles that there is a class at all, that it
extends the house base, that it lives with the others, and that the throw carries data.

**This is binding, not advisory.** Every `throw` in product code has a situation below, and every
`*Exception` declaration has one too. There is no failure too internal to carry a class: the
misconfiguration nobody catches is `EXCEPTION-1` for the same reason the refusal a client renders is,
and "nothing will ever catch this one" is the most common place the rule gets skipped.

## Situation Codes

Every situation this module governs carries a code, `EXCEPTION-<n>`. The code names the SITUATION;
the tier and anchor tables below name what actually holds it and where it can be checked in source.
Those are three different facts and this module keeps them apart on purpose.

| Code | What it requires | What it forbids |
|---|---|---|
| `EXCEPTION-1` | A `throw` in product code throws an `AbstractException` subclass | `throw new Error(...)`, and any framework exception carrying a status in place of an identity |
| `EXCEPTION-2` | The constructor takes ONE metadata object — `{}` when there is nothing to say | Positional arguments, several arguments, and the bare `new XException()` |
| `EXCEPTION-3` | The class declaration itself extends `AbstractException` | An `*Exception` class extending a framework base, which reads house-shaped at every throw site |
| `EXCEPTION-4` | Every exception is declared under an exceptions folder | A failure declared beside the code that throws it, invisible until production throws it |
| `EXCEPTION-5` | The metadata carries what the reader of the failure will need — ids, the state, the limit | A rendered sentence as the only payload |
| `EXCEPTION-6` | A test-runner assertion stays a test-runner assertion | Product code borrowing the test lanes' exit, and a spec naming its own setup failure as a domain one |

`EXCEPTION-2` IS NOT A STYLE RULE. The empty object is not ceremony: it keeps one spelling for every
throw in the tree, so a reader never has to check whether THIS exception happens to take arguments.
Positional arguments are refused for a different reason again — that shape cannot grow, and the day
a failure needs a second field, every throw site is edited and the ones edited wrong still compile.

`EXCEPTION-3` EXISTS BECAUSE `EXCEPTION-1` CANNOT SEE IT. A class extending a framework base is
thrown by its own house-shaped name, so a rule reading throw sites passes it. The two halves are one
law read from two ends, and either half alone leaves the hole the other closes.

`EXCEPTION-6` NAMES A SITUATION WHOSE CORRECT OUTCOME IS USUALLY `throw new Error`. The test lanes
may throw one, because there it means "the runner cannot continue" rather than naming a failure the
product can produce. A flow forbidden from failing its own setup would have to invent a domain
exception for "the fixture is missing" — putting a failure of the test into the same vocabulary the
product uses for real ones.

## Tầng giữ

Which tier actually holds each code — not which tier we would like to hold it.

| Code | Tier | Held by |
|---|---|---|
| `EXCEPTION-1` | `enforced` | `throw-abstract-exception` (export `throwAbstractException`) — two messages: `bareError` for `throw new Error`, `framework` for a name in the framework list. Skips the test lanes and the health probe by path |
| `EXCEPTION-2` | `enforced` | `require-exception-object-arg` (export `requireExceptionObjectArg`) — three messages: `zero` for no argument, `notObject` for a positional value, `extra` for more than one. Framework names are returned unjudged, because their constructor shape is not ours to dictate |
| `EXCEPTION-3` | `enforced` | `exception-extends-abstract` (export `exceptionExtendsAbstract`) — message `base`, on any `*Exception` class whose superclass is not the house base. The base's own file is carved out by filename |
| `EXCEPTION-4` | `enforced` | `exception-in-errors-folder` (export `exceptionInErrorsFolder`) — message `place`, on any `*Exception` class with a superclass declared outside an `exceptions/errors/` folder |
| `EXCEPTION-5` | `documented` | Nothing mechanical. A rule can see that an object literal was passed; it cannot see whether the ids the reader will need are IN it. `{ message: "not found" }` and `{ orderId }` are the same AST shape |
| `EXCEPTION-6` | `documented` | Nothing mechanical rules on it. Half its boundary is drawn by path — `isTestLane` inside `throw-abstract-exception`, and the same globs again in the consuming config — but the ruling itself is about what a throw MEANS, and the direction that matters most (a spec inventing a domain exception for a missing fixture) no rule sees at all |

Four of six enforced, two documented. That gap is the point of this table, not a defect in it.

No code here is held at `unrepresentable`, and one is closer than the table admits. Today every one
of the 323 declarations in the errors tree types its constructor parameter and none gives it a
default, so `new XException()`, `new XException("id")` and `new XException(a, b)` are all compile
errors at every call site — the compiler already refuses all three of `EXCEPTION-2`'s messages. That
is a property earned per declaration, not a guarantee the base class makes: `AbstractException`'s own
constructor is positional, so a subclass that copies it would be typed, compile, and be caught only
by the rule. The rule is what makes the law universal, so the rule is the tier that holds it.

## Anchor

A law that cannot be pointed at in real code is a proposal. Every code here points at source, with
what to read there.

| Code | Anchor | What to look for |
|---|---|---|
| `EXCEPTION-1` | `src/` as a whole: 648 `throw new <name>Exception(` sites | A search for `throw new Error(` across product code returns nothing, and the only framework-exception text in the tree is a string literal inside a spec fixture. That emptiness is the anchor, because it is what the rule bought |
| `EXCEPTION-2` | `src/features/api/core/graphql/mutations/ai/purchase-ai-subscription/purchase-ai-subscription.handler.ts` | Two throws in one function: one passes a field-less object, the next passes `{ tier }`. The empty object written out beside a populated one is the whole rule in eight lines. 60 throws in `src/` pass a field-less object rather than no argument |
| `EXCEPTION-3` | `src/modules/platform/exceptions/errors/abstract.ts` | The one class in the tree allowed to extend something else — which is why the rule carves out this exact filename rather than a folder. Every other declaration in the tree extends `AbstractException`, and no framework base appears as a superclass anywhere |
| `EXCEPTION-4` | `src/modules/platform/exceptions/errors/` — 283 files across 54 domain subfolders | The set of failures the application can produce, readable in one listing. A search for `class \w+Exception extends` outside that tree returns nothing |
| `EXCEPTION-5` | `src/modules/platform/exceptions/errors/courses/challenge-content-fk-constraint.ts` and `src/modules/platform/exceptions/filters/abstract-exception-http.filter.ts` | The declaration puts two ids in metadata; the filter sends `{ statusCode, code, message }` and NOT the metadata. So metadata's reader today is the log line and the in-process caller, not the HTTP client — the law is real, but its audience is narrower than the prose implies. 278 of 323 declarations carry at least one field of their own; 45 are empty aliases |
| `EXCEPTION-6` | `eslint.config.mjs`, final block, turning `starci-be/throw-abstract-exception` off for `apps/*/test/**/*.ts` and `src/tests/**/*.ts`; plus `src/tests/e2e/search-sync-resilience.e2e-spec.ts` | 27 `throw new Error` in the test tree against zero in product code — the split the law claims, measured. Note the carve-out is spelled twice, by path, in two repositories' worth of files: once in the rule, once in the config |

Every code in this module is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| throw site | The `throw` statement as written, and the file it sits in — the path decides whether the test-lane exit applies |
| declaration | The `class X extends Y` line, read from the declaration and not inferred from the throw |
| location | The folder the declaration sits in, relative to an `exceptions/errors/` boundary |
| payload | The fields on the metadata object, and which reader needs each one |
| reader | Who acts on this failure: a client branch, a retry policy, an alert grouping, or a human reading a log |

## Invariants

- A failure is a class, not a sentence.
- The throw site and the declaration tell the same story; neither alone is proof.
- One folder answers "what can this application throw?".
- Every throw of a house exception passes exactly one object literal.
- The message is for a human; the metadata is for everything else.
- A situation code maps to exactly one ruling, and no ruling serves two codes.
- Every throw in product code and every `*Exception` declaration resolves to a verdict under every
  code. Nothing is out of scope for being internal, small, or unlikely to be caught.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **The test lanes.** `EXCEPTION-6` sanctions `throw new Error` in the spec family and the test tree,
  where it means the runner is giving up. The exit is sanctioned where it applies and nowhere else,
  and a product file that imports a helper from those lanes does not inherit it.
- **The health probe.** `EXCEPTION-1` permits a framework exception in a liveness or readiness
  controller, because the rule's own reason inverts there: a framework exception is refused for
  carrying a status and no identity, and a probe is the one endpoint where an orchestrator reads the
  status and nothing else. `throw new Error` stays refused even there — a probe's status is its
  contract, an unnamed crash is not.
- **The base's own file.** `EXCEPTION-3` cannot apply to the class every other class extends. The
  carve-out is by filename rather than by folder, so it cannot be spread to a neighbour.
- **A framework exception's own shape.** `EXCEPTION-2` does not govern a framework class's
  constructor. Rewriting `new ServiceUnavailableException(body)` to satisfy a house convention would
  change what the framework sends. Whether it may be thrown at all is `EXCEPTION-1`'s question, and
  it answers it.
- **The empty payload.** `EXCEPTION-5` has no small-case exemption in the other direction:
  `EXCEPTION-2` still requires the object even when the failure has nothing of its own to say,
  because that is the place the first field will land.
- **One folder per application, not one literal path.** `EXCEPTION-4` asks that "what can this
  application throw?" have a single answer. A repository holding several applications satisfies it
  with one such folder per application; the rule matches the boundary, not one repository's layout.

## Output

```text
throw:       <the throw statement as written>
declaration: <class X extends Y, from the declaration file>
location:    <folder of the declaration>
payload:     <fields on the metadata object>
situation:   <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4 | EXCEPTION-5 | EXCEPTION-6>
verdict:     <holds | violates>
reason:      <the reader that could not act on this failure>
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

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
major bump (`x.00`) is reserved for a change to the module's shape or the shelf it sits on. Situation
codes are never renumbered: they are cited from other law files and from historical task records, and
a renumbering silently breaks a citation somebody already made.
