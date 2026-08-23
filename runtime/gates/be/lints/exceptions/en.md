---
title: Exceptions
---

# Exceptions

## LOADS

None.


## Record

The input is code that is already written — one back-end file, one hunk of a diff. The output is a
**verdict**: whether the file was in scope at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses nothing. It refuses, and it must be able to point at the character it refuses on.

## Law

A failure is a **named thing with data attached, not a string**: every failure is an
`AbstractException` subclass, declared in one folder, and constructed with a single metadata object.

The law states **six** codes. **Four of them have a rule.** The source publishes exactly four in its
`rules` export and exactly four in its `recommended` export, and the two lists agree; the remaining two
codes are held by nothing. The pairing of the four is the design: two rules watch the **throw site**
and two watch the **declaration**, because either half alone has a hole the other closes. A class that
extends a framework base is still thrown by its own house-shaped name, so a throw-site rule reads it as
correct. `throw-abstract-exception` is openly a heuristic — a rule reading one file at a time cannot
verify what a thrown class extends — and `exception-extends-abstract` is what makes that heuristic
sound, by guaranteeing the only `*Exception` classes in the tree are house ones.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `throw-abstract-exception` | `EXCEPTION-1` | `bareError` on `throw new Error(...)`; `framework` on `throw new <FrameworkException>(...)` where the name is one of seventeen listed transport exceptions |
| `require-exception-object-arg` | `EXCEPTION-2` | `zero` on `new XException()`; `extra` on more than one argument; `notObject` when the first argument is not an object literal |
| `exception-extends-abstract` | `EXCEPTION-3` | `base` on a class whose name ends in `Exception` and whose direct superclass identifier is anything other than `AbstractException` |
| `exception-in-errors-folder` | `EXCEPTION-4` | `place` on a class whose name ends in `Exception`, which has a superclass, declared in a file outside an `exceptions/errors/` folder |

`EXCEPTION-5` (the metadata carries what the reader of the failure will need) and `EXCEPTION-6` (a
test-runner assertion is not a domain failure) are enforced by **no rule**. They are unenforced rather
than covered, and a green run says nothing about either. `EXCEPTION-6` appears in the source only as an
*exemption* inside `EXCEPTION-1`, and an excuse from a rule is not enforcement of a rule.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — a filename gate returns an **empty visitor**, so the rule did not exist for that file. A
   gated file is not partially checked; it is not checked at all.
2. **Check the exemptions next.** `/\.spec\.ts$/`, `/-spec\.ts$/` or a path containing `/src/tests/`
   switches `throw-abstract-exception` off entirely; `/\/health(?:z)?\.controller\.ts$|\/health\//`
   switches off only its framework half; `/exceptions\/errors\/abstract\.ts$/` exempts the base's own
   file from `exception-extends-abstract`; `/\/exceptions\/errors\//` exempts a file from
   `exception-in-errors-folder`. `require-exception-object-arg` has no filename gate of any kind.
3. **Read the nodes.** Throw-site rules read a `ThrowStatement` whose argument is a `NewExpression`
   with an `Identifier` callee — anything else and the visitor returns on its first line. Declaration
   rules read a `ClassDeclaration` with a `node.id` whose name ends in `Exception`.
4. **Emit one block per finding.** `new XException(1, 2)` is two findings on one throw site: `extra`
   then `notObject`, because the rule does not `return` after reporting `extra`.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure.** A `silent`
   verdict is a real result and must be reported.
6. **Do not report what no rule watches.** Two of the six codes have no machine; a verdict that claims
   otherwise is wrong about the module.

## `throw-abstract-exception` — EXCEPTION-1

**What it reports.** Two messages. `bareError` on `throw new Error(...)`: a sentence carries no stable
code, so nothing downstream can group, match or decide a retry without parsing English. `framework` on
`throw new BadRequestException(...)` and the sixteen siblings on the list: they carry an HTTP status
and no identity, so two unrelated failures reach the client identically and the only thing separating
them is the message — the part most likely to be rewritten.

**How it detects.** Visits `ThrowStatement`. Requires `node.argument.type === "NewExpression"` **and**
`callee.type === "Identifier"`; compares `callee.name` against the string `"Error"` first, then against
a 17-entry `Set` of framework exception names. Two file-level gates read `context.filename`:
`/\.spec\.ts$/`, `/-spec\.ts$/` or a path containing `/src/tests/` disables the rule outright;
`/\/health(?:z)?\.controller\.ts$|\/health\//` disables only the framework half.

