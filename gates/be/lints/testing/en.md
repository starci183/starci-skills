---
title: Testing
---

# Testing

## LOADS

None.


## Record

The input is code that is already written — one spec file, one hunk of a diff. The output is a
**verdict**: which lane the file fell into, which published rule fired, what it reported and on which
node, which law code that maps to, and the open hatch that would have hidden the same failure. This
module chooses nothing about how a test should be designed. It refuses a shape, and it must be able to
point at the name or the node it refuses on.

## Law

The law is `patterns/testing.md`. It carries eleven codes, `TESTING-1` through `TESTING-11`.

**Most of that law is not machine-checkable, and the rule source says so in its own first paragraph.**
No rule can tell whether a file represents a business flow, whether an unhappy path drags a critical
flow behind it, whether the decision branches are covered, or whether a stub returns a payload a parser
would accept. Those are read by a person.

The law states eleven codes. **Five of them have a rule.** This module documents the other half only
where a shape is wrong on its face regardless of intent: what a rule inspects in order to see it, and —
the part nobody writes down — what it does not see. Six law codes have no rule at all, and that gap is
recorded here rather than papered over.

## Published rules

The testing rules below are published. Each maps to exactly one law code; none is orphaned.

| Rule | Code | What it reports |
|---|---|---|
| `no-call-only-spec` | `TESTING-6` | A unit spec in which every assertion is a call matcher, so the file restates the handler's own source instead of testing it. Message names the matchers found. |
| `unit-test-colocated` | `TESTING-7` | A unit uses `.test.ts` or sits in a separate unit bucket instead of a colocated `.spec.ts` beside its owner. |
| `e2e-asserts-persisted-state` | `TESTING-2` | An end-to-end spec in which no state-reading name appears anywhere, so the flow can stop persisting and the file stays green. |
| `no-model-call-in-e2e` | `TESTING-9` | An end-to-end spec importing a model provider package, or a house model helper. Message names the import source. |
| `e2e-uses-production-transport` | `TESTING-3` | Two things: importing an application dispatcher from the framework's CQRS package, and any non-computed `.execute()` or `.process()` call. |
| `harness-calls-provider-directly` | `TESTING-10` | Four things in a model-quality harness: no approved provider SDK import at all, a symbol or provider override that impersonates the production gateway, a house helper hiding the call, and a consumer or CLI credential string. |

`TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-8` and `TESTING-11` have documented portions no rule can
fully certify. `TESTING-7` is now held for unit suffix and bucket placement by `unit-test-colocated`.

The identity of a rule is its published name. The plugin exposes them under the `starci-be/` prefix,
which is the string a build log prints and the string a disable comment must spell. All five ship at
`error`. Two carry a burn-down note in the source: the call-only rule went to zero from one finding,
and the persisted-state rule from one finding.

## Reading a diff

1. **Decide the lane before anything else, and record it.** Lane comes from `context.filename` only.
   Out of scope does not mean the file passed — it means no visitor was installed and the rule did not
   exist for that file.
2. **Check the exemptions the lane grants.** In a harness helper only the consumer-credential check
   runs; every other branch of `harness-calls-provider-directly` is gated on the harness lane. The
   integration lane has no rule watching it at all.
3. **Read the nodes each rule actually visits**, not the file's intent: `expect` call chains, every
   `Identifier`, `ImportDeclaration` source strings and specifiers, string `Literal`s, `provide`
   properties, and — once — the raw token stream.
4. **Emit one block per finding.** Two rules speak only at `Program:exit`, so their verdict is about
   the whole file and a single added line changes it.
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure.** A silent rule
   is not evidence the file is correct; it is evidence the file did not present the one shape the rule
   can see.
6. **Do not report what no rule watches.** Six of the eleven codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `no-call-only-spec` — TESTING-6

**What it reports.** A unit spec whose total assertion count equals its call-assertion count and is
non-zero, so the whole file says nothing about a returned value or a changed state. The message names
the matchers found.

