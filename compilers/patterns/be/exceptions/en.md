---
title: Exceptions
---

# Exceptions

The input is a shape already accepted: a capability whose failure branches have been agreed, a
contract that states what may go wrong, a handler whose refusals are settled. This pattern does not
re-open which failures exist or what they are called — `exception-identity` settles WHICH name,
spelled in which three alphabets. It lands the accepted shape in source: which class is declared,
which folder holds it, which base it extends, what the throw statement carries.

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

**This is binding, not advisory.** Every `throw` in product code has a situation below, and every
`*Exception` declaration has one too. There is no failure too internal to carry a class: the
misconfiguration nobody catches is `EXCEPTION-1` for the same reason the refusal a client renders is,
and "nothing will ever catch this one" is the most common place the rule gets skipped.

## Situation codes

Every situation this module governs carries a code, `EXCEPTION-<n>`. The code names the SITUATION;
the layer and anchor tables below name what actually holds it and where it can be checked in source.
Those are three different facts and this module keeps them apart on purpose.

| Code | Situation | What the source must look like |
|---|---|---|
| `EXCEPTION-1` | A `throw` is written in product code | The thrown value is an `AbstractException` subclass. No `throw new Error(...)`, and no framework exception carrying a status in place of an identity |
| `EXCEPTION-2` | Data is passed at the throw site | The constructor takes ONE metadata object — `{}` when there is nothing to say. No positional arguments, no several arguments, no bare `new XException()` |
| `EXCEPTION-3` | A new failure class is declared | The class declaration itself extends `AbstractException`. Not a framework base, which reads house-shaped at every throw site |
| `EXCEPTION-4` | The declaration file is placed | Under an exceptions folder, with all the other failures. Not beside the code that throws it, invisible until production throws it |
| `EXCEPTION-5` | The metadata contents are decided | Ids, the state, the limit — what the reader of the failure will need. Not a rendered sentence as the only payload |
| `EXCEPTION-6` | A spec must stop because setup broke | A test-runner assertion stays a test-runner assertion. Product code does not borrow the test lanes' exit, and a spec does not name its own setup failure as a domain one |

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

## Reading an accepted shape

1. Read what the shape states. It states which failures exist and what each one means — that a
   lookup can miss, that a limit can be exceeded, that a transition can be refused.
2. Read what it does not state, and therefore does not resolve. It does not state which class is
   declared, which base that class extends, which folder the declaration sits in, or which fields
   ride on the throw. Those are this pattern's output, and they are not inferable from the shape's
   prose.
3. Resolve outermost first. Settle the declaration before the throw: the class and its base and its
   folder are facts of one file, and the throw statement is written against them. A throw read
   before its declaration proves nothing, because a framework-based class is thrown by its own
   house-shaped name.
4. Ask each code's question in turn. What is thrown (`EXCEPTION-1`), what shape it is passed
   (`EXCEPTION-2`), what the declaration extends (`EXCEPTION-3`), where the declaration lives
   (`EXCEPTION-4`), what the metadata carries (`EXCEPTION-5`), and whether this file is a test lane
   (`EXCEPTION-6`).
5. When two codes both match, they are not competing — they are two verdicts on two different
   facts, and both are recorded. A correct class passed positional arguments holds under
   `EXCEPTION-1` and violates `EXCEPTION-2`. A correctly placed class extending a framework base
   holds under `EXCEPTION-4` and violates `EXCEPTION-3`. A situation code maps to exactly one ruling,
   and no ruling serves two codes, so a match on one never consumes the other.

## `EXCEPTION-1` — throw a named class, not a sentence

**Situation.** You are inside a handler, a service, a guard, and a condition has just failed. The
next statement you write decides what everyone downstream can still do with this failure.

**What it emits in source.** A `throw new <name>Exception({ ... })` whose class is an
`AbstractException` subclass. Not `throw new Error("...")`, which carries a sentence and no code, so
nothing can group, match or retry without parsing English. Not a framework exception, which carries a
status and no identity: two unrelated failures look identical to the client, and the only thing
separating them is the message — exactly the part a later refactor rewords.

