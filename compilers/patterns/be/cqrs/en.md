---
title: CQRS
---

# CQRS

The input to this pattern is a shape that has already been accepted: an operation the backend has
agreed to expose, a capability someone signed off, a contract already settled. The output is source
architecture — which folder the operation owns, which file each piece lands in, what that file may
import, what it must export, and what it is named. This pattern never re-opens the decision that the
operation should exist; it lands that decision in files.

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

## Situation codes

Every situation this module governs carries a code, `CQRS-<n>`. The numbers are fixed and are cited
from other law files and from task records; a code keeps its number and its meaning for as long as
it exists.

| Code | Situation | What the source must look like |
|---|---|---|
| `CQRS-1` | An operation stands as a folder, and every file in it carries the operation name | Requires: one operation, one folder; every file in it named `<operation>.<role>.ts`. Forbids: a file in the folder not named for the operation; one operation split across folders |
| `CQRS-2` | A message carries request context and computes nothing | Requires: a command or query holding a single `params` field carrying request, user and locale. Forbids: methods, getters, defaults or any computation on a message; several constructor fields |
| `CQRS-3` | A handler plugs into the base template method | Requires: a handler implementing the protected `process` of the base template. Forbids: declaring `execute` on a handler class; a standalone handler with no `process` |
| `CQRS-4` | The service beside the handler only dispatches | Requires: a service beside the handler that dispatches and returns, one line. Forbids: business rules, repository access, validation or orchestration in that service |
| `CQRS-5` | A handler that cannot do its work says why | Requires: a handler that cannot do its work throwing the domain exception naming why. Forbids: returning `null` for failure; returning a success shape carrying an error field |
| `CQRS-6` | Work that must happen whether or not the caller is still there | Requires: an event only for work that must happen whether or not the caller is still there. Forbids: an event whose completion the caller's own answer depends on |
| `CQRS-7` | The decisions live in the handler, so the test lives beside the handler | Requires: `<operation>.handler.spec.ts` in the same folder as the handler. Forbids: a handler with no spec; the spec relocated into a separate test tree |

`CQRS-1` AND `CQRS-7` ARE ABOUT THE SAME FOLDER, NOT THE SAME FACT. `CQRS-1` says what may live in
the folder; `CQRS-7` says what must. A folder can satisfy one and fail the other, which is why they
are two codes and not one.

## Reading an accepted shape

1. Read what the shape states. It states that an operation exists, what it is called, and what it
   answers. That gives the operation's verb-object name and its message kind.
2. Read what the shape does not state. It does not state which file each piece lands in, which base
   the handler extends, where failure is expressed, or where the spec sits. The shape does not
   resolve those; this pattern does.
3. Resolve outermost first. Settle the folder before the files inside it: the operation folder is
   decided under `CQRS-1`, and only then does each file inside get its code.
4. Ask each code's question in turn. Does every file carry the operation name (`CQRS-1`)? Does the
   message compute anything (`CQRS-2`)? Does the handler implement `process` rather than declare
   `execute` (`CQRS-3`)? Is the service one dispatching line (`CQRS-4`)? Does each refusal throw a
   named domain exception (`CQRS-5`)? Does the caller wait on this work (`CQRS-6`)? Is the twin spec
   in this folder (`CQRS-7`)?
5. When two codes both match, they are matching about different files or different facts. `CQRS-1`
   and `CQRS-7` are about the same folder, not the same fact: place under `CQRS-1`, then require
   under `CQRS-7`. `CQRS-1` and `CQRS-4` split the same way — `CQRS-1` says which file may be in the
   folder, `CQRS-4` says what that service file may contain, so a service in the right place can
   still hold the wrong contents. `CQRS-2` and `CQRS-4` both forbid business logic, but in different
   files and for different reasons. Every operation resolves to exactly one code per situation; no
   operation is out of scope.

## `CQRS-1` — one operation, one folder

**Situation.** You are adding a new operation, or looking for a home for a file that appeared while
you worked. The operation's folder holds the message, handler, service, door, wiring and spec — and
every file in it carries the operation name.

**What it emits in source.** One folder named for the operation, and inside it every file named
`<operation>.<role>.ts`: `.command.ts`, `.handler.ts`, `.service.ts`, `.resolver.ts`, `.module.ts`,
`.module-definition.ts`. No file in the folder is named for anything other than the operation, and
the operation is not split across folders.

**Recognition signs.** Knowing the operation name lets you guess **every** filename in the folder.
Grepping the operation name returns the whole operation, not a slice of it. A generically named file
in the folder (`utils`, `helpers`, `mapper`) is the sign that something reusable was just born where
nobody will look for it. Ask: does this file carry the operation name? If not, it is shared, and it
belongs where other people can find it.

**Boundary.** Not `CQRS-4`: `CQRS-1` says which file **may** live in the folder, `CQRS-4` says what
that service file **may contain** — a service in the right place can still hold the wrong contents.
Not `CQRS-7`: `CQRS-1` says what may live in the folder, `CQRS-7` says what **must**; a folder can be
clean under `CQRS-1` and still be missing its spec.

