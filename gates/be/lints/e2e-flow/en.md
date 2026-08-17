---
title: E2e-flow
---

# E2e-flow

The input is code that is already written — one flow file, one hunk of a diff. The output is a
**verdict**: whether the file was in scope at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses nothing about how a flow should be written. It refuses, and it must be able to
point at the import, the call or the branch it refuses on.

## Law

A flow file turns one business sentence into a test that fails when the business breaks and at no
other time. The law that says so carries **twelve** codes under the prefix `E2E-`. Eight of them turn
on what a name means, what is being asserted, or who is acting — and a rule that fires on a judgement
is one authors learn to disable, which leaves the law worse off than when nothing enforced it.

**Five codes have a rule**: `E2E-3`, `E2E-4`, `E2E-7`, `E2E-11`, `E2E-12`. The rule module publishes
five rules and this file documents five, which matches the count the law itself claims. Their identity
is the published name — the string that appears in a build log and in a disable comment. No numeric
code is invented for a rule here.

This module does not restate the law. It records **enforcement**: for each published rule, the exact
syntax it watches, and — the part nobody writes down — the ways of writing the same mistake that it
does not watch at all.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `e2e-uses-production-transport` | `E2E-11` (direct-internal-actor half) | Three separate things under one name: a dispatcher name imported from the CQRS package; **any** non-computed member call whose method is `execute` or `process`; and a member call whose receiver is an identifier ending in `Worker` or `Handler`. |
| `e2e-asserts-persisted-state` | `E2E-4` (persisted-state half) | A flow file in which not one of six persistence identifier names appears anywhere in the source. One report per file, anchored at `Program`. |
| `no-model-call-in-e2e` | `E2E-12` (provider-import half) | An `import` declaration whose source string matches one of six model-provider package patterns. |
| `no-sleep-in-flow` | `E2E-3` (the sleep half only) | A call to one of five bare sleeping identifiers, or a `new Promise` whose raw source text contains `setTimeout`. |
| `no-branch-in-flow-step` | `E2E-7` | `if`, a ternary, `switch`, or a logical operator used as a whole statement, lexically inside an `it` or `test` callback. |

All five map to a code the law publishes, so this module records no rule enforcing an unpublished
decision.

The **other seven codes** under the `E2E-` prefix have no rule at all. This module's source names none
of them, so they cannot be named here either — but they are unenforced rather than covered, and a
green run says nothing about any of them. The same is true of the half-codes: `E2E-11`'s "did the test
enter through the production gate" half, `E2E-4`'s "is the consequence asserted a business
consequence" half, `E2E-12`'s "internal policy stays intact, only the outside result is scripted"
half, and `E2E-3`'s "poll **with a deadline**" half all have no machine. Every rule here holds at most
one half of its code.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and none of the five rules existed for that file.
2. **Scope is one filename suffix.** `isE2eSpec` tests the normalised path against `/\.e2e-spec\.ts$/`.
   `*.spec.ts`, `*.e2e.spec.ts` and `*.e2e-spec.mts` receive no rule at all.
3. **There are no exemptions to check** — no allow-list, no exempt directory, no per-file opt-out. The
   only three exemptions are internal to a rule and are listed under Exceptions.
4. **Read the callee shape before the callee name.** The transport rule needs a non-computed
   `MemberExpression`; the sleep rule needs a bare `Identifier`. A shape mismatch ends the check before
   any name is tested.
5. **Emit one block per finding**, and write the `hatch` line whenever an open hatch would have hidden
   the same failure.
6. **Do not report what no rule watches.** Seven of the twelve codes have no machine, and four of the
   five enforced codes are held by half. A verdict that claims otherwise is wrong about the module.

## `e2e-uses-production-transport` — E2E-11

**What it reports.** Three messages under one name: `busImport` on an `ImportSpecifier`, `direct` on a
`CallExpression`, `actor` on a `CallExpression`.

