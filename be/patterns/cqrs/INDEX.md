---
id: be-patterns-cqrs-index
title: INDEX.md
slug: /be/patterns/cqrs
sidebar_label: cqrs
sidebar_position: 0
description: Binding rules for expressing every backend operation as a CQRS message with a handler.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `cqrs`

## Law

Every operation this backend exposes is a CQRS message with a handler. A mutation dispatches a
command; a query dispatches a query; a side effect that must outlive the request is an event. The
resolver does not do the work and the service does not do the work — they carry the request to a
handler, and the handler is where the work lives.

The shape is not decoration. Putting the work behind a message means the same operation is reachable
from a resolver, a controller, a CLI command, a job or a test **without any of them knowing about
each other**, and it means the one place to read what an operation actually does is a file named
after that operation.

The question that settles whether something belongs here: **can this be invoked from more than one
door?** If yes — and almost everything can, because the CLI and the test suite are doors — it is a
message with a handler, not a method on a service.

**This is binding, not advisory.** Every operation carries exactly one situation code below, and
there is no operation small enough to be exempt: a one-line read is `CQRS-1` for the same reason a
payment settlement is. "It is only a getter" is the most common place this rule gets skipped.

## Situation Codes

Every situation this module governs carries a code, `CQRS-<n>`. The numbers are fixed and are cited
from other law files and from task records; a code keeps its number and its meaning for as long as
it exists.

| Code | Requires | Forbids |
|---|---|---|
| `CQRS-1` | One operation, one folder; every file in it named `<operation>.<role>.ts` | A file in the folder not named for the operation; one operation split across folders |
| `CQRS-2` | A command or query holding a single `params` field carrying request, user and locale | Methods, getters, defaults or any computation on a message; several constructor fields |
| `CQRS-3` | A handler implementing the protected `process` of the base template | Declaring `execute` on a handler class; a standalone handler with no `process` |
| `CQRS-4` | A service beside the handler that dispatches and returns, one line | Business rules, repository access, validation or orchestration in that service |
| `CQRS-5` | A handler that cannot do its work throwing the domain exception naming why | Returning `null` for failure; returning a success shape carrying an error field |
| `CQRS-6` | An event only for work that must happen whether or not the caller is still there | An event whose completion the caller's own answer depends on |
| `CQRS-7` | `<operation>.handler.spec.ts` in the same folder as the handler | A handler with no spec; the spec relocated into a separate test tree |

`CQRS-1` AND `CQRS-7` ARE ABOUT THE SAME FOLDER, NOT THE SAME FACT. `CQRS-1` says what may live in
the folder; `CQRS-7` says what must. A folder can satisfy one and fail the other, which is why they
are two codes and not one.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a named rule from [`sources/be/cqrs.mjs`](../../../sources/be/cqrs.mjs) reports it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | Held by |
|---|---|---|
| `CQRS-1` | `documented` | Nothing parses a folder listing against the operation name. A reader, or a gate that walks the tree, is the only check. |
| `CQRS-2` | `enforced` | `message-carries-params-only` — reports any method on a message, and any constructor that is not exactly one `params`. |
| `CQRS-3` | `enforced` | `handler-overrides-process` — reports a declared `execute`, and reports a standalone handler with no `process`. The second half is additionally `unrepresentable`: the base declares `process` abstract, so a concrete subclass omitting it does not compile. Overriding `execute` remains fully representable, which is exactly why the rule exists. |
| `CQRS-4` | `documented` | Thinness is a judgement. A rule that guessed at "too much logic" would fire on correct services often enough to be disabled. |
| `CQRS-5` | `documented` | A `null` return is a legitimate result for many operations; only the domain says which `null` means failure. |
| `CQRS-6` | `documented` | Whether the caller waits on an event is a fact about the caller, not about the publish site a rule can see. |
| `CQRS-7` | `enforced` | `handler-has-twin-spec` — off by default because it takes the folder listing as an option; a repository that wires the listing from its own gate turns it on. Unwired, this code is `documented` in practice. |

Four codes read `documented`, and that is the honest state rather than a gap to be papered over. The
three that are enforced are exactly the three a parser can see: a filename shape, a class shape, and
a sibling filename. Where the work lives, how thin a service is, what a `null` means and whether a
caller waits are judgements, and a rule that guessed at them would train everybody to disable it.

## Anchor

A law that cannot be pointed at in real code is a proposal. Each code below names a file in the
reference repository and what to look for there.