**Common business situations.** Adding a new mutation · splitting an overloaded mutation in two · a
price-calculation function written straight into the operation folder and then copied by a second
operation · a shared enum dropped into the folder of the first operation that needed it.

## `CQRS-2` — a message carries request context only

**Situation.** A command or query carries exactly one `params` field, and that field carries the
request, the authenticated user and the locale. No methods, no defaults, no logic.

**What it emits in source.** A plain class in `<operation>.command.ts` (or `<operation>.query.ts`)
whose constructor takes exactly one `readonly params` and declares nothing else.

**Recognition signs.** The message constructor has exactly one parameter, named `params`. No getter
computes a new value out of the request. No default value is filled in here. Ask: if two different
call sites dispatch this message, could they read it two different ways? If the message computes
anything, the answer is yes.

**Boundary.** Not `CQRS-4`: both are places business logic may not sit, but for different reasons.
Logic in the service is logic **no other door can reach**; logic in the message is logic **nobody
reads**, because a message is glanced at, not searched for decisions. Not `CQRS-6`: an event is also
a message, but it carries the payload of work to be done, not the request context of a caller who is
waiting.

**Common business situations.** A message normalising an email · a message defaulting `page = 1` · a
message computing `totalAmount` from a list of items · a message splitting an id string into an array
· a message with an `isAdmin()` reading off the user.

## `CQRS-3` — a handler implements `process`, never `execute`

**Situation.** The base handler is a **template method**: `execute` is the public door and it calls
the `process` the handler supplies. That seam exists so a cross-cutting concern — timing, logging,
opening a transaction, retry — is added **once** at the base instead of a hundred times in each
handler.

**What it emits in source.** A handler class in `<operation>.handler.ts` extending the base and
declaring `protected override async process(...)`. `execute` stays concrete on the base and is not
declared on the handler.

**Recognition signs.** The handler declares `protected override async process(...)`. If the handler
declares `execute`, it has **stepped out of the template**: it still compiles, still runs, and is
exactly the file the next cross-cutting change silently misses. Ask: if someone adds a transaction to
the base next week, does this file get it?

**Boundary.** Not `CQRS-4`: a service **also** has a method named `execute`, and that is correct — a
service inherits no template. The misplaced `execute` is `execute` on a **handler**. Not the
intermediate abstract handler exception: a handler extending another abstract handler may **inherit**
`process`, declaring nothing and still being correct.

**Common business situations.** Copying an old handler written before the base existed · a family of
queries suggesting one shared way to search · adding runtime logging across every handler and finding
three files that never appear in the log.

## `CQRS-4` — the service dispatches, and that is all

**Situation.** The service beside the handler exists so **the door does not have to import the bus**.
It is one line long, and it is one line long on purpose.

**What it emits in source.** A service in `<operation>.service.ts` whose whole method body is one
`commandBus.execute(new …Command(params))` and returns. It imports no repository, no entity manager,
no business service.

**Recognition signs.** The method body is a single `commandBus.execute(new …Command(params))` call.
The service imports no repository, no entity manager, no business service. A business `if` here means
that rule just landed somewhere **with no message**, so a CLI doing the same work cannot reach it and
will grow its own copy. Ask: if a background job needs exactly this operation tomorrow, can it call
it? If it has to stand up a whole door first, the rule is in the wrong place.

**Boundary.** Not `CQRS-2`: see above — same prohibition, different file and different reason. Not
`CQRS-5`: a service throwing a domain exception itself is still wrong — not because throwing is
wrong, but because the **decision** to throw sits outside the handler. In the right place the same
exception is thrown from `process`.

**Common business situations.** Checking course ownership before adding to the cart · checking
permissions inside the service · mapping a DTO inside the service · a service calling two buses in a
row to "join" two operations.

## `CQRS-5` — the handler owns failure, and failure is a domain exception

**Situation.** A handler that cannot do its work **throws the exception that names why**. It does not
return `null`, and it does not return a success shape carrying an error string.

**What it emits in source.** Inside `<operation>.handler.ts`, each failure path throws a named domain
exception carrying the identifier that caused it; no path returns `null` to mean "no".

**Recognition signs.** Each refusal branch has its own name, and that name carries the data the
caller will need. There is no `return null` meaning "not allowed". There is no `{ ok: false, error }`
— every caller would decode it its own way. Ask: can the caller tell "does not exist", "was deleted"
and "not permitted to read" apart? If all three arrive as the same `null`, the reason died on the way
back.

**Boundary.** Not `CQRS-4`: see above — same exception, different throw site, different conclusion.
Not `CQRS-6`: a failed side effect does **not** turn the main operation into a failure. Mail that
could not be sent is the event handler's business; it must not drown the answer the caller is waiting
for.

**Common business situations.** Returning `null` when a record is not found · swallowing an error and
returning an empty array · returning `{ success: false, message }` for the layer above to guess at ·
throwing a bare `Error` instead of an exception with an identity.