**How it detects.** Visits `ImportDeclaration`: acts only when `node.source.value` is **exactly**
`@nestjs/cqrs`, then for each `ImportSpecifier` reads `specifier.imported.name ||
specifier.imported.value` and reports `busImport` when it is `CommandBus`, `QueryBus` or `EventBus`.
Visits `CallExpression`: requires `callee.type === "MemberExpression"` and `callee.computed === false`;
reports `direct` when `callee.property.name` is `execute` or `process`, and returns. Otherwise unwraps
`callee.object` through `TSAsExpression`, `TSTypeAssertion` and `ChainExpression`, and reports `actor`
when what is left is an `Identifier` matching `/(?:Worker|Handler)$/`.

**What it cannot see.** A receiver that is not a bare identifier: `app.get(OrderWorker).handle()`,
`workers.order.handle()` and `this.orderWorker.handle()` present a `CallExpression`,
`MemberExpression` or `ThisExpression`, and only an `Identifier` is tested. A receiver named anything
else — the test is a case-sensitive **suffix**, so `const worker`, `const consumer`, `const projector`
hold exactly the object the law forbids calling and pass. Any internal method except the two
hard-coded names: the law names `finalize` explicitly, and `finalize`, `handle`, `run`, `consume`,
`perform`, `flush` and `onModuleInit` are caught **only** by the receiver-name branch. A computed
member call — `worker["process"]()` returns at the `callee.computed` guard before either branch runs,
so the loudest violation in the lane is erased by two brackets. And any dispatcher acquired without a
named import: `import * as cqrs from "@nestjs/cqrs"`, a default import, `require("@nestjs/cqrs")`,
`export { CommandBus } from "@nestjs/cqrs"`, a subpath such as `@nestjs/cqrs/dist/index`, a local
barrel re-exporting the same names, or a container lookup by string token.

**Boundary.** The `execute`/`process` branch never looks at the receiver. It reports
`client.execute()`, `builder.execute()`, `stream.process()` and every other member call spelled that
way, whatever the object is. The ordinary persistence read is `createQueryBuilder(…).…execute()`, so
writing the state read that `e2e-asserts-persisted-state` demands, in the shape the persistence
library offers, trips this rule. Two rules pull in opposite directions on the same line, and a report
where nothing was bypassed is what trains authors to reach for the disable comment that also kills the
other two branches.

## `e2e-asserts-persisted-state` — E2E-4

**What it reports.** `state`, once per file, at the `Program` node.

**How it detects.** Visits **every** `Identifier` and tests `node.name` against
`/^(?:entityManager|dataSource|EntityManager|DataSource|getRepository|queryRunner)$/`, setting a
file-scoped boolean. On `"Program:exit"`, reports `state` at the `Program` node when the boolean is
still false.

**What it cannot see.** The rule checks a **mention**, not an assertion. The flag is set by any
`Identifier` bearing one of the six names anywhere: an unused import, a type annotation, a parameter,
a variable declared and never read. One line naming `DataSource` at the top of a spec that afterwards
asserts nothing but a response envelope — the exact defect `E2E-4` exists for — satisfies the rule
permanently, and somebody tidying imports could delete it and turn a passing file red without touching
a test. It also cannot see the seeding path: the identifier that satisfies the rule is very often the
one that wrote the fixture in `beforeAll`, which is a read of nothing, because the rule never looks at
where the identifier sits.

**Boundary.** In the other direction it over-reports. A state read through the shared harness —
`world.db.isEnrolled(…)`, `repo.findOne(…)`, `prisma.order.findFirst(…)`,
`mongo.collection(…).findOne(…)` — is a genuine persisted read written the way the law recommends, and
every one of them reports unless a spelled-out identifier from the list of six also appears somewhere
in the file. Every store that is not the relational one has no name in the list, so a flow that reads
a document store, a cache, an object store or a broker's own state correctly is reported, while a flow
that reads nothing but adds the word `queryRunner` is not.

## `no-model-call-in-e2e` — E2E-12

**What it reports.** `provider`, on an `ImportDeclaration`.