**Recognition signs.** The `throw` contains an English string describing what just happened; the
client has to read `message` to know which branch it hit; alerts group by status code, so one 400
alert collects six different failures; somebody just asked whether this error is retryable and nobody
could answer without opening the source.

**Boundary.** This is not `EXCEPTION-3`: the same trap seen from the other end. `EXCEPTION-1` reads
the **throw**; `EXCEPTION-3` reads the **declaration**, and a class extending a framework base passes
`EXCEPTION-1` because at the throw site it carries the house name. It is not `EXCEPTION-6`: the same
`throw new Error` line, differing only in the file it sits in — a violation in product code, a
sanctioned exit in a spec. It is not `EXCEPTION-2`: this code asks WHAT is thrown, that one asks what
it CARRIES, and throwing the right class with the wrong argument shape is still a violation, just of
another code.

**Common business situations.** Record not found by id · insufficient balance · API call quota
exceeded · expired token · a state that forbids the transition · an external dependency returning an
error · a required environment variable unset · an upload in the wrong format.

## `EXCEPTION-2` — exactly one object, even when empty

**Situation.** You already have the right class. What goes into the constructor is the question, and
this is where two different habits slip into one codebase.

**What it emits in source.** Exactly one object literal at every throw site — `new XException({})`
when the failure has nothing of its own to say, `new XException({ tier })` when it does. Not
`new XException()`, not `new XException("id")`, not `new XException(a, b)`.

**Recognition signs.** The same file contains both `new XException()` and `new YException({...})`;
a constructor takes `(id: string, status: string)` instead of an object; a throw site passes two
arguments "so it carries enough information"; somebody just had to grep the repository to fix
argument order after adding a field.

**Boundary.** This is not `EXCEPTION-5`: this code is about the **shape** of the argument — it must
be an object; that one is about the **contents** of the object. `new XException({})` satisfies
`EXCEPTION-2` absolutely and may still be evading `EXCEPTION-5` if the failure actually has an id to
tell. It is not a ruling on a framework exception's constructor: that shape is not ours to dictate,
and whether such a class may be thrown at all is `EXCEPTION-1`'s question.

**Common business situations.** A configuration failure with no id to tell (`{}`) · a lookup failure
carrying exactly one id · a quota failure carrying the current value and the threshold · a transition
failure carrying source and target state · a failure wrapping a third-party library exception,
carrying `originalError`.

## `EXCEPTION-3` — the class extends the house base, not the framework's

**Situation.** You are declaring a new failure class, and a very convenient base is in view: the
framework's, with status and serialization already there. This is where this module's most dangerous
trap sits.

**What it emits in source.** An `extends AbstractException` on the declaration line itself, read from
the declaration file and not inferred from any throw. That class is thrown **by its own name**, so at
every throw site the line reads exactly like a house exception and a rule watching throw sites sees
nothing wrong. That is not hypothetical: exactly one such class lived in the tree, thrown from four
call sites, while the gate stayed green.

**Recognition signs.** The throw site looks entirely normal but the client receives a "clean" status
with no code; the class sits in the right errors folder with the right suffix and only the `extends`
line differs; a filter catches `AbstractException` and this failure never lands in it.

**Boundary.** This is not `EXCEPTION-1`, which reads the throw — the two are one law read from two
ends, and dropping either end leaves exactly the hole the other closes. It is not `EXCEPTION-4`: this
code asks what the class **extends**, that one asks where it **lives**, and a class can sit in the
right place and still extend the wrong base — which is the case that actually happened. It does not
apply to the base's own file: the class every other class extends cannot extend itself, and that
carve-out is granted by **filename**, not by folder, so it cannot spread to a neighbour.

**Common business situations.** Porting an old error over from legacy code · a guard error that must
keep its 401, so somebody reached for the framework base · an upload-layer error needing 413 · a
class generated during a migration whose `extends` line nobody reviewed.