**How it detects.** Unit lane only: `context.filename` matches `/\.spec\.ts$/` and does **not** match
`/\.(?:e2e|int|harness)-spec\.ts$/`. It visits `CallExpression` whose `callee.type === "Identifier"`
and `callee.name === "expect"`, climbs the `MemberExpression` chain upward while the node is the
`object` of its parent, and takes the LAST property name as the matcher — so `.not` and `.resolves`
pass through, and `expect(x).not.toHaveBeenCalled()` answers `toHaveBeenCalled`. It increments a
file-wide assertion counter, and a second counter when the matcher is in a nine-name set. At
`Program:exit` it reports only when the counters are equal and non-zero.

**What it cannot see.** One alibi assertion disarms the whole file: thirty call-only cases plus a
single `expect(result).toBeDefined()` anywhere report nothing, because the counters are file-wide and
the rule has no notion of a test case. A matcher name that was never invoked still counts —
`expect(result).toEqual` with the parentheses forgotten asserts nothing at runtime and silences the
file. A call assertion spelled a way the set does not list — `toHaveBeenCalledOnce`,
`toHaveBeenCalledExactlyOnceWith`, `toHaveReturnedWith`, `toHaveReturnedTimes` — leaks twice: it is not
counted as a call assertion, and it makes the counters differ, which spares every real call assertion
in the file. The same test rewritten as a value assertion,
`expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })`, restates the source exactly as before, but
the matcher is `toEqual`: the rule watches the matcher, not the subject. An assertion moved into a
helper, or `expect.soft(spy)`, is skipped because the callee must be a bare `Identifier` named
`expect` — and a file with zero recognised assertions is explicitly not reported. Finally `.test.ts`,
`.spec.tsx`, `.spec.mts` and the whole integration lane fall outside the gate.

**Boundary.** This rule judges assertion vocabulary inside one unit spec. It says nothing about what
the flow lane asserts, which is `TESTING-2`.

## `e2e-asserts-persisted-state` — TESTING-2

**What it reports.** An end-to-end spec in which no name from the state-reading group appears anywhere
in the file, so the test asserts only on the response and the flow can stop writing data while staying
green.

**How it detects.** Flow lane only: `context.filename` matches `/\.e2e-spec\.ts$/`. It visits every
`Identifier` node and tests its `name` against one anchored alternation of six names — the entity
manager, the data source, both of their type-cased spellings, a repository getter and a query runner.
Seeing one sets a flag. At `Program:exit` it reports when the flag was never set.

**What it cannot see.** The import satisfies the rule: `import { DataSource } from "typeorm"` at the
top of a flow that asserts nothing but response status marks the file as reading state, because an
import specifier is an `Identifier` — so is a type annotation, a dependency-injection token and a
teardown line closing the connection. A read that is never asserted passes:
`const rows = await entityManager.find(Order)` with no `expect` on `rows`, because the rule sets a
boolean when a name appears and never traces the value to an assertion. A property name spelled the
same way passes: `config.dataSource`, `options.queryRunner`, since a non-computed member property is an
`Identifier` and position is not considered. And an honest read the list does not know — a repository
named `repo`, an entity manager named `em`, a second query issued through the transport, a cache
client, any datastore the six names do not describe — fires a FALSE positive, whose cheapest remedy is
renaming a variable rather than adding an assertion. Vocabulary is what is measured.

**Boundary.** This rule asks only whether a state-reading name exists in the file. Whether the flow
entered through the production transport is `TESTING-3`.

## `no-model-call-in-e2e` — TESTING-9

**What it reports.** An end-to-end spec importing a model provider package, or a house model helper
that exists to reach one. The message names the import source.

**How it detects.** Flow lane only. It visits `ImportDeclaration` and tests the literal `source.value`
string against two regular expressions: a list of provider package prefixes, and a suffix pattern for a
house model helper deliberately left unanchored so a relative `../helpers/models.service` is seen.

