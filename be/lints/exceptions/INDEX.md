---
id: be-lints-exceptions-index
title: INDEX.md
slug: /be/lints/exceptions
sidebar_label: exceptions
sidebar_position: 0
description: What the four exception rules actually see in a file, and what they cannot see at all.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `exceptions`

## Law

The law this module enforces says a failure is a **named thing with data attached, not a string**:
every failure is an `AbstractException` subclass, declared in one folder, and constructed with a
single metadata object.

This shelf does not restate that law. It records **enforcement**: which of those sentences a machine
can hold, by what mechanism, and — the part nobody writes down — which ways of writing walk past the
machine untouched.

Four rules exist. The source publishes exactly four in its `rules` export and exactly four in its
`recommended` export, and the two lists agree. The law itself states **six** codes, so two of them
are held by nothing; that gap is recorded in `audit.md` rather than papered over here.

The pairing is the design. Two rules watch the **throw site** and two watch the **declaration**,
because either half alone has a hole the other closes: a class that extends a framework base is
still thrown by its own house-shaped name, so a throw-site rule reads it as correct.
`throw-abstract-exception` is openly a heuristic — a rule reading one file at a time cannot verify
what a thrown class extends — and `exception-extends-abstract` is what makes that heuristic sound,
by guaranteeing the only `*Exception` classes in the tree are house ones.

## Rules

| Rule | Code | What it reports |
|---|---|---|
| `throw-abstract-exception` | `EXCEPTION-1` | `bareError` on `throw new Error(...)`; `framework` on `throw new <FrameworkException>(...)` where the name is one of seventeen listed transport exceptions |
| `require-exception-object-arg` | `EXCEPTION-2` | `zero` on `new XException()`; `extra` on more than one argument; `notObject` when the first argument is not an object literal |
| `exception-extends-abstract` | `EXCEPTION-3` | `base` on a class whose name ends in `Exception` and whose direct superclass identifier is anything other than `AbstractException` |
| `exception-in-errors-folder` | `EXCEPTION-4` | `place` on a class whose name ends in `Exception`, which has a superclass, declared in a file outside an `exceptions/errors/` folder |

`EXCEPTION-5` (the metadata carries what the reader of the failure will need) and `EXCEPTION-6`
(a test-runner assertion is not a domain failure) are enforced by **no rule**. `EXCEPTION-6` appears
in the source only as an *exemption* inside `EXCEPTION-1` — an excuse from a rule is not enforcement
of a rule. Both are carried in `audit.md`.

## Detection

| Rule | Mechanism |
|---|---|
| `throw-abstract-exception` | Visits `ThrowStatement`. Requires `node.argument.type === "NewExpression"` **and** `callee.type === "Identifier"`; compares `callee.name` against the string `"Error"`, then against a 17-entry `Set` of framework exception names. Two file-level gates read `context.filename`: `/\.spec\.ts$/`, `/-spec\.ts$/` or a path containing `/src/tests/` disables the rule outright; `/\/health(?:z)?\.controller\.ts$\|\/health\//` disables only the framework half |
| `require-exception-object-arg` | Visits `ThrowStatement` with the same `NewExpression` + `Identifier` requirement. Filters the name with `/Exception$/`, then drops `AbstractException` and any name in the framework `Set`. Reads `arguments.length` for `zero`/`extra`, and `arguments[0].type !== "ObjectExpression"` for `notObject`. No filename gate of any kind |
| `exception-extends-abstract` | Visits `ClassDeclaration`. Requires `node.id` and `/Exception$/` on `node.id.name`. Reads `node.superClass`; returns when it is absent, when its `type` is not `Identifier`, or when its `name` is `AbstractException`. One filename gate: `/exceptions\/errors\/abstract\.ts$/` exempts the base's own file |
| `exception-in-errors-folder` | File-level gate first: `/\/exceptions\/errors\//` tested against the backslash-normalized `context.filename` returns an empty visitor. Otherwise visits `ClassDeclaration`, requires `node.id`, `/Exception$/` on the name, and a truthy `node.superClass` of any shape |