**How it detects.** Visits `ImportDeclaration`; requires `node.source.value` to be a string, then tests
it against `/^(?:@anthropic-ai\/|openai$|openai\/|ollama$|@google\/generative-ai|@mistralai\/|cohere-ai)/`.
Three alternatives are anchored prefixes with a trailing slash, two are exact (`openai`, `ollama`), and
two — `@google/generative-ai`, `cohere-ai` — are open-ended prefixes.

**What it cannot see.** It detects an import, not a call. Any import that is not an
`ImportDeclaration` — `require("openai")`, `await import("openai")`, `export * from "openai"` — passes.
Any provider outside six patterns: cloud-hosted variants under a platform scope, aggregator gateways,
self-hosted runtimes, the successor package names vendors publish after a rename, and near-miss names
such as `openai-edge`, which fails both the exact and the slash-prefix alternative. A list is a thing
that must be fed. The two largest holes have nothing to do with the list. **Reaching the provider
without an SDK**: `fetch("https://api.…/v1/chat/completions", …)`, or the same call through the
repository's HTTP client, imports nothing the rule looks at while doing precisely what the rule is
named against. And **leaving the real client wired**: the flow scripts nothing, the application's own
policy resolves its configured provider, and a live paid nondeterministic call happens inside a green
run.

**Boundary.** `import type { … } from "openai"` reports although nothing ships. The over-report is the
price of a pure syntax test, and it lands on the author who is doing the right thing — typing a
scripted result.

## `no-sleep-in-flow` — E2E-3

**What it reports.** `sleep`, on a `CallExpression`; `timer`, on a `NewExpression`.

**How it detects.** Visits `CallExpression`: requires `callee.type === "Identifier"` and `callee.name`
in the set `{sleep, delay, wait, pause, setTimeout}`. Walks `node.parent` upward; if any ancestor is a
`NewExpression` whose `callee.name` is `Promise`, it returns without reporting, so the promise branch
owns that case. Otherwise reports `sleep`. Visits `NewExpression`: requires `node.callee.name ===
"Promise"`, then takes the node's **raw source text** through `context.sourceCode.getText(node)` and
reports `timer` when that text matches `/setTimeout/`.

**What it cannot see.** A member-expression sleep: `timers.setTimeout(500)`, `world.sleep(500)` and
`clock.wait(500)` are not bare identifiers — and the modern promise-based timer is normally written
exactly that way, so the most current spelling of the banned habit is the one that passes. A rename:
`import { sleep as settle } from "./util"`, or `const nap = sleep`, moves the callee outside a
five-name set. Any other way to burn time: `setImmediate`, `process.nextTick`,
`promisify(setTimeout)(500)` — where the callee is a call expression and the timer identifier is only
an argument — a `while` loop on `Date.now()`, or a fixed-count retry loop with no wait at all. And
above all **a poll with no deadline**: the second half of the code this rule holds is unenforced, so
the recommended replacement written badly — loop until the state arrives, forever — passes cleanly and
fails as a runner timeout that names no state.

**Boundary.** The promise branch matches raw text, so a `new Promise(…)` whose body merely *mentions*
`setTimeout` in a comment, or names a variable `setTimeoutMs`, reports although it never sleeps.

## `no-branch-in-flow-step` — E2E-7

**What it reports.** `branch`, on an `IfStatement`, `ConditionalExpression`, `SwitchStatement` or
`LogicalExpression`.

**How it detects.** Visits `IfStatement`, `ConditionalExpression`, `SwitchStatement`, and
`LogicalExpression` — the last only when `node.parent.type === "ExpressionStatement"`. Each candidate
passes through `insideStep`, which walks `node.parent` upward and returns true at the first
`CallExpression` ancestor whose `callee.name` — or, failing that, whose `callee.object.name` — is `it`
or `test`.