## `CQRS-6` — an event is for work that must happen anyway

**Situation.** Dispatch an event when the work must happen **whether or not the caller is still
there** — an email, a projection, a synchronisation. Anything the caller's own answer depends on
stays in the command.

**What it emits in source.** An event class carrying a payload, and a handler that enqueues —
nothing on the request path awaits its result. The event returns no value.

**Recognition signs.** Nobody `await`s the event's result to answer the request. The event returns no
value, and nobody needs it to. If a resolver publishes an event and then **asks the database again**
whether the row is there, that is a command written as an event. Ask: does the caller need to know
this finished before it can answer? If yes, it is a command.

**Boundary.** Not `CQRS-2`: both are messages; the difference is **who waits**. A command has someone
waiting for the result, an event does not. Not `CQRS-5`: see above.

**Common business situations.** Sending a confirmation mail · updating a read projection ·
synchronising to a second data store · emitting a notification · writing an audit log · adding a user
to an external group.

## `CQRS-7` — the handler has its twin spec beside it

**Situation.** `<operation>.handler.spec.ts`, in the same folder. The handler is where the decisions
live, so that is where the unit test lives.

**What it emits in source.** A file `<operation>.handler.spec.ts` sitting beside
`<operation>.handler.ts`, not in a parallel test tree.

**Recognition signs.** Opening the operation folder shows the spec immediately. Whoever edits the
handler sees the spec **without going to look for it**; a spec in a separate test tree is seen only
by someone who went looking for tests. Ask: will whoever edits this file tomorrow have the spec hit
them in the eye, or do they have to remember it exists?

**Boundary.** Not `CQRS-1`: see above. `CQRS-1` is "may live here", `CQRS-7` is "must live here".

**Common business situations.** A new handler with no spec yet · a spec moved into a central test
tree "for tidiness" · a spec named differently from the operation so grep misses it · a new refusal
branch added to the handler with the spec unchanged.

## Layer held

Which tier actually holds each code. `unrepresentable` means the wrong value cannot be written;
`enforced` means a named rule from `sources/be/cqrs.mjs` reports it; `documented` means nothing
mechanical holds it and only a reader does.

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

A law that cannot be pointed at in real code is a proposal. Each code names a file in the reference
repository and what to look for there.

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
only; the examples here name no product and no repository.

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

## Rules

1. The work lives in a handler. A door and a service carry the request; they do not decide anything.
2. One operation, one folder; the folder is the whole operation.
3. A message carries request context and computes nothing.
4. A handler implements `process`; `execute` belongs to the base.
5. A failure is a thrown domain exception, not an encoded return value.
6. An event is for work whose completion the caller does not need.
7. A handler has its twin spec in the same folder.
8. Every operation resolves to exactly one code per situation. No operation is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and names the code it applies to.

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
  the operation, not something invented in it. This is a recorded tension with the strict reading of
  the rule, not a silent softening of it.
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

One block per file the shape produces.

## Worked example

The accepted shape: a learner may add a course to their cart, and the operation refuses when the
learner already owns that course.

The shape states that the operation exists, its verb-object name, and one refusal. It does not state
which files exist, which base the handler extends, whether the refusal is a return value or a throw,
or where the test sits — the shape does not resolve any of that, this pattern does.

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-1
placement: add-to-cart/add-to-cart.command.ts
reason: this is placement in the operation folder, not the contents of the service file — CQRS-4 governs contents, and a service in the right place can still hold the wrong contents
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-2
placement: add-to-cart/add-to-cart.command.ts
reason: the class is a plain class with one readonly params, so it is a message and not the decorated .command.ts door the CQRS-2 exception carves out
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-3
placement: add-to-cart/add-to-cart.handler.ts
reason: the class is standalone and declares process itself, so the intermediate-abstract-handler exception does not apply and execute stays on the base
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-4
placement: add-to-cart/add-to-cart.service.ts
reason: the body is one commandBus.execute call and imports no repository, which is what separates it from CQRS-2 — the prohibition is the same, the file and the reason are not
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-5
placement: add-to-cart/add-to-cart.handler.ts
reason: the caller waits on this refusal, so it is a thrown domain exception in the handler and not the CQRS-6 event path whose failure must not drown the caller's answer
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: event
situation: CQRS-6
placement: add-to-cart/add-to-cart.handler.ts
reason: nothing on the request path awaits the notification, so the caller's answer does not depend on it and it is not a command
```

```text
operation: add-to-cart
doors: resolver | cli | test
message: command
situation: CQRS-7
placement: add-to-cart/add-to-cart.handler.spec.ts
reason: CQRS-1 only permits this file in the folder; CQRS-7 requires it, which is why a folder clean under CQRS-1 can still be missing its spec
```

## Scope

This rule holds for any message-dispatched backend operation in this stack. It names no single
feature. Its examples are ordinary TypeScript in a Nest-shaped application and name no product, no
company and no repository. The Anchor table is the only place carrying repository paths, and it
carries them as verification, not as illustration.