**What it cannot see.** Anything that is not a static import: `await import("openai")`,
`require("openai")`, or a plain `fetch` to the provider's HTTPS endpoint — only `ImportDeclaration` is
visited, a dynamic import is a different node type and a network call is not an import at all. The
provider that is not on the list, including the newer first-party client from the same vendor whose
older client IS listed, plus every gateway, aggregator and inference host not enumerated; the sibling
rule on this shelf accepts a package that this rule does not ban, so the two hand-maintained lists
disagree inside one file. Reaching a model without importing anything — the flow resolves the
production gateway from the application container and nobody remembered the stub — is exactly the
failure the law calls out, and no rule watches for it: the rule proves an import is absent, which is
not the same as proving no call is made. And the helper renamed or moved one level,
`helpers/model.service`, `helpers/llm-client`, `helpers/models/index`, escapes a suffix pattern that
requires the path to END in the one word.

**Boundary.** This rule judges import sources in the flow lane. What a model-quality harness may import
is the opposite obligation, and belongs to `TESTING-10`.

## `e2e-uses-production-transport` — TESTING-3

**What it reports.** Two independent shapes: importing an application dispatcher — command bus, query
bus, event bus — from the framework's CQRS package, and any non-computed `.execute()` or `.process()`
call.

**How it detects.** Flow lane only, with two independent visitors. `ImportDeclaration` requires
`source.value` to equal one exact package string, then checks each `ImportSpecifier`'s `imported` name
against a three-name set — the package-side name, not the local alias. `CallExpression` requires a
non-computed `MemberExpression` callee and checks the property name against a two-name set, with no
check of what the object is.

**What it cannot see.** A computed member call, `bus["execute"](command)` or `bus[method](command)`,
because the callee check bails out when `computed` is true. Every other way into the application:
`eventBus.publish(event)`, `handler.handle(command)`, `resolver.findThing(args)`, `service.enroll(...)`,
`worker.run()` — publishing an event straight onto the bus enters exactly where the law forbids and is
not reported, because the method set holds two names. The dispatcher imported from anywhere else: a
project barrel that re-exports it, a deep path into the package's build output, or
`import * as cqrs from "@nestjs/cqrs"` followed by `cqrs.CommandBus`, since the import check is string
EQUALITY on one package specifier and a namespace specifier is not an `ImportSpecifier`. And false
positives on the same two words — a database driver's `connection.execute(sql)` used to read state
back, a queue's `queue.process(handler)` registered in setup, a test client's `execute` — because the
object is never inspected, only the property name. This is the rule whose behaviour sits furthest from
its own name: the name says transport, the second half is a method-name comparison with no type
knowledge.

**Boundary.** This rule watches entry into the application. Whether the flow then asserts on persisted
state is `TESTING-2`.

## `harness-calls-provider-directly` — TESTING-10

**What it reports.** Four shapes in a model-quality harness: no approved provider SDK import at all; a
symbol or provider override that impersonates the production gateway — importing the gateway class,
declaring `provide` with it, overriding the provider with it, or building a `Pick<...>` type from it; a
house helper with a banned name hiding the call; and a consumer or CLI credential string used in place
of a server API key.

**How it detects.** Its scope is wider than the others: the harness lane, `context.filename` matching
`/\.harness-spec\.ts$/`, **or** a helper file whose path contains `/src/tests/helpers/` — but in a
helper file only the credential check runs, because the other three branches are gated on the harness
lane. Four visitors plus a token scan. `ImportDeclaration` sets a flag on an approved provider prefix,
reports on a helper path suffix after stripping a `.ts`/`.js` extension, and reports on an imported or
local specifier name in a three-name set. `Literal` reports on any string value matching a
case-insensitive consumer-credential alternation. `Property` reports when a key named `provide` has an
`Identifier` value of the gateway class. `CallExpression` reports when a property named
`overrideProvider` receives that class as its first argument. At `Program:exit` it walks the raw token
stream from `sourceCode.getTokens(sourceCode.ast)` looking for the three-token sequence `Pick` `<`
`AiInvokeService`, then reports if the provider flag was never set.

