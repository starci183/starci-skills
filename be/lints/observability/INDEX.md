---
id: be-lints-observability-index
title: INDEX.md
slug: /be/lints/observability
sidebar_label: observability
sidebar_position: 0
description: What the two published observability lint rules can actually see, and the ways of writing they do not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `observability`

## Law

The law lives in [`patterns/observability.md`](../../canon/patterns/observability.md) and carries
eight codes, `OBSERVABILITY-1` through `OBSERVABILITY-8`. This module documents something narrower
and more useful: **which of those codes a machine holds, by what mechanism, and where the mechanism
ends.**

Two rules are published. That is the whole machine, and it is smaller than the law by a wide margin.

The law names three ways a log escapes the pipeline — the framework's own logger, `console`, and a
name fused with its data. The first has a house rule. The second is delegated to the standard
`no-console`, deliberately: shipping a second implementation of a rule everybody already has is a
maintenance cost with no gain. The third has a house rule and is the one worth writing, because it
is the only escape that still **looks** like structured logging: the call goes through the right
service, in the right shape, and produces an unqueryable line anyway.

The rest of the law is judgement. Whether a log records a decision or merely an arrival, whether a
failure carried its identity or its rendered English, whether a telemetry process paid for its own
lifecycle — none of that is a shape. A parser can see that a call happened; it cannot see what the
code is FOR. A rule that guessed would fire on correct code often enough that everybody would learn
to switch it off, and a rule everybody switches off enforces nothing while looking like it does.

So the honest statement of enforcement is: **two codes have a machine with known holes in it, one
code is held by a config list rather than a rule, and five codes have no machine at all.** Both
halves matter. A code with no rule is known to be unenforced and gets read by a human. A rule
believed to be airtight, that is not, buys silence and pays for it with false coverage.

## Rules

The identity of a rule is its published name — the string a build log prints, a disable comment
names, and a config file sets a severity on. There is no second numeric identifier.

| Rule | Code it enforces | What it reports |
|---|---|---|
| `no-framework-logger` | `OBSERVABILITY-1` (one half) | A named import of `Logger` from the exact source string `@nestjs/common` (`imported`), and any `new Logger(...)` where the callee is the bare identifier (`constructed`) |
| `no-interpolated-log-message` | `OBSERVABILITY-2` | The first argument of a log method on the house logging service when that argument is a template literal, a `+` concatenation, or a string literal (`built`) |

Both published rules map to a code. The gap runs the other way, and it is large:

| Code | Held by | Note |
|---|---|---|
| `OBSERVABILITY-1` | `no-framework-logger` **plus** the standard `no-console` | The house rule holds one of the two exits named by the code; the other exit is switched on by name in `recommended` and is not authored here |
| `OBSERVABILITY-2` | `no-interpolated-log-message` | Holds the negative half only — see below |
| `OBSERVABILITY-3` | *nothing* | No rule inspects the second argument, so a name with no data beside it is silent |
| `OBSERVABILITY-4` | *nothing* | "Decision, not arrival" needs to know what the code is for |
| `OBSERVABILITY-5` | *nothing* | A rendered exception message inside the data object is a value, not a shape |
| `OBSERVABILITY-6` | `standaloneProgramGlobs`, an exported path list | A config value, not a rule. It is the sanctioned exit, and it is scoped by folder |
| `OBSERVABILITY-7` | *nothing* | A change boundary is a review artifact |
| `OBSERVABILITY-8` | *nothing* | A lifecycle budget is a brief, not a node type |

`OBSERVABILITY-2` deserves the sharpest statement on this page. The code says the event name **is an
enum member**. The rule bans three spellings of a built string. Those are not the same claim: the
rule holds the negative half of the code and none of the positive half. An argument that is neither
template, concatenation nor string literal passes — including an identifier, a function call, a
number and `null`. **Nothing here verifies that a log name came from the enum.**

The severity the module asks for, as shipped in `recommended`:

| Rule | Recommended severity | Why |
|---|---|---|
| `no-framework-logger` | `error` | Measured at zero once the standalone-program folders are scoped off in the consuming config |
| `no-interpolated-log-message` | `error` | Measured at zero |
| `no-console` | `error` | The standard rule, named here so a repository switches all three exits on together |

