---
id: be-lints-e2e-flow-index
title: INDEX.md
slug: /be/lints/e2e-flow
sidebar_label: e2e-flow
sidebar_position: 0
description: What the flow-file lint rules can actually see, what they cannot, and which law code each one holds.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `e2e-flow`

## Law

A flow file turns one business sentence into a test that fails when the business breaks and at no
other time. The law that says so carries twelve codes under the prefix `E2E-`. Eight of them turn on
what a name means, what is being asserted, or who is acting — and a rule that fires on a judgement is
one authors learn to disable, which leaves the law worse off than when nothing enforced it.

This shelf does not restate that law. It records **enforcement**: for each published rule, the exact
syntax it watches, and — the part nobody writes down — the ways of writing the same mistake that it
does not watch at all.

The rule module publishes **five** rules and this file documents five, which matches the count the
law itself claims. Their identity is the published name: the string that appears in a build log and
in a disable comment. No numeric code is invented for them here.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `e2e-uses-production-transport` | `E2E-11` (direct-internal-actor half) | Three separate things under one name: a dispatcher name imported from the CQRS package; **any** non-computed member call whose method is `execute` or `process`; and a member call whose receiver is an identifier ending in `Worker` or `Handler`. |
| `e2e-asserts-persisted-state` | `E2E-4` (persisted-state half) | A flow file in which not one of six persistence identifier names appears anywhere in the source. One report per file, anchored at `Program`. |
| `no-model-call-in-e2e` | `E2E-12` (provider-import half) | An `import` declaration whose source string matches one of six model-provider package patterns. |
| `no-sleep-in-flow` | `E2E-3` (the sleep half only) | A call to one of five bare sleeping identifiers, or a `new Promise` whose raw source text contains `setTimeout`. |
| `no-branch-in-flow-step` | `E2E-7` | `if`, a ternary, `switch`, or a logical operator used as a whole statement, lexically inside an `it` or `test` callback. |

All five map to a code the law publishes, so this shelf records no rule enforcing an unpublished
decision. What it does record is five gaps between a rule's **name** and its **mechanism**, because a
name is what a reader trusts when the report is not in front of them.

**Finding — `e2e-uses-production-transport` bans two method names outright.** The `execute`/`process`
branch never looks at the receiver. It reports `client.execute()`, `builder.execute()`,
`stream.process()` and every other member call spelled that way, in any flow file, whatever the
object is. Inside this lane that is not academic: the ordinary persistence read is
`createQueryBuilder(…).…execute()`, so writing the state-read that `e2e-asserts-persisted-state`
demands, in the shape the persistence library offers, trips the transport rule. Two rules on this
shelf pull in opposite directions on the same line.

**Finding — `e2e-asserts-persisted-state` checks a mention, not an assertion.** It sets a flag on any
`Identifier` bearing one of six names, anywhere: an unused import, a type annotation, a parameter, a
variable declared and never read. It then reports only when the flag is still false at end of file.
A flow that names `dataSource` once while seeding fixtures and afterwards asserts nothing but a
response envelope — the exact defect `E2E-4` exists for — passes. The name says *asserts*; the
mechanism says *mentions*.

**Finding — `no-model-call-in-e2e` detects an import, not a call.** A flow that leaves the real
provider client wired and lets the application's own policy reach it spends real money, is
nondeterministic, and imports nothing. So does a flow that reaches the provider over plain HTTP by
URL. Both are the failure the rule is named for and neither is visible to it.

**Finding — `no-sleep-in-flow` holds only half of its code.** `E2E-3` is two claims: never sleep, and
poll **with a deadline**. The rule enforces the first. A poll loop with no deadline, which hangs until
the runner's own timeout and then reports a timeout instead of the state that never arrived, is
exactly what the law asks against and is not detectable here.

**Finding — `no-branch-in-flow-step` scopes "step" lexically.** A branch is only a branch when it
sits, in this same file, inside an `it` or `test` callback. Moving the same `if` into a helper
function declared ten lines above — or into `beforeAll`, or into `beforeEach`, or into the `describe`
body — deletes the rule with no diff to it.

## Detection