**What it cannot see.** An unused import satisfies the provider requirement: `import "openai"` at the
top, then the whole harness runs through a locally named house client — the flag is set by presence,
and whether the SDK is ever called is not checked. The credential read in its ordinary form is
invisible: `process.env.CLAUDE_CODE_OAUTH_TOKEN` is a member property, only the bracket form
`process.env["CLAUDE_CODE_OAUTH_TOKEN"]` is a string literal, and a template literal is invisible for
the same reason, its chunks being `TemplateElement`s. The gateway wearing a different type or token
passes: `Partial<AiInvokeService>`, `Omit<AiInvokeService, "x">`, a hand-written
`interface FakeInvoke { run(...) }`, `provide: AI_INVOKE_TOKEN`, `overrideProvider(AI_INVOKE_TOKEN)`,
or a default import of the gateway module under a local name — the token scan looks for one exact
three-token sequence and the other checks compare against one literal class name. A helper renamed out
of the ban, the house model helper moved to `./judge-client`, leaves the same code legal because the
helper pattern lists two names. And a helper outside the one folder is out of scope entirely: only
`/src/tests/helpers/` is in credential scope, so `test/helpers/`, `test/helpers/` and any nested
`helpers/` under another root run no check at all, credential check included.

**Boundary.** This rule demands a real provider call in the harness lane. The flow lane demands the
opposite, and that is `TESTING-9`.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | Lane selection is a regular expression over the filename with backslashes rewritten to forward slashes, so a Windows path compares like any other path |
| lane gate: unit | `context.filename` matches `/\.spec\.ts$/` and does **not** match `/\.(?:e2e\|int\|harness)-spec\.ts$/` |
| lane gate: flow | `context.filename` matches `/\.e2e-spec\.ts$/` |
| lane gate: harness | `context.filename` matches `/\.harness-spec\.ts$/` |
| lane gate: harness helper | `context.filename` contains `/src/tests/helpers/` |
| the matcher climb | Climb the `MemberExpression` chain upward while the node is the `object` of its parent; the LAST property name is the matcher, so modifiers pass through |
| the name comparison | No rule is type-aware. No rule asks what an object is, only what a name is spelled |
| the token scan | `sourceCode.getTokens(sourceCode.ast)`, used once, to find a generic type argument without type information |
| file-end reporting | Two rules read a whole file and report once at `Program:exit`, so a single line anywhere in the file can change the verdict for every other line |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Rule | The attempt | Why it still fires |
|---|---|---|
| `no-call-only-spec` | `expect(spy).not.toHaveBeenCalled()` — a negated call assertion looks like a different matcher | The climb takes the LAST property in the chain, so `.not` is passed through and the answer is still the call matcher |
| `no-call-only-spec` | `await expect(promise).resolves.toBe(1)` — a modifier chain looks unparseable | Same climb; the answer is the real matcher, and the file is correctly spared |
| `no-call-only-spec` | Moving the file into a subfolder, or beside the code it exercises | The lane gate reads the filename suffix, never the directory |
| `e2e-asserts-persisted-state` | Reading state through the query runner instead of the entity manager | Both names are in the alternation, along with the data source and the repository getter |
| `no-model-call-in-e2e` | `import { models } from "../helpers/models.service"` — a relative path an absolute-path pattern would miss | The helper pattern is deliberately unanchored and matches the suffix, which is the form an end-to-end file beside the helper folder actually writes |
| `no-model-call-in-e2e` | `import OpenAI from "openai/index"` — a deep import | The provider pattern accepts both the bare package and the package followed by a slash |
| `e2e-uses-production-transport` | `const bus = app.get(CommandBus)` with no direct construction | The call check is method-name-based, so `bus.execute(...)` reports whatever the object is or where it came from |
| `e2e-uses-production-transport` | `import { CommandBus as Bus } from "@nestjs/cqrs"` — renaming on import | The specifier check reads `imported`, the name on the package side, not the local alias |
| `harness-calls-provider-directly` | `import { AiInvokeService as Gateway }` — renaming the gateway on import | The check accepts `imported` first, so the package-side name is what is tested |
| `harness-calls-provider-directly` | `Pick<AiInvokeService, "run">` as a hand-rolled stand-in type, which no ordinary AST visitor for the plugin's parser would reach | A raw token scan at `Program:exit` looks for the literal three-token sequence, so the type is caught without type information |
| `harness-calls-provider-directly` | Declaring the gateway in a test module: `{ provide: AiInvokeService, useValue: fake }` | The `Property` visitor reports on the key/value pair directly |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Rule | What slips through | What it costs |
|---|---|---|
| all five | **Renaming the file.** Lane membership is a filename suffix, so a rename is the cheapest way to make a rule stop existing for a file | Every check on this shelf, silently |
| `no-call-only-spec` | **One alibi assertion disarms the whole file.** Thirty call-only cases plus a single `expect(result).toBeDefined()` anywhere report nothing | The counters are file-wide; the rule has no notion of a test case |
| `no-call-only-spec` | **A matcher name that was never invoked still counts.** `expect(result).toEqual` — parentheses forgotten — asserts nothing at runtime and silences the file | Whether the chain ends in a call is never checked |
| `no-call-only-spec` | **A call assertion the set does not list.** `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveReturnedWith`, `toHaveReturnedTimes` | It leaks twice: uncounted as a call assertion, and it makes the counters differ, sparing every real call assertion in the file |
| `no-call-only-spec` | **The same test rewritten as a value assertion.** `expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })` | The rule watches the matcher, not the subject |
| `no-call-only-spec` | **The assertion moved into a helper, or `expect` aliased.** `assertCharged(spy)`, `expect.soft(spy).toHaveBeenCalled()` | A member callee is skipped, and a file with zero recognised assertions is explicitly not reported |
| `no-call-only-spec` | **`.test.ts`, `.spec.tsx`, `.spec.mts`, and the whole integration lane** | The gate requires the exact `.spec.ts` ending and excludes three suffixes outright |
| `e2e-asserts-persisted-state` | **The import satisfies the rule.** `import { DataSource } from "typeorm"` above a flow that asserts only status | An import specifier, a type annotation, an injection token and a teardown line are all `Identifier`s |
| `e2e-asserts-persisted-state` | **A read that is never asserted.** `const rows = await entityManager.find(Order)` with no `expect` on `rows` | The rule sets a boolean on a name; it never traces the value to an assertion |
| `e2e-asserts-persisted-state` | **A property name spelled the same way.** `config.dataSource`, `options.queryRunner` | A non-computed member property is an `Identifier` and position is not considered |
| `e2e-asserts-persisted-state` | **An honest read the list does not know.** A repository named `repo`, a manager named `em`, a second query through the transport, a cache client | A FALSE positive whose cheapest remedy is renaming a variable rather than adding an assertion |
| `no-model-call-in-e2e` | **Anything that is not a static import.** `await import("openai")`, `require("openai")`, a plain `fetch` to the provider endpoint | Only `ImportDeclaration` is visited |
| `no-model-call-in-e2e` | **The provider that is not on the list**, including a newer first-party client from a vendor whose older client IS listed | Both lists are hand-maintained prefixes, and the harness rule accepts a package this rule does not ban |
| `no-model-call-in-e2e` | **Reaching a model without importing anything.** The flow resolves the production gateway from the container and nobody remembered the stub | The exact failure the law calls out, and no rule watches for it |
| `no-model-call-in-e2e` | **The helper renamed or moved one level.** `helpers/model.service`, `helpers/llm-client`, `helpers/models/index` | The suffix pattern requires the path to END in the one word |
| `e2e-uses-production-transport` | **A computed member call.** `bus["execute"](command)`, `bus[method](command)` | The callee check bails out when `computed` is true |
| `e2e-uses-production-transport` | **Every other way into the application.** `eventBus.publish(event)`, `handler.handle(command)`, `resolver.findThing(args)`, `service.enroll(...)`, `worker.run()` | The method set holds two names |
| `e2e-uses-production-transport` | **The dispatcher imported from anywhere else.** A project barrel, a deep build-output path, `import * as cqrs from "@nestjs/cqrs"` | String EQUALITY on one package specifier, and a namespace specifier is not an `ImportSpecifier` |
| `e2e-uses-production-transport` | **False positives on the same two words.** `connection.execute(sql)`, `queue.process(handler)`, a test client's `execute` | The object is never inspected, so satisfying the rule can mean renaming a legitimate call |
| `harness-calls-provider-directly` | **An unused import satisfies the provider requirement.** `import "openai"`, then a locally named house client does the work | The flag is set by presence; whether the SDK is called is not checked |
| `harness-calls-provider-directly` | **The credential read in its ordinary form.** `process.env.CLAUDE_CODE_OAUTH_TOKEN`, or a template literal | Only a string `Literal` is visited; a member property is an identifier and a template chunk is a `TemplateElement` |
| `harness-calls-provider-directly` | **The gateway wearing a different type or token.** `Partial<AiInvokeService>`, `Omit<AiInvokeService, "x">`, a hand-written interface, `provide: AI_INVOKE_TOKEN`, `overrideProvider(AI_INVOKE_TOKEN)`, a renamed default import | One exact three-token sequence, one literal class name |
| `harness-calls-provider-directly` | **A helper renamed out of the ban.** The house model helper moved to `./judge-client` | The helper pattern lists two names |
| `harness-calls-provider-directly` | **A helper outside the one folder.** `test/helpers/`, `test/helpers/`, any nested `helpers/` under another root | The helper gate is a literal path fragment, and out of scope means every check including the credential check |
| none | **Everything `TESTING-1`, `TESTING-4`, `TESTING-5`, `TESTING-7`, `TESTING-8` and `TESTING-11` require** | Six of eleven codes have no machine; a green run is silence about all of them |