A rule ships at `error` only once its measured count is zero. The count for `no-framework-logger`
reaches zero only with the sanctioned exit applied as a path scope; applied as per-line suppressions
instead, the exception grows until nobody can see how wide it has become — which is the reason the
glob list is exported rather than described.

Leaving `no-console` off makes the other two decorative. It is the third exit, and the cheapest one
to reach.

## Detection

Read this table before the next one. What a rule can be dodged by follows directly from what it
looks at.

| Rule | Mechanism |
|---|---|
| `no-framework-logger` | Two visitors, no filename gate at all — the rule exists in every linted file. **`ImportDeclaration`**: returns immediately unless `node.source.value` is exactly the string `@nestjs/common`; then iterates `node.specifiers`, skips anything whose `type` is not `ImportSpecifier`, and reports when `specifier.imported.name` is exactly `Logger`. The report is attached to the specifier, so a disable comment must sit on the import line. **`NewExpression`**: reports when `node.callee.type` is `Identifier` and `node.callee.name` is exactly `Logger` — no import path is consulted at all on this branch, which is what stops an aliased or re-exported construction from walking past the import check |
| `no-interpolated-log-message` | One visitor, no filename gate. **`CallExpression`**: requires `callee.type === "MemberExpression"` and `callee.computed === false`; requires `callee.property.name` to be a member of the closed set `log`, `error`, `warn`, `info`, `debug`, `verbose`; requires the receiver to pass `isLoggerReceiver`, which accepts an `Identifier` whose `name` is exactly `winstonService`, or a non-computed `MemberExpression` whose `property.name` is exactly `winstonService`, and nothing else. Then reads `node.arguments[0]`; returns if absent; reports when that node is a `TemplateLiteral`, a `BinaryExpression` whose `operator` is `+`, or a `Literal` whose `value` is `typeof "string"`. The report is attached to the argument |

Three properties of these mechanisms decide everything in the next section:

- **The receiver is matched by spelling, never by type.** `isLoggerReceiver` compares an identifier
  name. It has no idea what class is behind it.
- **Only the first argument is read.** Everything from the second onward is unexamined.
- **Only three node types count as "built".** A string that arrives as anything else is not a
  string as far as the rule is concerned.

## Escape Hatches

### Closed

Ways of writing that a reader might expect to slip past, and why they do not.

| Rule | The dodge that fails | Why it fails |
|---|---|---|
| `no-framework-logger` | `import { Logger as AppLogger } from "@nestjs/common"` | The comparison is against `specifier.imported.name`, which is the name at the source, not `local.name`. Renaming on import changes nothing |
| `no-framework-logger` | Importing it from a local barrel that re-exports it, then constructing | The import branch misses, but the `NewExpression` branch consults no import path — `new Logger(...)` reports wherever the identifier came from |
| `no-framework-logger` | Constructing it without ever writing an import, in a file where the name is global or ambient | Same branch. The construction is caught on the callee's spelling alone |
| `no-framework-logger` | `import { Logger, Injectable } from "@nestjs/common"` in one statement | The loop walks every specifier, not the first |
| `no-framework-logger` | Putting the construction inside a class field, a factory, a getter or a callback | `NewExpression` is a node type, not a position. Where it sits is irrelevant |
| `no-interpolated-log-message` | `this.winstonService.info(...)` versus a destructured `winstonService.info(...)` | Both receiver shapes are accepted: a bare `Identifier` and a non-computed `MemberExpression` ending in that property name |
| `no-interpolated-log-message` | Reaching the service through a deeper path, `this.deps.winstonService.info(...)` | Only the **last** property name is compared, so any depth of member access still matches |
| `no-interpolated-log-message` | A template literal with no substitutions, `` `ORDER_HANDLED` `` | The node type is `TemplateLiteral` regardless of whether anything was interpolated into it |
| `no-interpolated-log-message` | A plain constant string, `"ORDER_HANDLED"` | A string `Literal` is one of the three reported shapes. The rule is wider than its name: it bans the correct-looking constant too |
| `no-interpolated-log-message` | Switching level to dodge, `verbose` instead of `info` | All six house levels are in the set |
| `no-interpolated-log-message` | Building with `+` instead of a template | `BinaryExpression` with the `+` operator is reported by name |

### Open

Ways of writing these rules genuinely do **not** catch. Each row is a real violation of the law that
the machine reports nothing about.