**What it cannot see.** `const failure = new Error("no seat left"); throw failure` — the node at the
`ThrowStatement` is an `Identifier`, not a `NewExpression`, so the handler returns on its first line.
`return Promise.reject(new Error(...))`, `subscriber.error(new Error(...))` and `callback(new Error(...))`
produce no `ThrowStatement` at all. `throw new TypeError(...)` and `throw new RangeError(...)` are
neither the literal `"Error"` nor members of the closed `Set`. `PreconditionFailedException`,
`MethodNotAllowedException`, `RpcException` and `WsException` sit outside seventeen hand-written
strings, and the framework can add one at any release. `import { BadRequestException as BadRequest }`
then `throw new BadRequest(...)` passes, because the rule compares the **local identifier**, never the
import binding — one import line disables the deny list for that file. `throw new errors.CourseNotFoundException({})`
has a `MemberExpression` callee and returns before a name is read. Any file named `*-spec.ts` is exempt
by filename suffix, and a filename is the cheapest thing in a repository to change. Any file anywhere
under a folder named `health` inherits the framework carve-out, because the probe gate is `\/health\/`
— a folder segment, not a controller.

**Boundary.** This rule decides whether an exception may be thrown at all. The shape of its constructor
arguments belongs to `require-exception-object-arg`, and what a thrown class extends is beyond a
single-file rule — that is what `exception-extends-abstract` supplies.

## `require-exception-object-arg` — EXCEPTION-2

**What it reports.** Three messages. `zero` on `new XException()` — `new XException({})` is written
even when there is nothing to say, so every throw in the tree has **one** shape and no reader has to
look up whether this exception takes arguments. `extra` on more than one argument. `notObject` when the
first argument is not an object literal, because a positional shape cannot grow: the day the failure
needs one more field, every throw site must change, and the ones changed wrongly still compile.

**How it detects.** Visits `ThrowStatement` with the same `NewExpression` + `Identifier` requirement.
Filters the name with `/Exception$/`, then drops `AbstractException` and any name in the framework
`Set`. Reads `arguments.length` for `zero`/`extra`, and `arguments[0].type !== "ObjectExpression"` for
`notObject`. No filename gate of any kind.

**What it cannot see.** Its worst hole runs the other way: `const meta = { id }` then
`throw new CourseNotFoundException(meta)` is the **right** shape and the rule reports it, because it
tests `arguments[0].type === "ObjectExpression"` at the call site rather than the value's shape.
Constants launder literals in both directions. `new XException({} as SomeMeta)` is a `TSAsExpression`
and is reported although its content is correct. `const e = new XException(); throw e` escapes at the
`NewExpression` requirement. A house exception named `CourseNotFoundError` does not match `/Exception$/`
and is invisible. `new errors.XException()` has a `MemberExpression` callee and returns. And
`new ServiceUnavailableException(body)` is deliberately not this rule's business.

**Boundary.** Framework constructors are skipped: the framework published that shape and rewriting it
changes what is sent. Whether such an exception may be thrown at all is `throw-abstract-exception`'s
question, and that rule answers it.

## `exception-extends-abstract` — EXCEPTION-3

**What it reports.** `base` — a class whose name ends in `Exception` and whose direct superclass is an
identifier other than `AbstractException`. This is the rule that makes `EXCEPTION-1` sound. Watching
the throw site is not enough: a class extending a framework base is thrown by its own name, so the
throw site **reads like house code** and the throw-site rule sees nothing unusual.

**How it detects.** Visits `ClassDeclaration`. Requires `node.id` and `/Exception$/` on `node.id.name`.
Reads `node.superClass`; returns when it is absent, when its `type` is not `Identifier`, or when its
`name` is `AbstractException`. One filename gate: `/exceptions\/errors\/abstract\.ts$/` exempts the
base's own file.

**What it cannot see.** `export const CourseException = class CourseException extends ConflictException {}`
is a `ClassExpression`, a different node type, never visited. `class CourseException extends mixin(ConflictException) {}`
and `extends base.Http {}` are refused a report because the superclass is not an `Identifier` — silence,
not a pass. `class CourseNotFoundError extends ConflictException {}` drops out of the `/Exception$/`
filter and out of all declaration enforcement while staying thrown from every call site. The rule
demands **direct** inheritance, so a legitimate intermediate base — `class HttpishException extends AbstractException {}`
then `class XException extends HttpishException {}` — is still reported although transitively it obeys
the law. And renaming the base's file to `base.ts` makes the base itself a finding: the exemption
anchors to one filename.

