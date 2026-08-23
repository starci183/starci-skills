# Exceptions

## LOADS

None.

## Record

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