| Rule | What slips through | Why the mechanism misses it |
|---|---|---|
| `no-framework-logger` | `import * as common from "@nestjs/common"` then `new common.Logger(...)` | The import loop skips every specifier that is not an `ImportSpecifier`, and a namespace specifier is not one. The construction's callee is a `MemberExpression`, which the second branch rejects because it demands an `Identifier`. **Both branches miss the same line.** This is the single widest hole on the page |
| `no-framework-logger` | Any sibling class from the same package: `new ConsoleLogger(...)`, or a custom class implementing the framework's logger interface | The identifier set is one literal string, `Logger`. The concrete implementation the framework also exports is a different spelling and is invisible on both branches |
| `no-framework-logger` | `class HouseLogger extends Logger {}` in one file, `new HouseLogger()` in forty others | `extends` is not a `NewExpression`, so the declaring file reports only if it imported the name directly; every consuming file imports a local name from a local path and sees nothing. One wrapper turns the rule off across the repository |
| `no-framework-logger` | `Logger.log("…")` — the static call, with the class reached through a namespace or a re-export | Nothing constructs, so the second branch is idle, and the import branch only sees the exact package string. Static use of the framework logger is a full bypass of the correlation id with no node the rule visits |
| `no-framework-logger` | A deep or aliased package path: `"@nestjs/common/services"`, or a workspace alias mapped to the same package | `node.source.value !== FRAMEWORK_PACKAGE` returns before any specifier is read. The comparison is string equality on the written source, not module resolution |
| `no-framework-logger` | `const { Logger } = require("@nestjs/common")` | There is no `ImportDeclaration` node in a `require` call. A later `new Logger()` is still caught, but passing the class onward — to a factory, to a framework `useLogger` call — is not |
| `no-framework-logger` | A file inside the folders named by `standaloneProgramGlobs` that is not a standalone program | **Folder exemptions are not file exemptions.** The sanctioned exit is a path glob, so a request-scoped service that gets moved or created under an exempt folder is silently outside enforcement, with no signal anywhere. The exit is correct and the granularity is a directory |
| `no-framework-logger` | `import type { Logger } from "@nestjs/common"` | Inverted: this one **does** report, and should not — `importKind` is never consulted, so a type-only reference that bypasses nothing is reported as a bypass. The hole here is a false report rather than a silent violation, and it teaches people to write disable comments on lines that were correct |
| `no-interpolated-log-message` | The property is named anything else: `this.logger.info(…)`, `this.log.info(…)` | The receiver is matched by the spelling `winstonService`. The rule is a naming convention with a message about correlation ids. Rename the injected property — the most ordinary tidying there is — and the rule stops existing for that class |
| `no-interpolated-log-message` | **Constants launder literals.** `const message = \`opened ${id}\`` on one line, `this.winstonService.info(message)` on the next | The first argument is now an `Identifier`. The three reported node types are all gone, and nothing follows the variable back to where it was built. Not sabotage — somebody extracting a long line |
| `no-interpolated-log-message` | Any call in the first position: `this.winstonService.info(buildName(order))`, `info(names.get(kind))`, `info(\`x\`.toUpperCase())` | A `CallExpression` is not one of the three shapes. The fused string is produced one frame away and arrives as a value |
| `no-interpolated-log-message` | The fusion moves one slot right: `this.winstonService.error(WinstonLog.PaymentFailed, \`declined: ${error.message}\`)` | Only `arguments[0]` is read. The event name is now correct and groupable, and the data beside it is still an unqueryable sentence. This is `OBSERVABILITY-3` and `OBSERVABILITY-5` in one line, and no rule looks at it |
| `no-interpolated-log-message` | `this.winstonService.info(someVariable)`, `info(0)`, `info(null)`, `info(cond ? A : \`built ${x}\`)` | The positive half of the code is unenforced. Only a string-shaped literal is refused; anything else is assumed to be an enum member and never checked. The conditional hides a template inside a node type that is not inspected |
| `no-interpolated-log-message` | Computed access on either side: `this.winstonService["info"](\`…\`)` or `this["winstonService"].info(\`…\`)` | The first fails `callee.computed === false`; the second fails `isLoggerReceiver`, which rejects a computed `MemberExpression`. Either spelling switches the rule off for that call |
| `no-interpolated-log-message` | Detaching the method: `const { info } = this.winstonService`, or `const log = this.winstonService.info.bind(…)`, then `log(\`…\`)` | The callee is now a plain `Identifier`, not a `MemberExpression`, so the visitor returns at its first line |
| `no-interpolated-log-message` | A level outside the closed set — `fatal`, `http`, `silly`, or a generic `write`/`emit` the transport layer exposes | `LOG_METHODS` is a closed set of six. A service that grows a seventh level grows a seventh unguarded door, and nothing in the rule notices the set went stale |
| `no-interpolated-log-message` | A second logging service, or the same service injected under a second name in one class | Identity is one string. Any other spelling is not a logger as far as this rule is concerned |
| *both* | `process.stdout.write(…)`, a raw transport call, or `globalThis.console.log(…)` | The first two are outside both rules and outside `no-console`. The third is outside `no-console` as well, because that rule tracks references to the `console` identifier rather than every path that reaches the object |