| Rule | Mechanism |
|---|---|
| *(file gate, all five)* | `isE2eSpec(context.filename \|\| context.getFilename())`: the filename is coerced with `String(… \|\| "")`, back-slashes are replaced by forward slashes, and the result is tested against `/\.e2e-spec\.ts$/`. A file that fails this test never has a visitor installed — the rule object returns `{}`. |
| `e2e-uses-production-transport` | Visits `ImportDeclaration`: acts only when `node.source.value` is **exactly** `@nestjs/cqrs`, then for each `ImportSpecifier` reads `specifier.imported.name \|\| specifier.imported.value` and reports `busImport` when it is `CommandBus`, `QueryBus` or `EventBus`. Visits `CallExpression`: requires `callee.type === "MemberExpression"` and `callee.computed === false`; reports `direct` when `callee.property.name` is `execute` or `process`, and returns. Otherwise unwraps `callee.object` through `TSAsExpression`, `TSTypeAssertion` and `ChainExpression`, and reports `actor` when what is left is an `Identifier` matching `/(?:Worker\|Handler)$/`. |
| `e2e-asserts-persisted-state` | Visits **every** `Identifier` and tests `node.name` against `/^(?:entityManager\|dataSource\|EntityManager\|DataSource\|getRepository\|queryRunner)$/`, setting a file-scoped boolean. On `"Program:exit"`, reports `state` at the `Program` node when the boolean is still false. |
| `no-model-call-in-e2e` | Visits `ImportDeclaration`; requires `node.source.value` to be a string, then tests it against `/^(?:@anthropic-ai\/\|openai$\|openai\/\|ollama$\|@google\/generative-ai\|@mistralai\/\|cohere-ai)/`. Three alternatives are anchored prefixes with a trailing slash, two are exact (`openai`, `ollama`), and two — `@google/generative-ai`, `cohere-ai` — are open-ended prefixes. |
| `no-sleep-in-flow` | Visits `CallExpression`: requires `callee.type === "Identifier"` and `callee.name` in the set `{sleep, delay, wait, pause, setTimeout}`. Walks `node.parent` upward; if any ancestor is a `NewExpression` whose `callee.name` is `Promise`, it returns without reporting, so the promise branch owns that case. Otherwise reports `sleep`. Visits `NewExpression`: requires `node.callee.name === "Promise"`, then takes the node's **raw source text** through `context.sourceCode.getText(node)` and reports `timer` when that text matches `/setTimeout/`. |
| `no-branch-in-flow-step` | Visits `IfStatement`, `ConditionalExpression`, `SwitchStatement`, and `LogicalExpression` — the last only when `node.parent.type === "ExpressionStatement"`. Each candidate passes through `insideStep`, which walks `node.parent` upward and returns true at the first `CallExpression` ancestor whose `callee.name` — or, failing that, whose `callee.object.name` — is `it` or `test`. |

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| `import { CommandBus as Bus } from "@nestjs/cqrs"` | The **imported** name is read, never the local one, so renaming at the import changes nothing. |
| `import { "QueryBus" as Bus } from "@nestjs/cqrs"` | The string-literal import form is covered by the `imported.value` fallback. |
| `(orderWorker as OrderWorker).run()` | The receiver is unwrapped through `TSAsExpression` and `TSTypeAssertion` before the name test, so a cast does not hide it. |
| `orderWorker?.run()` | `ChainExpression` is unwrapped for the same reason. |
| `await new Promise((resolve) => setTimeout(resolve, 500))` | Reported once, as `timer`. The call branch walks its ancestors and stands down, deliberately, so one sleep does not produce two findings. |
| `new Promise((resolve) => globalThis.setTimeout(resolve, 500))` | The promise branch matches raw source **text**, not a call node, so qualifying the timer does not hide it. |
| `it.each([…])("step", …)` with a branch inside | `insideStep` falls back to `callee.object.name`, so `it.each`, `it.only`, `it.skip`, `test.each` and `it.concurrent` are all still steps. |
| `import Chat from "openai/resources/chat"` | The provider test is a prefix, and `openai/` is one of its alternatives. |
| A path written with back-slashes | The filename is normalised to forward slashes before the suffix test. The suffix carries no slash, so this changes no outcome — the normalisation is inert here rather than load-bearing. |
| `import { Anthropic } from "@anthropic-ai/sdk"` and every other subpath of a scoped provider | Three of the six provider alternatives are scope prefixes ending in a slash, so any package under those scopes matches. |
| A `describe` body containing `it` blocks with branches | `insideStep` stops at the **first** matching ancestor and does not require the step to be the immediate parent, so nesting depth inside the callback is irrelevant. |

### Open

