# Observability

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
which published rule fired, on which node, by what matched literal, which law code that maps to, and
the open hatch that would have hidden the same failure. This module chooses no logging design. It
refuses one, and it must be able to point at the character it refuses on.

## Law

Every log leaves the process through a pipeline that attaches a correlation id and a transport, and
every log carries a name that can be counted, grouped and filtered. The law names three ways a log
escapes that pipeline — the framework's own logger, `console`, and a name fused with its data.

The law states eight codes, `OBSERVABILITY-1` through `OBSERVABILITY-8`. **Two of them have a rule.**
One more, `OBSERVABILITY-6`, is held by a config list rather than by a rule. Five have no machine at
all. That is not an accident of coverage: the rest of the law is judgement. Whether a log records a
decision or merely an arrival, whether a failure carried its identity or its rendered English, whether
a telemetry process paid for its own lifecycle — none of that is a shape. A parser can see that a call
happened; it cannot see what the code is FOR. A rule that guessed would fire on correct code often
enough that everybody would learn to switch it off, and a rule everybody switches off enforces nothing
while looking like it does.

So the honest statement of enforcement is: **two codes have a machine with known holes in it, one code
is held by a config list rather than a rule, and five codes have no machine at all.** A code with no
rule is known to be unenforced and gets read by a human. A rule believed to be airtight, that is not,
buys silence and pays for it with false coverage.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-framework-logger` | `OBSERVABILITY-1` (one half) | `imported` — a named import of `Logger` from the exact source string `@nestjs/common`; `constructed` — any `new Logger(...)` where the callee is the bare identifier |
| `no-interpolated-log-message` | `OBSERVABILITY-2` | `built` — the first argument of a log method on the house logging service when that argument is a template literal, a `+` concatenation, or a string literal |

Both published rules map to a code. The gap runs the other way, and it is large. `OBSERVABILITY-3` (a
name with no data beside it) has **no rule**: nothing inspects the second argument. `OBSERVABILITY-4`
("decision, not arrival") has **no rule**: it needs to know what the code is for. `OBSERVABILITY-5` (a
rendered exception message inside the data object) has **no rule**: that is a value, not a shape.
`OBSERVABILITY-7` (a change boundary) has **no rule**: it is a review artifact. `OBSERVABILITY-8` (a
lifecycle budget) has **no rule**: it is a brief, not a node type. `OBSERVABILITY-6` is held by
`standaloneProgramGlobs`, an exported path list — a config value, not a rule, scoped by folder. Those
six are unenforced rather than covered, and a green run says nothing about any of them.

`OBSERVABILITY-2` deserves the sharpest statement on this page. The code says the event name **is an
enum member**. The rule bans three spellings of a built string. Those are not the same claim: the rule
holds the negative half of the code and none of the positive half. An argument that is neither
template, concatenation nor string literal passes — including an identifier, a function call, a number
and `null`. **Nothing here verifies that a log name came from the enum.**

The other exit named by `OBSERVABILITY-1` is `console`, delegated to the standard `no-console` and
switched on by name in `recommended`. Leaving `no-console` off makes the other two decorative: it is
the third exit, and the cheapest one to reach.

## Reading a diff

1. **Decide scope before anything else, and record it.** Neither rule has a filename gate, so the only
   scope is the config's path scope. A file the config excluded is not clean — no visitor was
   installed and the rule did not exist for that file.
2. **Check the exemption first.** A file inside the folders named by `standaloneProgramGlobs` is
   released by path. Folder exemptions are not file exemptions; record which glob released it.
3. **Read the nodes in the order the rules do.** `ImportDeclaration` source string, then specifier
   types and `imported.name`; `NewExpression` callee type before callee name; for a log call, callee
   type, `callee.computed`, the method name, the receiver spelling, then `arguments[0]` and nothing
   after it.
4. **Emit one block per finding.**
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure** — a namespace
   import, a wrapper class, a renamed receiver, a laundering constant, a slot to the right.
6. **Do not report what no rule watches.** Six of the eight codes have no rule; a verdict that claims
   otherwise is wrong about the module.

## `no-framework-logger` — OBSERVABILITY-1

**What it reports.** Two things, two messages. `imported` — an import statement taking the name
`Logger` from the exact source string `@nestjs/common`; the report is attached to the **specifier**, so
a disable comment must sit on the import line, not the use line. `constructed` — any `new Logger(...)`
whose callee is a bare identifier.

**How it detects.** Two visitors, no filename gate at all — the rule exists in every linted file.
`ImportDeclaration` returns immediately unless `node.source.value` is exactly the string
`@nestjs/common`; then it iterates `node.specifiers`, skips anything whose `type` is not
`ImportSpecifier`, and reports when `specifier.imported.name` is exactly `Logger` — the name at the
source, not `local.name`. `NewExpression` reports when `node.callee.type` is `Identifier` and
`node.callee.name` is exactly `Logger`; no import path is consulted at all on this branch, which is
what stops an aliased or re-exported construction from walking past the import check.

**What it cannot see.** `import * as common from "@nestjs/common"` then `new common.Logger(...)`: the
import loop skips every specifier that is not an `ImportSpecifier`, and a namespace specifier is not
one, while the construction's callee is a `MemberExpression`, which the second branch rejects. **Both
branches miss the same line** — the single widest hole on this page. Any sibling class from the same
package, `new ConsoleLogger(...)` or a custom class implementing the framework's logger interface: the
identifier set is one literal string. `class HouseLogger extends Logger {}` in one file and
`new HouseLogger()` in forty others: `extends` is not a `NewExpression`, and one wrapper turns the rule
off across the repository. `Logger.log("…")`, the static call reached through a namespace or a
re-export: nothing constructs, and the import branch only sees the exact package string. A deep or
aliased package path, `"@nestjs/common/services"` or a workspace alias: the comparison is string
equality on the written source, not module resolution. `const { Logger } = require("@nestjs/common")`:
there is no `ImportDeclaration` node, so passing the class onward — to a factory, to a framework
`useLogger` call — is unseen. A file inside `standaloneProgramGlobs` that is not a standalone program:
a folder is not a file, and a request-scoped service moved under an exempt folder is silently outside
enforcement with no signal anywhere. And inverted: `import type { Logger } from "@nestjs/common"`
**does** report and should not, because `importKind` is never consulted — a false report that teaches
people to write disable comments on lines that were correct.

**Boundary.** This rule holds one of the two exits named by `OBSERVABILITY-1`. The `console` exit
belongs to the standard `no-console`, named in `recommended` and not authored here.

## `no-interpolated-log-message` — OBSERVABILITY-2

**What it reports.** One message, `built`: the first argument of a log method on the house logging
service when that argument is a `TemplateLiteral`, a `BinaryExpression` whose operator is `+`, or a
`Literal` whose `value` is `typeof "string"`. The report is attached to the argument, not the call. Note
that a bare constant string is caught too: `info("ORDER_HANDLED")` looks obedient and still reports,
because it is one edit away from being a different event to every dashboard built on it.

**How it detects.** One `CallExpression` visitor, no filename gate. It requires
`callee.type === "MemberExpression"` and `callee.computed === false`; requires `callee.property.name`
to be a member of the closed set `log`, `error`, `warn`, `info`, `debug`, `verbose`; requires the
receiver to pass `isLoggerReceiver`, which accepts an `Identifier` whose `name` is exactly
`winstonService`, or a non-computed `MemberExpression` whose `property.name` is exactly
`winstonService`, and nothing else. Then it reads `node.arguments[0]`, returns if absent, and reports
on the three shapes.

**What it cannot see.** A renamed injected property — `this.logger.info(…)`, `this.log.info(…)` — with
the same service behind it: the receiver is matched by the spelling `winstonService`, so the rule is a
naming convention carrying a message about correlation ids, and one ordinary rename ends it for that
class. **Constants launder literals**: `` const message = `opened ${id}` `` on one line,
`this.winstonService.info(message)` on the next — the argument is now an `Identifier` and nothing
follows the variable back. Any call in the first position: `info(buildName(order))`,
`info(names.get(kind))`, `` info(`x`.toUpperCase()) `` — a `CallExpression` is not one of the three
shapes, and the fused string arrives as a value one frame away. The fusion moving one slot right,
`` this.winstonService.error(WinstonLog.PaymentFailed, `declined: ${error.message}`) `` — only
`arguments[0]` is read, so the name is groupable and the data beside it is still an unqueryable
sentence; that is `OBSERVABILITY-3` and `OBSERVABILITY-5` in one line and no rule looks at it. The
positive half is unenforced: `info(someVariable)`, `info(0)`, `info(null)`,
`` info(cond ? A : `built ${x}`) `` all pass, the conditional hiding a template inside a node type that
is not inspected. Computed access on either side: `` this.winstonService["info"](`…`) `` fails
`callee.computed === false` and `` this["winstonService"].info(`…`) `` fails `isLoggerReceiver`.
Detaching the method, `const { info } = this.winstonService` or
`const log = this.winstonService.info.bind(…)`, makes the callee a plain `Identifier` and the visitor
returns at its first line. A level outside the closed set — `fatal`, `http`, `silly`, or a generic
`write`/`emit` the transport layer exposes — is a seventh unguarded door, and nothing notices the set
went stale. And a second logging service, or the same service injected under a second name in one
class, is not a logger as far as this rule is concerned.

**Boundary.** This rule holds the negative half of `OBSERVABILITY-2` only. What sits in the second
argument is `OBSERVABILITY-3` and `OBSERVABILITY-5`, and neither has a rule.

## Detection

| Part | Mechanism |
|---|---|
| path gate | There is none in either rule. Neither reads the filesystem and neither has a filename gate; they exist in every linted file, and the only scoping is the config's |
| import walker | `node.source.value` compared for exact equality against `@nestjs/common`, then `node.specifiers` iterated, non-`ImportSpecifier` entries skipped, `specifier.imported.name` compared against `Logger`. The loop walks every specifier, not the first |
| construction walker | `node.callee.type === "Identifier"` and `node.callee.name === "Logger"`. `NewExpression` is a node type, not a position: a class field, a factory, a getter or a callback makes no difference |
| call walker | `callee.type === "MemberExpression"`, `callee.computed === false`, `callee.property.name` in the closed set of six, receiver through `isLoggerReceiver`, then `node.arguments[0]` — its node type, and for a `Literal` the `typeof` of its value |
| receiver reader | `isLoggerReceiver` compares an identifier name. Only the **last** property name in the member chain is compared, so any depth of member access still matches. It has no idea what class is behind it |
| the sanctioned exit | `standaloneProgramGlobs`, an exported path list, so a config and a measuring gate read the same one. It is the only thing here that reaches outside the linted file, and it reaches only as far as a folder |

Three properties decide everything below: **the receiver is matched by spelling, never by type**;
**only the first argument is read**, everything from the second onward unexamined; and **only three node
types count as built**, so a string arriving as anything else is not a string as far as the rule is
concerned.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `import { Logger as AppLogger } from "@nestjs/common"` | The comparison is against `specifier.imported.name`, the name at the source, not `local.name` |
| Importing from a local barrel that re-exports it, then constructing | The import branch misses, but the `NewExpression` branch consults no import path |
| Constructing with no import at all, where the name is global or ambient | Same branch: the construction is caught on the callee's spelling alone |
| `import { Logger, Injectable } from "@nestjs/common"` in one statement | The loop walks every specifier, not the first |
| Construction inside a class field, a factory, a getter or a callback | `NewExpression` is a node type, not a position |
| `this.winstonService.info(...)` versus a destructured `winstonService.info(...)` | Both receiver shapes are accepted: a bare `Identifier` and a non-computed `MemberExpression` |
| `this.deps.winstonService.info(...)` | Only the last property name is compared, so any depth still matches |
| `` `ORDER_HANDLED` `` with no substitutions | The node type is `TemplateLiteral` regardless of whether anything was interpolated |
| `"ORDER_HANDLED"`, a plain constant string | A string `Literal` is one of the three reported shapes; the rule is wider than its name |
| Switching level, `verbose` instead of `info` | All six house levels are in the set |
| Building with `+` instead of a template | `BinaryExpression` with the `+` operator is reported by name |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-framework-logger` | **A namespace import plus a member construction**, `import * as common` then `new common.Logger()` — both branches miss the same line, the widest hole here |
| `no-framework-logger` | **A sibling class**, `new ConsoleLogger(...)` or a custom implementation of the logger interface |
| `no-framework-logger` | **A house wrapper**, `class HouseLogger extends Logger {}` used in forty files |
| `no-framework-logger` | **The static call**, `Logger.log("…")` reached through a namespace or a re-export |
| `no-framework-logger` | **A deep or aliased package path**, and **`require`** — no `ImportDeclaration` node exists |
| `no-framework-logger` | **A file inside an exempt folder that is not a standalone program** — a folder is not a file |
| `no-framework-logger` | **Inverted: `import type { Logger }` reports and should not**, because `importKind` is never read |
| `no-interpolated-log-message` | **A renamed receiver**, **a laundering constant**, **any call in the first position**, **the fusion one slot right**, **the whole positive half**, **computed access on either side**, **a detached method**, **a level outside the closed set**, and **a second logging service** |
| neither | **`process.stdout.write(…)`, a raw transport call, or `globalThis.console.log(…)`** — the first two are outside both rules and outside `no-console`; the third is outside `no-console` too, which tracks references to the `console` identifier rather than every path reaching the object |
| neither | **Everything `OBSERVABILITY-3`, `OBSERVABILITY-4`, `OBSERVABILITY-5`, `OBSERVABILITY-7` and `OBSERVABILITY-8` forbid** — a name with no data beside it, a log of an arrival rather than a decision, a rendered exception message in the data object, an unbounded change boundary, an unpaid lifecycle budget |