**Boundary.** This rule judges what a class extends, not where it is written. Placement is
`exception-in-errors-folder`.

## `exception-in-errors-folder` — EXCEPTION-4

**What it reports.** `place` — a class whose name ends in `Exception`, which has a superclass, declared
in a file outside the exception folder. One place to look means the question "what can this application
throw?" has **one** answer to read, and a reviewer sees a new failure kind **entering** in the diff
rather than discovering it in production.

**How it detects.** File-level gate first: `/\/exceptions\/errors\//` tested against the
backslash-normalized `context.filename` returns an empty visitor. Otherwise visits `ClassDeclaration`,
requires `node.id`, `/Exception$/` on the name, and a truthy `node.superClass` of any shape.

**What it cannot see.** The gate matches the folder **pair by name**, anywhere in the path: a second,
third and twentieth `exceptions/errors/` folder all satisfy it, so what is enforced is "a folder spelled
this way", not "one place to look". `class CourseException {}` with no superclass, written outside the
folder, returns by design — an undecorated shape is not an exception, and a real failure class written
without a base is the cost of that decision. A `ClassExpression` is not visited, as above.
`type XException = ...` and `interface XException` are not `ClassDeclaration`s. A folder spelled
`exception/errors/` — one missing `s` — is reported although the intent is right; that is the same gap
seen from the other side.

**Boundary.** This rule reports a class where it is **written**, not where it is used, so moving a class
next to the code that throws it does not escape it.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | All four normalize `\` to `/` before any path test, so a Windows path compares like every other path |
| out of scope | A filename gate returns an **empty visitor**. The rule does not exist for that file rather than passing it |
| throw-site shape | `ThrowStatement` with `node.argument.type === "NewExpression"` and `callee.type === "Identifier"`; `node.arguments` is read only after both hold |
| declaration shape | `ClassDeclaration` with `node.id`, `/Exception$/` on `node.id.name`, and `node.superClass` (`type` and `name`) |
| framework name list | A closed 17-entry `Set` of transport exception names, hard-coded in the source |
| reach | All four are single-file: none resolves an import, reads a type, or knows what another file declares |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `class CourseAlreadyEnrolledException extends ConflictException {}`, thrown as `new CourseAlreadyEnrolledException({ id })` | The throw site reads house-shaped and `EXCEPTION-1` passes it — but `exception-extends-abstract` reports the declaration. This is the pairing working; one such class stayed live across four call sites before the second rule existed |
| Moving the class next to the code that throws it | `exception-in-errors-folder` is a declaration-site rule, so the class is reported where it is written, not where it is used |
| A file under a folder named `health` throwing `new Error(...)` | The probe carve-out suppresses only the framework branch. The `Error` branch reports first and returns before the probe check |
| `new UserNotFoundException()` inside a spec | The test-lane gate belongs to `EXCEPTION-1` alone. `require-exception-object-arg` has no filename gate, so it reports in every lane |
| `new ServiceUnavailableException(body)` | Deliberately not `EXCEPTION-2`'s business: the framework published that constructor and rewriting it changes what is sent. Whether it may be thrown at all is `EXCEPTION-1`'s question, and that rule answers it |
| Extending the base from a file with any other name | Only `exceptions/errors/abstract.ts` is exempt from `exception-extends-abstract`; a second self-declared base elsewhere is reported |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| both throw-site rules | `const failure = new Error("no seat left"); throw failure` — an `Identifier` at the `ThrowStatement` is not a `NewExpression`, so both visitors return on the first line of their handler |
| both throw-site rules | `return Promise.reject(new Error(...))`, `subscriber.error(new Error(...))`, `callback(new Error(...))` — there is no `ThrowStatement`. The same failure reaches the same caller and no rule ever ran |
| both throw-site rules | `throw new errors.CourseNotFoundException({})` — `callee.type` is `MemberExpression`, so the checks return before reading a name |
| `throw-abstract-exception` | `throw new TypeError(...)`, `throw new RangeError(...)` — every other built-in is neither the literal `"Error"` nor a `Set` member |
| `throw-abstract-exception` | `PreconditionFailedException`, `MethodNotAllowedException`, `RpcException`, `WsException` — the list is seventeen hand-written strings, and the framework can add one at any release |
| `throw-abstract-exception` | `import { BadRequestException as BadRequest }` then `throw new BadRequest(...)` — the rule compares the local identifier, so a rename at the import line disables the deny list for that file |
| `throw-abstract-exception` | Any file named `*-spec.ts` — a production helper named `client-spec.ts` turns the rule off for its whole contents, and a filename is the cheapest thing in a repository to change |
| `throw-abstract-exception` | Any file anywhere under a folder named `health` — a service, a mapper and a repository all inherit a carve-out the source describes as narrow to a controller |
| `require-exception-object-arg` | `const meta = { id }` then `throw new CourseNotFoundException(meta)` — inverted hatch: this is the right shape and the rule reports it, because it tests the node type at the call site rather than the value. Constants launder literals in both directions |
| both declaration rules | `export const CourseException = class CourseException extends ConflictException {}` — a `ClassExpression` is a different node type and is never visited |
| both declaration rules | `class CourseNotFoundError extends ConflictException {}` — renaming the suffix removes the class from all enforcement while leaving it thrown from every call site |
| `exception-extends-abstract` | `class CourseException extends mixin(ConflictException) {}` or `extends base.Http {}` — a call or member expression as superclass is silence, not a pass |
| `exception-in-errors-folder` | A second, third and twentieth `exceptions/errors/` folder — the gate matches the folder pair by name, anywhere in the path |
| `exception-in-errors-folder` | `class CourseException {}` with no superclass, outside the folder — the rule returns on a missing `superClass` by design |
| all four | `// eslint-disable-next-line` above any of the four. None of the rules is unsuppressible; every hatch above is reachable in one line by a person who is in a hurry |
| no rule | Everything `EXCEPTION-5` and `EXCEPTION-6` state — metadata that does not carry what the reader of the failure will need, and a test-runner assertion dressed as a domain failure |