| Rule | Way of writing it that is NOT caught |
|---|---|
| *(all five)* | **The filename.** The whole shelf exists only for files ending `.e2e-spec.ts`. A suite whose flow files are named `*.spec.ts`, `*.e2e.spec.ts`, `*.e2e-spec.mts` or anything else receives none of these five rules, and no diff to any rule is needed to arrange it. Filename is the cheapest thing in a repository to change. Partly held elsewhere: the rules' own twin test asserts that a named inventory of flow files exists at a fixed path with this suffix, so renaming a **listed** flow goes red — but that gate is a test, not a rule, and a flow it does not name is outside it. |
| *(all five)* | **A helper file.** Every gate is per-file. Move the bus call, the sleep, the branch or the provider import one directory over into `world.ts` or `flow-helpers.ts`, import it from the spec, and all five rules stop existing for that code. This is not sabotage — it is what the law's own `E2E-8` ("one place stands the world up") tells an author to do. |
| `e2e-uses-production-transport` | A receiver that is not a bare identifier. `app.get(OrderWorker).handle()`, `workers.order.handle()` and `this.orderWorker.handle()` all present a `CallExpression`, `MemberExpression` or `ThisExpression` as the receiver, and only an `Identifier` is tested. |
| `e2e-uses-production-transport` | A receiver named anything else. The test is a **suffix** on the identifier text and it is case-sensitive: `const worker = …`, `const consumer = …`, `const projector = …` all pass while holding exactly the object the law forbids calling. |
| `e2e-uses-production-transport` | Any internal method except the two hard-coded names. The law names `finalize` explicitly; `finalize`, `handle`, `run`, `consume`, `perform`, `flush` and `onModuleInit` are caught **only** by the receiver-name branch, so on any receiver the name test misses they are invisible. |
| `e2e-uses-production-transport` | A computed member call. `worker["process"]()` returns at the `callee.computed` guard before either branch runs, so the loudest violation in the lane is erased by two brackets. |
| `e2e-uses-production-transport` | Any dispatcher acquired without a named import. `import * as cqrs from "@nestjs/cqrs"`, a default import, `require("@nestjs/cqrs")`, `export { CommandBus } from "@nestjs/cqrs"`, a subpath such as `@nestjs/cqrs/dist/index`, a local barrel re-exporting the same names, or a container lookup by string token — the import branch is an equality test on one specifier shape and one exact source string. |
| `e2e-uses-production-transport` | The mirror-image defect: `builder.execute()` on a query builder, `stream.process()` on a parser, and every unrelated method that happens to be spelled `execute` or `process` are reported although nothing was bypassed. A report where there is no escape trains authors to reach for the disable comment, which is what costs the rule its other two branches. |
| `e2e-asserts-persisted-state` | **An unused import launders the whole file.** One line naming `DataSource` at the top of a spec that afterwards asserts nothing but response envelopes satisfies the rule permanently. Somebody tidying imports could also delete it and turn a passing file red without touching a test. |
| `e2e-asserts-persisted-state` | A state read through the shared harness. `world.db.isEnrolled(…)`, `repo.findOne(…)`, `prisma.order.findFirst(…)` and `mongo.collection(…).findOne(…)` are genuine persisted reads written the way the law recommends, and every one of them reports unless a spelled-out identifier from the list of six also appears somewhere in the file. |
| `e2e-asserts-persisted-state` | Every store that is not the relational one. Consequences that live in a document store, a cache, an object store or a broker's own state have no name in the list, so a flow that reads them correctly is reported and a flow that reads nothing but adds the word `queryRunner` is not. |
| `e2e-asserts-persisted-state` | The seeding path. The identifier that satisfies the rule is very often the one that wrote the fixture in `beforeAll`, which is a read of nothing. The rule cannot distinguish set-up from assertion because it never looks at where the identifier sits. |
| `no-model-call-in-e2e` | Any import that is not an `ImportDeclaration`: `require("openai")`, `await import("openai")`, `export * from "openai"`. |
| `no-model-call-in-e2e` | Any provider outside six patterns. Cloud-hosted variants under a platform scope, aggregator gateways, self-hosted runtimes, the successor package names vendors publish after a rename, and near-miss names such as `openai-edge` — which fails both the exact and the slash-prefix alternative — are all unlisted, and a list is a thing that must be fed. |
| `no-model-call-in-e2e` | **Reaching the provider without an SDK.** `fetch("https://api.…/v1/chat/completions", …)`, or the same call through the repository's HTTP client, imports nothing the rule looks at while doing precisely what the rule is named against. |
| `no-model-call-in-e2e` | **Leaving the real client wired.** The most expensive form of this mistake is not an import at all: the flow scripts nothing, the application's own policy resolves its configured provider, and a live paid nondeterministic call happens inside a green run. |
| `no-model-call-in-e2e` | `import type { … } from "openai"` reports although nothing ships. The over-report is the price of a pure syntax test, and it lands on the author who is doing the right thing — typing a scripted result. |
| `no-sleep-in-flow` | A member-expression sleep. `timers.setTimeout(500)`, `world.sleep(500)` and `clock.wait(500)` are not bare identifiers. The modern promise-based timer is normally written exactly that way, so the most current spelling of the banned habit is the one that passes. |
| `no-sleep-in-flow` | A rename. `import { sleep as settle } from "./util"`, or `const nap = sleep`, moves the callee outside a five-name set. |
| `no-sleep-in-flow` | Any other way to burn time: `setImmediate`, `process.nextTick`, `promisify(setTimeout)(500)` — where the callee is a call expression and the timer identifier is only an argument — a `while` loop on `Date.now()`, or a fixed-count retry loop with no wait at all. |
| `no-sleep-in-flow` | **A poll with no deadline.** The second half of the code the rule holds is unenforced, so the recommended replacement written badly — loop until the state arrives, forever — passes cleanly and fails as a runner timeout that names no state. |
| `no-sleep-in-flow` | The mirror-image defect on the promise branch: it matches raw text, so `new Promise(…)` whose body merely *mentions* `setTimeout` in a comment, or names a variable `setTimeoutMs`, reports although it never sleeps. |
| `no-branch-in-flow-step` | **A branch in a helper.** `insideStep` is a lexical ancestor walk, so a condition inside a function the step calls is outside every rule on this shelf, even when that function is declared in the same file. |
| `no-branch-in-flow-step` | A branch in `beforeAll`, `beforeEach`, `afterEach` or the `describe` body. The rule's twin test declares this valid on purpose — outside a step a conditional reads as set-up rather than a hedged assertion — but conditional set-up is also how a flow most often ends up asserting different things on different runs, so the hatch is real whether or not it is intended. |
| `no-branch-in-flow-step` | Branching that is not one of the four node types: `try`/`catch`, `.catch(() => …)`, `Promise.allSettled`, optional chaining on the value under assertion, and `??` used as an initializer — the nullish operator is a `LogicalExpression`, but only the statement position is reported, so `const found = a ?? b` passes. |
| `no-branch-in-flow-step` | A logical operator in expression position. `expect(a \|\| b).toBe(true)` is a test prepared for either outcome, written inside an assertion, and the rule deliberately stands down there to avoid false positives. |
| `no-branch-in-flow-step` | An assertion loose enough to pass down either path without any operator at all — a matcher on a subset, a matcher on any value, an assertion on `length` rather than on content. The law's claim is that a green run must be evidence; syntax can only see four of the ways it stops being one. |
| `no-branch-in-flow-step` | A step declared under a name the walk does not know, such as the `specify` alias. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename`, falling back to `context.getFilename()`, normalised to forward slashes |
| import source | the string value on an `ImportDeclaration` |
| imported name | `imported.name`, falling back to `imported.value`, on an `ImportSpecifier` |
| member call | `callee.property.name` plus the unwrapped `callee.object` |
| identifier text | `node.name` on any `Identifier` in the file |
| raw source text | `sourceCode.getText(node)` for the `new Promise` branch |
| lexical ancestry | the `parent` chain, for step containment and for the promise-wrapped-sleep stand-down |

## Invariants

- A rule's identity is its published name; nothing here assigns it a number.
- Detection is purely syntactic. No module is resolved, no type is consulted, no test is run.
- A file is in scope only when its name ends `.e2e-spec.ts`. There is no second gate and no
  configuration option: the scope of this shelf is a filename suffix.
- Every rule holds at most one half of its law code, and the module says so in its own header rather
  than presenting the coverage as complete.
- Two rules on this shelf can disagree about the same line, and the disagreement is real rather than
  a configuration mistake.
- The module's own severity opinion is `error` for all five; the consuming configuration remains the
  authority on what is actually switched on.

## Exceptions

There is no per-file exemption list, no allow-list and no exempt directory in this module. That is
worth stating plainly, because it means every escape is a matter of **shape** rather than of
permission, and shape is the thing an author changes without noticing.

The three exemptions that do exist are internal to a rule, and each is argued:

- **A sleep inside `new Promise` is skipped by the call branch**, so it is reported once. Two findings
  on one line teach nobody which of them to fix.
- **A logical operator is only reported in statement position**, so the same operator inside an
  assertion is left alone. This buys quiet at the cost of the `a || b` assertion.
- **A computed member call is dropped before either transport branch**, which is not argued anywhere
  and reads as an oversight rather than a decision.

## Output

```text
rule:    <published rule name>
file:    <path as the gate saw it, forward slashes>
node:    <ImportDeclaration | ImportSpecifier | CallExpression | NewExpression | Identifier |
          IfStatement | ConditionalExpression | SwitchStatement | LogicalExpression | Program>
message: <busImport | direct | actor | state | provider | sleep | timer | branch>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why a machine is worth having for
it, `example.md` for the code that fires and the code that slips through, `audit.md` while reviewing
whether the enforcement still matches the law, and `changelog.md` for version history.

## Scope

This module documents the five rules published by the flow law's rule module, shipped in
`@starci/eslint-canon-be`. It documents no rule that ought to exist: a rule that cannot be pointed at
is a proposal, and proposals are listed in `audit.md` as open risk instead.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the rule module is such a change; so is an open hatch that gets closed.