## Inputs

| Input | Evidence required |
|---|---|
| filename | `context.filename`, falling back to `context.getFilename()`, normalised to forward slashes. It decides the lane and therefore whether any visitor runs |
| lane decision | Which lane gate matched, or that none did |
| AST nodes | `CallExpression`, `Identifier`, `ImportDeclaration`, `ImportSpecifier`, `Literal`, `Property`, and `MemberExpression` chains |
| import evidence | The literal `source.value` string, and each specifier's `imported` name |
| token stream | `sourceCode.getTokens(sourceCode.ast)`, used once, to find a generic type argument without type information |
| file-end state | Counters and flags accumulated across the file, reported at `Program:exit` |

Nothing else. No type checker, no cross-file resolution, no test-runner configuration, no coverage
report, no runtime observation.

## Rules

1. A rule's identity is its published name. There is no second numeric identifier, because a rule with
   two names cannot be traced from a build log back to the file that produced it.
2. Lane membership comes from the filename suffix and nothing else, which is the law's own `TESTING-7`.
   A rule that runs in the wrong lane is a bug in the gate, not in the file.
3. A rule reports a SHAPE, never an intent. Every message names the shape and the remedy.
4. A call assertion is legitimate as a second assertion. The call-only rule fires only when a file has
   nothing else, and that carve-out is deliberate rather than an oversight.