## Inputs

| Input | Evidence required |
|---|---|
| `context.filename` | The path as the rule sees it, backslash-normalized, and which of the test-lane, probe, base-file or errors-folder patterns matched |
| `ThrowStatement` | `node.argument`, its `type`, its `callee.type`, its `callee.name`, its `arguments` |
| `ClassDeclaration` | `node.id.name` and `node.superClass` (`type` and `name`) |
| Framework name list | A closed 17-entry `Set` of transport exception names, hard-coded in the source |

Nothing else is read. No type information, no import graph, no second file, no configuration — every
rule declares `schema: []` and therefore takes no options.

## Rules

1. A rule's identity is its **published name**. There is no numeric identifier for a rule; the name is
   what a build prints, what a disable comment carries, and what any conversation about a failure uses.
2. Only a rule that exists in the source is recorded here. A rule that ought to exist and does not is
   not a row in the published table.
3. Each rule maps to exactly one code in the law, and no code is held by two rules.
4. Every rule is `meta.type: "problem"` and every rule is `error` in `recommended`.
5. Throw-site rules see only `ThrowStatement` with a directly constructed identifier; anything else is
   outside their reach by construction, not by accident.
6. Declaration rules see only `ClassDeclaration` whose name ends in `Exception`.
7. A filename gate returns an **empty visitor**, so a gated file is not partially checked — it is not
   checked at all.
8. Every open hatch above is a hatch in the *rule*, never a permission in the *law*. Code that slips
   through is still wrong.
9. "The gate is green" and "the rule looked" are different claims, and only one of them is evidence.

## Exceptions

These are carve-outs written into the source, not relief from the law. Each is closed and names the
rule it releases.

- **Test lane.** `.spec.ts`, `-spec.ts` and any path under `/src/tests/` may `throw new Error`, where
  the sentence means "the runner cannot continue" rather than naming a failure the product can produce.
  Releases `throw-abstract-exception` only; `require-exception-object-arg` still fires in the test lane.
  The carve-out was once granted in prose and missing from the rule, and a repository adopting it
  inherited 69 findings its own law had already excused.
- **Liveness and readiness probe.** A file matching the probe pattern may throw a framework exception,
  because the status code is the whole contract there — the reader takes the status and never the body,
  so the status *is* the identity. Releases the framework branch of `throw-abstract-exception` only.
  `Error` is still refused: a probe's status is a contract, an unnamed crash is not.
- **Framework constructors.** `require-exception-object-arg` skips every name in the framework list.
  That constructor shape was published by the framework, and rewriting it changes what is sent. Whether
  such an exception may be thrown at all belongs to `throw-abstract-exception`.
- **The base's own file.** `exceptions/errors/abstract.ts` is released from `exception-extends-abstract`
  — it holds the one class allowed to extend something else.