Three of these are the same defect wearing different clothes, and they are worth naming once:
**identity by spelling is identity by nothing** — a rename, an alias, a namespace or a wrapper
removes the rule; **only the argument the rule reads is guarded**, so a violation moves one slot
right and disappears; and **a folder is not a file**, so a path-scoped exemption is wider than the
exception it was bought for. None of these is sabotage. All three are what tidying up looks like.

## Inputs

| Input | Evidence required |
|---|---|
| import source | The literal string as written in the file, compared for exact equality — not the resolved module |
| import specifier | The name at the source (`imported.name`), and the specifier's node type |
| construction callee | The node type first, then the identifier's spelling |
| call receiver | The last property name in the member chain, or the identifier itself. Never the type |
| call method | The property name, against a closed set of six |
| first argument | Its node type, and for a `Literal` the `typeof` of its value |
| path scope | For the sanctioned exit, the glob list the source exports so a config and a measuring gate read the same one |

## Invariants

- A rule's identity is its published name. No numeric code is minted for a rule.
- A rule reports only what its mechanism can see, and this shelf states that boundary rather than
  the law's ambition.
- Neither rule reads the filesystem, and neither has a filename gate. They exist in every linted
  file, and the only scoping is the config's.
- An exemption is declared once by path in the consuming config, never as an accumulation of
  per-line suppressions. One list, exported, so the config and the gate cannot disagree.
- A rule ships at `error` only at a measured count of zero, and the measurement is taken with the
  path scope already applied.
- A code with no rule is recorded as unenforced. It is never assigned to the nearest rule that
  happens to fire nearby.
- A standard rule named in the recommended set is named as standard. This module does not claim
  authorship of enforcement it delegates.

## Exceptions

Each exemption below is deliberate and closed.

- **A program with no request to correlate is exempt by path.** An agent or a command-line entry
  point runs outside the request lifecycle: there is no correlation id to attach and no transport
  configured, so the house service would give it a dependency and nothing else. The exemption is a
  folder glob declared once, and the cost of that granularity is stated in the Open table above.
- **`console` is not reimplemented.** The standard rule already does it exactly. Naming it in the
  recommended set is the whole of this module's position on that exit.
- **A decorated or wrapped construction is not special-cased.** The construction branch consults no
  import path deliberately, which over-reports a same-named class from an unrelated package. That
  over-report was accepted: a second class named `Logger` in one repository is a naming problem
  worth surfacing.
- **The positive half of the name check is not attempted.** Proving an argument came from a
  particular enum needs type information the rule does not have. Refusing three spellings of the
  known failure is what a syntax rule can hold honestly; claiming more would be claiming type
  awareness this does not have.

## Output

```text
rule: <published rule name>
code: <OBSERVABILITY-n | none>
mechanism: <node type, matched literal or option consulted>
verdict: <reports | silent>
hatch: <the way of writing that would make this silent, or "none found">
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine,
`example.md` for code that fires and code that does not — including code that slips through — and
`audit.md` only while reviewing enforcement coverage.

## Scope

This module documents enforcement, not product. No prose here names a product, a repository or a
company. Rule names, the plugin namespace, the matched package string and the matched receiver
identifier are reproduced verbatim, because they are the exact strings a build log prints and a
reader must match against; that is the one exemption, and it does not extend to prose.

## Version Rule

Increment all five records by `0.01` for an accepted change to what is documented here, and record
it in `changelog.md`. A rule added to or removed from the source is such a change, and so is a
change to the exported path scope.