Three of these are the same defect wearing different clothes: **identity by spelling is identity by
nothing** — a rename, an alias, a namespace or a wrapper removes the rule; **only the argument the rule
reads is guarded**, so a violation moves one slot right and disappears; and **a folder is not a file**,
so a path-scoped exemption is wider than the exception it was bought for. None of these is sabotage.
All three are what tidying up looks like.

## Rules

1. A rule's identity is its published name. No numeric code is minted for a rule.
2. A rule reports only what its mechanism can see, and this module states that boundary rather than
   the law's ambition.
3. Neither rule reads the filesystem, and neither has a filename gate. They exist in every linted
   file, and the only scoping is the config's.
4. An exemption is declared once by path in the consuming config, never as an accumulation of per-line
   suppressions. One list, exported, so the config and the gate cannot disagree.
5. A rule ships at `error` only at a measured count of zero, and the measurement is taken with the path
   scope already applied. `no-framework-logger`, `no-interpolated-log-message` and the standard
   `no-console` all ship at `error`.
6. A code with no rule is recorded as unenforced. It is never assigned to the nearest rule that
   happens to fire nearby.
7. A standard rule named in the recommended set is named as standard. This module does not claim
   authorship of enforcement it delegates.

## Exceptions

Each exemption below is deliberate and closed.