**What it cannot see.** A branch in a helper: `insideStep` is a lexical ancestor walk, so a condition
inside a function the step calls is outside every rule here, even when that function is declared in
the same file. A branch in `beforeAll`, `beforeEach`, `afterEach` or the `describe` body — the rule's
twin test declares this valid on purpose, because outside a step a conditional reads as set-up, but
conditional set-up is also how a flow most often ends up asserting different things on different runs.
Branching that is not one of the four node types: `try`/`catch`, `.catch(() => …)`,
`Promise.allSettled`, optional chaining on the value under assertion, and `??` used as an initializer
— the nullish operator is a `LogicalExpression`, but only the statement position is reported, so
`const found = a ?? b` passes. A logical operator in expression position: `expect(a || b).toBe(true)`
is a test prepared for either outcome and the rule deliberately stands down there. An assertion loose
enough to pass down either path without any operator at all — a matcher on a subset, a matcher on any
value, an assertion on `length` rather than on content. And a step declared under a name the walk does
not know, such as the `specify` alias.

**Boundary.** "Step" is lexical and in this file only. Moving the same `if` into a helper function
declared ten lines above deletes the rule with no diff to it.

## Detection

| Part | Mechanism |
|---|---|
| file gate, all five | `isE2eSpec(context.filename \|\| context.getFilename())`: the filename is coerced with `String(… \|\| "")`, back-slashes are replaced by forward slashes, and the result is tested against `/\.e2e-spec\.ts$/`. A file that fails this test never has a visitor installed — the rule object returns `{}`. |
| separator normalisation | Back-slashes become forward slashes before the suffix test. The suffix carries no slash, so the normalisation is inert here rather than load-bearing. |
| import source test | `node.source.value` — an **exact** string match for the transport rule, a prefix regex for the provider rule. |
| imported name | `specifier.imported.name \|\| specifier.imported.value`, so the string-literal import form is covered and the local name is never read. |
| receiver unwrap | `callee.object` is unwrapped through `TSAsExpression`, `TSTypeAssertion` and `ChainExpression` before the `/(?:Worker\|Handler)$/` test. |
| identifier sweep | Every `Identifier` in the file is tested against `/^(?:entityManager\|dataSource\|EntityManager\|DataSource\|getRepository\|queryRunner)$/`, setting one file-scoped boolean read at `"Program:exit"`. |
| raw source text | `context.sourceCode.getText(node)` on `new Promise`, matched against `/setTimeout/` — text, not a call node. |
| lexical ancestry | The `parent` chain, used twice: `insideStep` for step containment, and the promise-wrapped-sleep stand-down. |
| what reaches outside the file | Nothing. Detection is purely syntactic: no module is resolved, no type is consulted, no test is run. |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `import { CommandBus as Bus } from "@nestjs/cqrs"` | The **imported** name is read, never the local one, so renaming at the import changes nothing. |
| `import { "QueryBus" as Bus } from "@nestjs/cqrs"` | The string-literal import form is covered by the `imported.value` fallback. |
| `(orderWorker as OrderWorker).run()` | The receiver is unwrapped through `TSAsExpression` and `TSTypeAssertion` before the name test, so a cast does not hide it. |
| `orderWorker?.run()` | `ChainExpression` is unwrapped for the same reason. |
| `await new Promise((resolve) => setTimeout(resolve, 500))` | Reported once, as `timer`. The call branch walks its ancestors and stands down, deliberately, so one sleep does not produce two findings. |
| `new Promise((resolve) => globalThis.setTimeout(resolve, 500))` | The promise branch matches raw source **text**, not a call node, so qualifying the timer does not hide it. |
| `it.each([…])("step", …)` with a branch inside | `insideStep` falls back to `callee.object.name`, so `it.each`, `it.only`, `it.skip`, `test.each` and `it.concurrent` are all still steps. |
| `import Chat from "openai/resources/chat"` | The provider test is a prefix, and `openai/` is one of its alternatives. |
| `import { Anthropic } from "@anthropic-ai/sdk"` and every other subpath of a scoped provider | Three of the six provider alternatives are scope prefixes ending in a slash, so any package under those scopes matches. |
| A path written with back-slashes | The filename is normalised to forward slashes before the suffix test. |
| A `describe` body containing `it` blocks with branches | `insideStep` stops at the **first** matching ancestor and does not require the step to be the immediate parent, so nesting depth inside the callback is irrelevant. |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| all five | **The filename.** Everything here exists only for files ending `.e2e-spec.ts`. A suite whose flow files are named `*.spec.ts`, `*.e2e.spec.ts`, `*.e2e-spec.mts` or anything else receives none of these five rules, and no diff to any rule is needed to arrange it. Partly held elsewhere: the rules' own twin test asserts that a named inventory of flow files exists at a fixed path with this suffix, so renaming a **listed** flow goes red — but that gate is a test, not a rule, and a flow it does not name is outside it. |
| all five | **A helper file.** Every gate is per-file. Move the bus call, the sleep, the branch or the provider import one directory over into `world.ts` or `flow-helpers.ts`, import it from the spec, and all five rules stop existing for that code. This is not sabotage — it is what the law's own `E2E-8` ("one place stands the world up") tells an author to do. |
| `e2e-uses-production-transport` | **A receiver that is not a bare identifier**, **a receiver named anything else**, **any internal method except `execute` and `process`**, **a computed member call**, and **any dispatcher acquired without a named import**. |
| `e2e-uses-production-transport` | The mirror-image defect: `builder.execute()` on a query builder, `stream.process()` on a parser, and every unrelated method spelled `execute` or `process` are reported although nothing was bypassed. |
| `e2e-asserts-persisted-state` | **An unused import launders the whole file**, **a state read through the shared harness**, **every store that is not the relational one**, and **the seeding path**, which the rule cannot distinguish from an assertion because it never looks at where the identifier sits. |
| `no-model-call-in-e2e` | **Any import that is not an `ImportDeclaration`**, **any provider outside six patterns**, **reaching the provider without an SDK**, and **leaving the real client wired** — the most expensive form of this mistake is not an import at all. `import type` reports although nothing ships. |
| `no-sleep-in-flow` | **A member-expression sleep**, **a rename**, **any other way to burn time**, and **a poll with no deadline**. The promise branch's text match reports a `new Promise` that only mentions `setTimeout`. |
| `no-branch-in-flow-step` | **A branch in a helper**, **a branch in `beforeAll`/`beforeEach`/`afterEach`/`describe`**, **branching that is not one of the four node types**, **a logical operator in expression position**, **an assertion loose enough to pass down either path**, and **a step declared under an alias such as `specify`**. |
| none | **Everything the seven `E2E-` codes with no rule forbid**, plus the unheld half of each of the four half-held codes: entering other than through the production gate, asserting a consequence that is not a business consequence, replacing internal policy instead of only the outside result, and polling without a deadline. |