## `EXCEPTION-4` — every failure declared in one folder

**Situation.** The new error declaration file is about to be created, and the handiest place is right
beside the service that throws it. This is the most harmless-looking decision in the module.

**What it emits in source.** A declaration file under an `exceptions/errors/` folder, one such folder
per application, so that "what can this application throw?" has **one** place to look and a reviewer
**sees a new failure mode arrive** in the diff. An exception declared next to the code that throws it
is invisible until something throws it in production.

**Recognition signs.** A `class ...Exception` at the bottom of a service file, after all the logic;
two near-identical errors in two modules, because whoever wrote the second did not know the first
existed; nobody can produce "the application's list of errors" without grepping.

**Boundary.** This is not `EXCEPTION-3`, which reads the `extends` line rather than the path. It is
not a demand for one literal path: the law asks for **one place per application**, so a repository
holding several applications satisfies it with one such folder each, because "what can this
application throw" still has exactly one answer.

**Common business situations.** An adapter's internal error · a background job's error · a
run-once migration's error · an error declared temporarily "to refactor later" · an error born in a
test helper file and then imported back into product code.

## `EXCEPTION-5` — metadata carries what the reader will need

**Situation.** Right class, right shape, right place. One question is left that no rule answers for
you: **what is in that object.**

**What it emits in source.** Fields on the metadata literal that the next reader can act on — the id
of the record not found, the state that made the operation impossible, the threshold just crossed.
The message is for **a human reading a log**; the metadata is for **everything else**: the client
deciding what to display, the retry policy deciding whether to try again, the alert grouping by code
that needs to know which tenant this is. Not a pre-rendered sentence.

**Recognition signs.** The metadata has exactly one field and it is named `message`, `detail`,
`reason` or `description`; the message already interpolated the id via a template string while the
metadata is empty; somebody is writing a regex over `message` in a log dashboard; the client can
display the error but cannot link to the record that caused it.

**A note on the real reader.** As things stand, the HTTP filter sends `statusCode`, `code` and
`message` — and **not** the metadata. So metadata's reader today is the log line and the in-process
caller, not the HTTP client. That does not weaken the law, but it changes the sentence "who will need
this field": before adding a field because "the client needs it", check whether the client receives
it at all.

**Boundary.** This is not `EXCEPTION-2`: shape and contents are two different questions, and this one
is the question no machine measures. It is not `exception-identity`: `code` is identity and belongs
to the adjacent module; this code speaks only about the payload riding alongside that identity.

**Common business situations.** The id of the record not found · the source and target state of a
refused transition · the current balance and the requested amount · the quota and the value already
used · the name of the missing environment variable · `originalError` when wrapping a third-party
library's failure.

## `EXCEPTION-6` — a test-runner assertion is not a domain failure

**Situation.** A spec is running and the fixture will not seed. The test cannot continue. You write
`throw new Error("fixture did not seed")` — and that is **correct**.

**What it emits in source.** A `throw new Error(...)` that stays inside the spec family and the test
tree, where it means "the runner is giving up" rather than naming a failure the product can produce.
A lane forbidden from failing its own setup would have to invent a domain exception for "the fixture
is missing" — putting a failure **of the test** into the same vocabulary the product uses for real
ones, and adding a line to the application's error list that no user can ever reach. The exit is
sanctioned where it applies and nowhere else.

**Recognition signs.** The `throw new Error` line sits in a spec file or the test tree and describes
a condition of the test environment rather than of the business; the reverse — a domain exception
declared that only a spec throws; a test helper imported into product code, carrying this exit with
it.

**Boundary.** This is not `EXCEPTION-1`: the same line of code, differing by file, and the boundary
is a **path** — written twice, once in the rule and once in the config of the repository consuming
it. It is not `EXCEPTION-4`: an exception existing only to serve a test would still sit in the errors
folder if somebody created it, and would look exactly like a real failure — which is precisely what
this code prevents.