All four normalize `\` to `/` before any path test, so a Windows path compares like every other path.
All four are single-file: none resolves an import, reads a type, or knows what another file declares.

## Escape Hatches

### Closed

| Way of writing | Why it does not slip |
|---|---|
| `class CourseAlreadyEnrolledException extends ConflictException {}`, thrown as `new CourseAlreadyEnrolledException({ id })` | The throw site reads house-shaped and `EXCEPTION-1` passes it — but `exception-extends-abstract` reports the declaration. This is the pairing working; one such class stayed live across four call sites before the second rule existed |
| Moving the class next to the code that throws it | `exception-in-errors-folder` is a declaration-site rule, so the class is reported where it is written, not where it is used |
| A file under a folder named `health` throwing `new Error(...)` | The probe carve-out suppresses only the framework branch. The `Error` branch reports first and returns before the probe check |
| `new UserNotFoundException()` inside a spec | The test-lane gate belongs to `EXCEPTION-1` alone. `require-exception-object-arg` has no filename gate, so it reports in every lane |
| `new ServiceUnavailableException(body)` | Deliberately not `EXCEPTION-2`'s business: the framework published that constructor and rewriting it changes what is sent. Whether it may be thrown at all is `EXCEPTION-1`'s question, and that rule answers it |
| Extending the base from a file with any other name | Only `exceptions/errors/abstract.ts` is exempt from `exception-extends-abstract`; a second self-declared base elsewhere is reported |

### Open

| Way of writing | Why the rule does not catch it |
|---|---|
| `const failure = new Error("no seat left"); throw failure` | Both throw-site rules match a `NewExpression` **at the `ThrowStatement`**. An identifier there is not a `NewExpression`, so both visitors return on the first line of their handler |
| `return Promise.reject(new Error(...))`, `subscriber.error(new Error(...))`, `callback(new Error(...))` | There is no `ThrowStatement`. The same failure reaches the same caller and no rule ever ran |
| `throw new TypeError(...)`, `throw new RangeError(...)` | The name is compared to the literal `"Error"` and then to a closed `Set`. Every other built-in is neither |
| `throw new PreconditionFailedException(...)`, `MethodNotAllowedException`, `RpcException`, `WsException` | The framework list is seventeen hand-written strings. A transport exception outside that list is invisible, and the framework can add one at any release |
| `import { BadRequestException as BadRequest } from "…"` then `throw new BadRequest(...)` | The rule compares the **local identifier**, never the import binding. A rename at the import line disables the deny list for that file |
| `throw new errors.CourseNotFoundException({})` | `callee.type` is `MemberExpression`, so all three throw-site checks return before reading a name |
| Any file named `*-spec.ts` | The test-lane gate is a filename suffix. A production helper named `client-spec.ts` turns `EXCEPTION-1` off for its whole contents, and a filename is the cheapest thing in a repository to change |
| Any file anywhere under a folder named `health` | The probe gate is `\/health\/` — a folder segment, not a controller. A service, a mapper and a repository under that folder all inherit the framework carve-out that the source describes as narrow to a controller |
| `const meta = { id }` then `throw new CourseNotFoundException(meta)` | Inverted hatch: this is the **right** shape and the rule reports it, because it tests `arguments[0].type === "ObjectExpression"` at the call site rather than the value's shape. Constants launder literals in both directions |
| `export const CourseException = class CourseException extends ConflictException {}` | Both declaration rules visit `ClassDeclaration`. A `ClassExpression` is a different node type and is never visited |
| `class CourseException extends mixin(ConflictException) {}` or `extends base.Http {}` | Both are refused a report by `parent.type !== "Identifier"`. A call or a member expression as the superclass is silence, not a pass |
| `class CourseNotFoundError extends ConflictException {}` | Every declaration rule filters on `/Exception$/`. Renaming the suffix removes the class from all enforcement while leaving it thrown from every call site |
| A second, third and twentieth `exceptions/errors/` folder | The gate matches the folder **pair by name**, anywhere in the path. "One place to look" is not what is enforced; "a folder spelled this way" is |
| `class CourseException {}` with no superclass, outside the folder | `exception-in-errors-folder` returns on a missing `superClass` by design — an undecorated shape is not an exception. A real failure class written without a base is the cost of that decision |
| `// eslint-disable-next-line` above any of the four | None of the rules is unsuppressible. Every hatch above is reachable in one line by a person who is in a hurry |