5. No rule is type-aware, so every check is a comparison against a spelled name.
6. Two rules read the file whole and speak once at the end. A single added line changes the verdict for
   the entire file.
7. A rule that cannot be pointed at is a proposal. Six law codes have no rule; they are unenforced and
   recorded as such.

## Exceptions

Exceptions are part of the enforcement, not relief from it.

- **The second assertion.** A call assertion beside a result assertion is the intended shape when the
  call itself is the observable effect — a message sent, an event published. This is why
  `no-call-only-spec` counts a file rather than a case, and it releases exactly that pairing and
  nothing more.
- **A flow with no persisted consequence.** `e2e-asserts-persisted-state` expects a disable comment
  naming what the flow observes instead. It releases the one file that names its substitute; a disable
  with no reason is the rule being deleted one file at a time.
- **Credential scope is wider than harness scope.** In a harness helper under `/src/tests/helpers/`,
  only the consumer-credential check runs. Every other check in `harness-calls-provider-directly` is
  gated on the harness lane, so a helper may import and export whatever it likes.
- **The integration lane is unwatched by design.** The law separates four lanes; three rules watch the
  flow lane, one watches the unit lane, one watches the harness lane. No rule watches integration specs
  at all, which releases that entire lane from every check on this shelf.

## Output

A verdict about one file. One block per finding:

```text
file: <path>
lane: <unit | flow | harness | harness helper | out of scope>
rule: <published rule name>
message: <messageId>
law: TESTING-<n>
verdict: <fires | silent>
reason: <the node or name that decided it>
hatch: <none | the open row that explains a silence>
```

A clean file emits one block per rule that ran in its lane, each with `verdict: silent` and a `hatch`
line naming the open row that would have produced the same silence, or `none`. An out-of-scope file
emits one block with `lane: out of scope` and no rule name: no visitor was installed, so the file was
not judged rather than judged clean.

## Worked example

**Input.** A unit spec, `orders/charge.handler.spec.ts`:

```ts
it("charges the order", async () => {
  await handler.execute(command)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
  expect(repository.save).toHaveBeenCalledTimes(1)
})
```

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: no-call-only-spec
message: callOnly
law: TESTING-6
verdict: fires
reason: Program:exit — 2 assertions, 2 call matchers (toHaveBeenCalledWith, toHaveBeenCalledTimes)
hatch: none
```

The other four rules install no visitor here: the flow rules require `.e2e-spec.ts` and the harness rule
requires `.harness-spec.ts` or `/src/tests/helpers/`.

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: e2e-asserts-persisted-state | no-model-call-in-e2e | e2e-uses-production-transport | harness-calls-provider-directly
message: none
law: TESTING-2 | TESTING-9 | TESTING-3 | TESTING-10
verdict: silent
reason: lane gate did not match — out of scope for these rules
hatch: none
```

**Repaired.** The file now asserts the result as well as the call:

```ts
it("charges the order", async () => {
  const receipt = await handler.execute(command)
  expect(receipt.amount).toEqual(5000)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
})
```

The counters now differ, and the rule is silent — correctly, under the second-assertion exception. But
the same silence is available without the repair:

```ts
it("charges the order", async () => {
  await handler.execute(command)
  expect(gateway.charge).toHaveBeenCalledWith({ amount: 5000 })
  expect(receipt).toBeDefined()
})
```

```text
file: src/orders/charge.handler.spec.ts
lane: unit
rule: no-call-only-spec
message: none
law: TESTING-6
verdict: silent
reason: report none — the counters differed at Program:exit
hatch: one alibi assertion disarms the whole file — the counters are file-wide and must be exactly
  equal, so a single non-call matcher anywhere spares every call-only case in the file
```

The second silence is not compliance. Nothing was proved about the returned value; the file merely
stopped presenting the one shape the rule can see.

## Scope

This module documents enforcement for one law, not the law itself. It does not judge whether a file
represents a business flow, whether an unhappy path drags a critical flow behind it, whether the
decision branches are covered, or whether a stub returns a payload a parser would accept — those belong
to `patterns/testing.md` and are read by a person. It names the rules by their published identifiers,
because those identifiers appear in build output and in disable comments and must be spelled exactly.
Its prose and examples name no product, no company and no repository: every example is an ordinary spec
file with ordinary imports.