- **A program with no request to correlate is exempt by path.** An agent or a command-line entry point
  runs outside the request lifecycle: there is no correlation id to attach and no transport configured,
  so the house service would give it a dependency and nothing else. The exemption is a folder glob
  declared once, and it releases `no-framework-logger` for every file under that folder — the cost of
  that granularity is stated in the Open table above.
- **`console` is not reimplemented.** The standard rule already does it exactly. Naming it in the
  recommended set is the whole of this module's position on that exit; it releases this module from
  authoring the second exit, not from requiring it.
- **A decorated or wrapped construction is not special-cased.** The construction branch consults no
  import path deliberately, which over-reports a same-named class from an unrelated package. That
  over-report was accepted: a second class named `Logger` in one repository is a naming problem worth
  surfacing.
- **The positive half of the name check is not attempted.** Proving an argument came from a particular
  enum needs type information the rule does not have. This releases every argument that is not one of
  the three refused shapes. Refusing three spellings of the known failure is what a syntax rule can
  hold honestly; claiming more would be claiming type awareness this does not have.

## Output

One block per finding:

```text
rule: <published rule name>
code: <OBSERVABILITY-n | none>
mechanism: <node type, matched literal or option consulted>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

A clean file emits one block with `verdict: silent` and `hatch: none found`. A file released by
`standaloneProgramGlobs` emits `verdict: silent` with the glob named as the mechanism — it was not
judged, and it is not clean.