- **Per-application exception folders.** The folder gate deliberately does not anchor to one absolute
  path, releasing `exception-in-errors-folder` for any correctly spelled folder pair. An earlier version
  encoded a single repository's layout and reported 83 findings in a second back end whose top offenders
  were already sitting in an `exceptions/errors/` folder — just not that one. A rule that fires on
  correct code is worse than no rule, because the next author learns to scroll past it.

## Output

One block per finding:

```text
rule:     <throw-abstract-exception | require-exception-object-arg | exception-extends-abstract | exception-in-errors-folder>
code:     <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4>
file:     <path as the rule normalized it>
gate:     <none | test-lane | probe | base-file | errors-folder>
node:     <ThrowStatement argument | first argument | superClass | class identifier>
message:  <bareError | framework | zero | extra | notObject | base | place>
verdict:  <fires | silent: hatch <name from the Open table>>
```

A clean file emits one block per rule that ran with `message: none` and `verdict: silent: no hatch` —
the rules looked and found nothing. An out-of-scope file emits a block naming the gate that matched and
`verdict: silent: gate` — no visitor was installed, so the file is unjudged rather than clean.

## Worked example

**Input.** One service file, `modules/enrollment/enrollment.service.ts`, and one class file beside
it, `modules/enrollment/course-already-enrolled.exception.ts`:

```ts
// enrollment.service.ts
import { ConflictException } from "@nestjs/common"
import { CourseAlreadyEnrolledException } from "./course-already-enrolled.exception"

export class EnrollmentService {
  enroll(userId: string, courseId: string) {
    if (!courseId) throw new Error("missing course")
    if (this.full(courseId)) throw new ConflictException("course is full")
    if (this.has(userId, courseId)) throw new CourseAlreadyEnrolledException()
  }
}
```

```ts
// course-already-enrolled.exception.ts
import { ConflictException } from "@nestjs/common"

export class CourseAlreadyEnrolledException extends ConflictException {}
```

Neither file matches a test-lane, probe, base-file or errors-folder pattern, so all four rules run.

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  bareError
verdict:  fires
```

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  framework
verdict:  fires
```

```text
rule:     require-exception-object-arg
code:     EXCEPTION-2
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     first argument
message:  zero
verdict:  fires
```

The third throw reads house-shaped, so `EXCEPTION-1` passes it. The declaration is where it is caught:

```text
rule:     exception-extends-abstract
code:     EXCEPTION-3
file:     src/modules/enrollment/course-already-enrolled.exception.ts
gate:     none
node:     superClass
message:  base
verdict:  fires
```

```text
rule:     exception-in-errors-folder
code:     EXCEPTION-4
file:     src/modules/enrollment/course-already-enrolled.exception.ts
gate:     none
node:     class identifier
message:  place
verdict:  fires
```

**Repaired.** The class moves into `modules/enrollment/exceptions/errors/` and extends the house
base; every throw names a house exception and passes one object literal:

```ts
// src/modules/enrollment/exceptions/errors/course-already-enrolled.exception.ts
import { AbstractException } from "../../../../exceptions/errors/abstract"

export class CourseAlreadyEnrolledException extends AbstractException {}
```

```ts
// enrollment.service.ts
if (!courseId) throw new CourseIdRequiredException({ courseId })
if (this.full(courseId)) throw new CourseFullException({ courseId })
if (this.has(userId, courseId)) throw new CourseAlreadyEnrolledException({ userId, courseId })
```

An open hatch survives the repair. One ordinary refactor puts the same bare `Error` back past every
rule:

```ts
const failure = new Error("missing course")
throw failure
```

```text
rule:     throw-abstract-exception
code:     EXCEPTION-1
file:     src/modules/enrollment/enrollment.service.ts
gate:     none
node:     ThrowStatement argument
message:  none
verdict:  silent: hatch an Identifier at the ThrowStatement is not a NewExpression
```

That `message: none` is a report of none, and it is not a pass: the handler returns on its first line,
so this throw is unjudged rather than compliant.

And the metadata inside the repaired throws is judged by nothing at all: `EXCEPTION-5` has no rule, so
`{ userId, courseId }` carrying nothing a reader of the failure could use is silence, not compliance.

## Scope

This module documents four rules of one back-end law, and only enforcement — not the law's own text. It
names no product, no company and no repository. Rule names, message identifiers and the class names the
rules match are **identifiers that ship** and are reproduced verbatim; that exemption covers nothing
else. What the metadata must contain, and whether a test assertion is a domain failure, are owned by
`EXCEPTION-5` and `EXCEPTION-6`, which no rule in this module holds.