**Common business situations.** A fixture that will not seed · a wait condition past its deadline · a
stub called with arguments outside the scenario · a mock script out of steps · a test-environment
dependency that is not ready.

## Layer held

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

Every code in this module is anchored. None is left unanchored.

## Inputs

| Input | Evidence required |
|---|---|
| throw site | The `throw` statement as written, and the file it sits in — the path decides whether the test-lane exit applies |
| declaration | The `class X extends Y` line, read from the declaration and not inferred from the throw |
| location | The folder the declaration sits in, relative to an `exceptions/errors/` boundary |
| payload | The fields on the metadata object, and which reader needs each one |
| reader | Who acts on this failure: a client branch, a retry policy, an alert grouping, or a human reading a log |

## Rules

1. A failure is a class, not a sentence.
2. The throw site and the declaration tell the same story; neither alone is proof.
3. One folder answers "what can this application throw?".
4. Every throw of a house exception passes exactly one object literal.
5. The message is for a human; the metadata is for everything else.
6. A situation code maps to exactly one ruling, and no ruling serves two codes.
7. Every throw in product code and every `*Exception` declaration resolves to a verdict under every
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

One block per file the shape produces.

```text
throw:       <the throw statement as written>
declaration: <class X extends Y, from the declaration file>
location:    <folder of the declaration>
payload:     <fields on the metadata object>
situation:   <EXCEPTION-1 | EXCEPTION-2 | EXCEPTION-3 | EXCEPTION-4 | EXCEPTION-5 | EXCEPTION-6>
verdict:     <holds | violates>
reason:      <the reader that could not act on this failure>
```

## Worked example

The accepted shape: *purchasing an AI subscription refuses in two ways — the account already holds a
subscription, and the requested tier is not purchasable.*

That sentence states the two failure branches and what each means. It does not state which classes
are declared, which base they extend, which folder they sit in, or which fields ride on each throw —
so it does not resolve any of them. This pattern resolves them; `exception-identity` resolves the
names.

The declaration file for the first branch:

```text
throw:       —
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     —
situation:   EXCEPTION-3
verdict:     holds
reason:      the `extends` line was read from the declaration, not inferred from the throw site — a
             framework base here would still read house-shaped at every throw
```

```text
throw:       —
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     —
situation:   EXCEPTION-4
verdict:     holds
reason:      not EXCEPTION-3, because the base is already correct; this is the separate fact that the
             file sits in the one folder answering "what can this application throw?"
```

The handler file, first throw:

```text
throw:       throw new SubscriptionAlreadyActiveException({})
declaration: class SubscriptionAlreadyActiveException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     none — the failure has nothing of its own to say
situation:   EXCEPTION-2
verdict:     holds
reason:      not EXCEPTION-5, because the object is empty by fact and not by omission — the viewer is
             already identified by the request, so no id is being hidden in a sentence
```

The handler file, second throw:

```text
throw:       throw new TierNotPurchasableException({ tier })
declaration: class TierNotPurchasableException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     tier
situation:   EXCEPTION-5
verdict:     holds
reason:      not EXCEPTION-2, because the argument shape was never in doubt; the fact that decides
             this code is that the tier the caller asked for is a field, not interpolated into the
             message
```

```text
throw:       throw new TierNotPurchasableException({ tier })
declaration: class TierNotPurchasableException extends AbstractException
location:    src/modules/platform/exceptions/errors/ai/
payload:     tier
situation:   EXCEPTION-1
verdict:     holds
reason:      not EXCEPTION-6, because the file is a product handler and not a test lane — the path is
             what separates the two, and a `throw new Error` here would be a violation
```

## Scope

This rule holds for any back end of this stack that names its failures. It names no single feature,
no product, no private module and no repository; the examples are ordinary TypeScript in the shape a
Nest application writes. The `Anchor` table is the one place that cites repository-relative paths,
because a law that cannot be pointed at in real code is a proposal.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier
somebody will read in a failure and have to look up.