That last row is the honest summary: of twelve codes, five are held, four of those five by half, and
the whole shelf is scoped by a filename suffix that anyone can change.

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

## Rules

1. A rule's identity is its published name; nothing here assigns it a number.
2. Detection is purely syntactic. No module is resolved, no type is consulted, no test is run.
3. A file is in scope only when its name ends `.e2e-spec.ts`. There is no second gate and no
   configuration option: the scope of this shelf is a filename suffix.
4. Every rule holds at most one half of its law code, and the module says so in its own header rather
   than presenting the coverage as complete.
5. Two rules here can disagree about the same line, and the disagreement is real rather than a
   configuration mistake.
6. The module's own severity opinion is `error` for all five; the consuming configuration remains the
   authority on what is actually switched on.

## Exceptions

There is no per-file exemption list, no allow-list and no exempt directory in this module. That is
worth stating plainly, because it means every escape is a matter of **shape** rather than of
permission, and shape is the thing an author changes without noticing.

The three exemptions that do exist are internal to a rule, and each is named with what it releases:

- **A sleep inside `new Promise` is skipped by the call branch**, releasing the `sleep` message on that
  call so the line is reported once as `timer`. Two findings on one line teach nobody which to fix.
- **A logical operator is only reported in statement position**, releasing every logical operator
  inside an expression. This buys quiet at the cost of the `expect(a || b)` assertion.