| Code | Anchor | What to look for |
|---|---|---|
| `CQRS-1` | `src/features/api/core/graphql/mutations/courses/add-to-cart/` | Every file carries the operation name: `.command.ts`, `.handler.ts`, `.service.ts`, `.resolver.ts`, `.module.ts`, `.module-definition.ts`. |
| `CQRS-2` | `src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.command.ts` | A plain class whose constructor takes exactly one `readonly params`, and declares nothing else. |
| `CQRS-3` | `src/modules/platform/cqrs/icqrs-handler.ts` | `execute` is concrete and calls `process`; `process` is `protected abstract`. The seam a handler must not step out of. |
| `CQRS-4` | `src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.service.ts` | The whole method body is one `commandBus.execute(new …Command(params))`; the service imports no repository. |
| `CQRS-5` | `src/features/api/core/graphql/mutations/courses/add-to-cart/add-to-cart.handler.ts` | Each failure path throws a named domain exception carrying the identifier that caused it; no path returns `null` to mean "no". |
| `CQRS-6` | `src/modules/platform/cqrs/event-bus/send-mail/` | An event class carrying a payload, and a handler that enqueues — nothing on the request path awaits its result. |
| `CQRS-7` | `src/features/api/core/graphql/mutations/courses/course-enroll/course-enroll.handler.spec.ts` | The spec sits beside `course-enroll.handler.ts`, not in a parallel test tree. |

Every code is anchored. Anchors are paths in the reference repository and exist for verification
only; the examples in `example.md` name no product and no repository.

## Inputs

| Input | Evidence required |
|---|---|
| operation | The verb-object name the folder is named for |
| doors | Every caller that can reach this work: resolver, controller, CLI, job, test |
| message | Command, query or event, and why that one |
| handler | The class implementing `process`, and the base it extends |
| failures | Each way the work can refuse, and the domain exception naming it |
| side effects | Work that must happen anyway, separated from work the caller waits on |
| spec | The twin spec filename and the decisions it covers |

## Invariants

- The work lives in a handler. A door and a service carry the request; they do not decide anything.
- One operation, one folder; the folder is the whole operation.
- A message carries request context and computes nothing.
- A handler implements `process`; `execute` belongs to the base.
- A failure is a thrown domain exception, not an encoded return value.
- An event is for work whose completion the caller does not need.
- A handler has its twin spec in the same folder.
- Every operation resolves to exactly one code per situation. No operation is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies
to.

- **Intermediate abstract handler.** Under `CQRS-3`, a family of operations that do the same work
  differently parameterised may implement `process` once in an abstract handler and be subclassed.
  A subclass that declares neither `execute` nor `process` inherits the work and is correct; the
  check applies to a standalone class only, because reporting regardless of superclass was measured
  to be wrong far more often than right.
- **A decorated `.command.ts` is a door, not a message.** Under `CQRS-2`, a CLI framework uses the
  same filename suffix for a decorated class with a `run` method. That is a door and is governed by
  `CQRS-4`'s spirit, not by the message shape. A CQRS message is a plain class.
- **Transport types inside the operation folder.** Under `CQRS-1`, request and response types that
  exist only for this operation's door may sit in a subfolder named for their role. They are part of
  the operation, not something invented in it. See `audit.md` — this is a recorded tension with the
  strict reading of the rule, not a silent softening of it.
- **Adoption debt.** A rule from this module ships at `warn` with its offender count beside it while
  debt is above zero, is burned down, and flips to `error` at zero. Shipping at `error` with debt
  outstanding blocks every commit that touches an offender, which is how a correct rule gets
  removed.
- **Measure only this module's reports.** When counting a rule's offenders, count that rule's
  reports alone. Inline disable comments referring to rules a minimal measuring config never loads
  are themselves reported, and counting them inflates every measurement in the same direction.

## Output

```text
operation: <verb-object folder name>
doors: <resolver | controller | cli | job | test>
message: <command | query | event>
situation: <CQRS-1 | CQRS-2 | CQRS-3 | CQRS-4 | CQRS-5 | CQRS-6 | CQRS-7>
placement: <file the code must live in>
reason: <the second door that could not reach this work otherwise>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, `audit.md` only while reviewing the canon, and
`changelog.md` when a version marker disagrees with what you are reading.

## Scope

This module states a rule true of any message-dispatched backend. Its examples are ordinary
TypeScript in a Nest-shaped application and name no product, no company and no repository. The
Anchor table is the only place carrying repository paths, and it carries them as verification, not
as illustration.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`. A
major bump (`x.00`) is for a change to the module's shape or the shelf it sits on. Situation codes
are never renumbered: a code that is retired is recorded as retired and its number is not reused.