## Inputs

| Input | What is read |
|---|---|
| `context.filename` | Backslash-normalized, then matched against the test-lane, probe, base-file and errors-folder patterns |
| `ThrowStatement` | `node.argument`, its `type`, its `callee.type`, its `callee.name`, its `arguments` |
| `ClassDeclaration` | `node.id.name` and `node.superClass` (`type` and `name`) |
| Framework name list | A closed 17-entry `Set` of transport exception names, hard-coded in the source |

Nothing else is read. No type information, no import graph, no second file, no configuration —
every rule declares `schema: []` and therefore takes no options.

## Invariants

- A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
  what a build prints, what a disable comment carries, and what any conversation about a failure
  uses.
- Each rule maps to exactly one code in the law, and no code is held by two rules.
- Every rule is `meta.type: "problem"` and every rule is `error` in `recommended`.
- Throw-site rules see only `ThrowStatement` with a directly constructed identifier; anything else is
  outside their reach by construction, not by accident.
- Declaration rules see only `ClassDeclaration` whose name ends in `Exception`.
- A filename gate returns an **empty visitor**, so a gated file is not partially checked — it is not
  checked at all.
- Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
  through is still wrong.

## Exceptions

These are carve-outs written into the source, not relief from the law. Each is closed and names the
rule it applies to.

- **Test lane.** `.spec.ts`, `-spec.ts` and any path under `/src/tests/` may `throw new Error`, where
  the sentence means "the runner cannot continue" rather than naming a failure the product can
  produce. Applies to `throw-abstract-exception` only. The carve-out was once granted in prose and
  missing from the rule, and a repository adopting it inherited 69 findings its own law had already
  excused.
- **Liveness and readiness probe.** A file matching the probe pattern may throw a framework
  exception, because the status code is the whole contract there — the reader takes the status and
  never the body, so the status *is* the identity. `Error` is still refused: a probe's status is a
  contract, an unnamed crash is not.
- **Framework constructors.** `require-exception-object-arg` skips every name in the framework list.
  That constructor shape was published by the framework, and rewriting it changes what is sent.
  Whether such an exception may be thrown at all belongs to `throw-abstract-exception`.
- **The base's own file.** `exceptions/errors/abstract.ts` is exempt from `exception-extends-abstract`
  — it holds the one class allowed to extend something else.
- **Per-application exception folders.** The folder gate deliberately does not anchor to one absolute
  path. An earlier version encoded a single repository's layout and reported 83 findings in a second
  back end whose top offenders were already sitting in an `exceptions/errors/` folder — just not that
  one. A rule that fires on correct code is worse than no rule, because the next author learns to
  scroll past it.

## Output

```text
rule:     <throw-abstract-exception | require-exception-object-arg | exception-extends-abstract | exception-in-errors-folder>
code:     <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4>
file:     <path as the rule normalized it>
gate:     <none | test-lane | probe | base-file | errors-folder>
node:     <ThrowStatement argument | first argument | superClass | class identifier>
message:  <bareError | framework | zero | extra | notObject | base | place>
verdict:  <fires | silent: hatch <name from the Open table>>
```

A `silent` verdict is a real result and must be reported. "The gate is green" and "the rule looked"
are different claims, and only one of them is evidence.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why it is worth a machine, read
`example.md` for the code that fires and the code that slips, and read `audit.md` only while
reviewing the enforcement itself.

## Scope

This module documents four rules of one back-end law. It names no product, no company and no
repository. Rule names, message identifiers and the class names the rules match are **identifiers
that ship** and are reproduced verbatim; that exemption covers nothing else.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule or to what is claimed about it,
and record it in `changelog.md`. A new rule in the source, a removed rule, or a newly discovered open
hatch each require a version bump — a hatch found and not written down is the failure this shelf
exists to prevent.