- **A computed member call is dropped before either transport branch**, releasing both `direct` and
  `actor` on `worker["process"]()`. This is not argued anywhere and reads as an oversight rather than a
  decision.

## Output

One block per finding:

```text
rule:    <published rule name>
file:    <path as the gate saw it, forward slashes>
node:    <ImportDeclaration | ImportSpecifier | CallExpression | NewExpression | Identifier |
          IfStatement | ConditionalExpression | SwitchStatement | LogicalExpression | Program>
message: <busImport | direct | actor | state | provider | sleep | timer | branch>
```

A clean file in scope emits one block with `message: none` and the file gate that admitted it. A file
out of scope emits one block with `message: none` and the note that `isE2eSpec` failed, so no visitor
was installed — that is not a pass.

## Worked example

**Input.** `test/order-checkout.e2e-spec.ts`:

```ts
import { CommandBus } from "@nestjs/cqrs"
import OpenAI from "openai"

describe("checkout", () => {
  it("charges the order", async () => {
    await commandBus.execute(new PlaceOrder(orderId))
    await new Promise((resolve) => setTimeout(resolve, 500))
    if (response.body.paid) {
      expect(response.status).toBe(201)
    }
  })
})
```

The filename ends `.e2e-spec.ts`, so all five rules have visitors. Six findings:

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    ImportSpecifier
message: busImport
```

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: direct
```

```text
rule:    no-model-call-in-e2e
file:    test/order-checkout.e2e-spec.ts
node:    ImportDeclaration
message: provider
```

```text
rule:    no-sleep-in-flow
file:    test/order-checkout.e2e-spec.ts
node:    NewExpression
message: timer
```

The `setTimeout` call inside the promise is not reported a second time: the call branch walks its
ancestors, finds the `Promise` `NewExpression` and stands down.

```text
rule:    no-branch-in-flow-step
file:    test/order-checkout.e2e-spec.ts
node:    IfStatement
message: branch
```

```text
rule:    e2e-asserts-persisted-state
file:    test/order-checkout.e2e-spec.ts
node:    Program
message: state
```

**Repaired.** The flow enters over HTTP, waits on a condition instead of a clock, asserts one path, and
names the persistence type:

```ts
import type { DataSource } from "typeorm"
import request from "supertest"

describe("checkout", () => {
  it("charges the order", async () => {
    const response = await request(app.getHttpServer()).post("/orders").send(payload)
    await world.waitFor(() => world.db.isPaid(response.body.id))
    expect(response.status).toBe(201)
  })
})
```

All five rules are now silent, and two of those silences are not compliance:

```text
rule:    e2e-asserts-persisted-state
file:    test/order-checkout.e2e-spec.ts
node:    Program
message: none
hatch:   the unused type-only mention of DataSource sets the file-scoped flag permanently; the actual
         state read, world.db.isPaid(…), matches none of the six names and would not have set it
```

```text
rule:    no-sleep-in-flow
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: none
hatch:   world.waitFor is a member call, not a bare identifier, and its poll carries no deadline — the
         poll-with-a-deadline half of E2E-3 has no rule, and whatever the helper file does is per-file
         out of reach anyway
```

And the repair that reads state in the shape the persistence library offers goes the other way: writing
`await dataSource.createQueryBuilder(…).…execute()` inside the step satisfies
`e2e-asserts-persisted-state` and immediately trips the transport rule.

```text
rule:    e2e-uses-production-transport
file:    test/order-checkout.e2e-spec.ts
node:    CallExpression
message: direct
```

Nothing was bypassed on that line. The two rules disagree, and the disagreement is real.

## Scope

This module documents the five rules published by the flow law's rule module, shipped in
`@starci/eslint-canon-be`. It documents no rule that ought to exist: a rule that cannot be pointed at
is a proposal, and this module records verdicts, not proposals.

It does not judge the law's twelve codes — the law owns those, and seven of them have no machine
anywhere. It does not judge what the shared harness does, because the harness lives in another file
and every gate here is per-file. It does not judge which severity a repository runs: the module's
opinion is `error` for all five, and the consuming configuration decides what is actually switched on.
