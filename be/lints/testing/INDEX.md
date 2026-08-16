---
id: be-lints-testing-index
title: INDEX.md
slug: /be/lints/testing
sidebar_label: testing
sidebar_position: 0
description: What the testing lint rules can actually see, and the ways of writing they do not catch.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `testing`

## Law

The law is [`patterns/testing.md`](../../canon/patterns/testing.md). It carries eleven codes,
`TESTING-1` through `TESTING-11`.

**Most of that law is not machine-checkable, and the rule source says so in its own first
paragraph.** No rule can tell whether a file represents a business flow, whether an unhappy path
drags a critical flow behind it, whether the decision branches are covered, or whether a stub
returns a payload a parser would accept. Those are read by a person.

This shelf documents the other half: the shapes that are wrong on their face regardless of intent,
what a rule inspects in order to see them, and — the part nobody writes down — what it does not
see. Five rules exist. Six law codes have no rule at all, which is recorded in
[`audit.md`](./audit.md) rather than papered over here.

## Rules

Five rules are published. Each maps to exactly one law code; none is orphaned.

| Rule | Law code | What it reports |
|---|---|---|
| `no-call-only-spec` | `TESTING-6` | A unit spec in which every assertion is a call matcher, so the file restates the handler's own source instead of testing it. Message names the matchers found. |
| `e2e-asserts-persisted-state` | `TESTING-2` | An end-to-end spec in which no state-reading name appears anywhere, so the flow can stop persisting and the file stays green. |
| `no-model-call-in-e2e` | `TESTING-9` | An end-to-end spec importing a model provider package, or a house model helper. Message names the import source. |
| `e2e-uses-production-transport` | `TESTING-3` | Two things: importing an application dispatcher from the framework's CQRS package, and any non-computed `.execute()` or `.process()` call. |
| `harness-calls-provider-directly` | `TESTING-10` | Four things in a model-quality harness: no approved provider SDK import at all, a symbol or provider override that impersonates the production gateway, a house helper hiding the call, and a consumer or CLI credential string. |

The identity of a rule is its published name. The plugin exposes them under the `starci-be/`
prefix, which is the string a build log prints and the string a disable comment must spell.

All five ship at `error`. Two carry a burn-down note in the source: the call-only rule went to zero
from one finding, and the persisted-state rule from one finding.

## Detection

Every rule first decides whether the file is in its lane, using the filename only. Lane selection
is a regular expression over the filename with backslashes rewritten to forward slashes, so a
Windows path compares like any other path.

| Rule | Mechanism |
|---|---|
| lane gate: unit | `context.filename` matches `/\.spec\.ts$/` and does **not** match `/\.(?:e2e\|int\|harness)-spec\.ts$/`. |
| lane gate: flow | `context.filename` matches `/\.e2e-spec\.ts$/`. |
| lane gate: harness | `context.filename` matches `/\.harness-spec\.ts$/`. |
| lane gate: harness helper | `context.filename` contains `/src/tests/helpers/`. |
| `no-call-only-spec` | Visits `CallExpression` whose `callee.type === "Identifier"` and `callee.name === "expect"`. Climbs the `MemberExpression` chain upward while the node is the `object` of its parent, and takes the LAST property name as the matcher — so `.not` and `.resolves` pass through. Increments a file-wide assertion counter, and a second counter when the matcher is in a nine-name set. At `Program:exit` reports only when the counters are equal and non-zero. |
| `e2e-asserts-persisted-state` | Visits every `Identifier` node and tests its `name` against one anchored alternation of six names: the entity manager, the data source, both of their type-cased spellings, a repository getter and a query runner. At `Program:exit` reports when the flag was never set. |
| `no-model-call-in-e2e` | Visits `ImportDeclaration` and tests the literal `source.value` string against two regular expressions: a list of provider package prefixes, and a suffix pattern for a house model helper deliberately left unanchored so a relative `../helpers/models.service` is seen. |
| `e2e-uses-production-transport` | Two independent visitors. `ImportDeclaration` requires `source.value` to equal one exact package string, then checks each `ImportSpecifier`'s `imported` name against a three-name set. `CallExpression` requires a non-computed `MemberExpression` callee and checks the property name against a two-name set — with no check of what the object is. |
| `harness-calls-provider-directly` | Four visitors plus a token scan. `ImportDeclaration` sets a flag on an approved provider prefix, reports on a helper path suffix after stripping a `.ts`/`.js` extension, and reports on an imported or local specifier name in a three-name set. `Literal` reports on any string value matching a case-insensitive consumer-credential alternation. `Property` reports when a key named `provide` has an `Identifier` value of the gateway class. `CallExpression` reports when a property named `overrideProvider` receives that class as its first argument. At `Program:exit` it walks the raw token stream looking for the three-token sequence `Pick` `<` `AiInvokeService`, then reports if the provider flag was never set. |

Two facts follow from this table and are the reason the next section is long.

Nothing here is type-aware. No rule asks what an object is, only what a name is spelled. And two
rules read a whole file and report once at the end, so a single line anywhere in the file can
change the verdict for every other line.

## Escape Hatches

### Closed

A way of writing a reader might expect to slip past, and why it does not.

| Rule | The attempt | Why it fails |
|---|---|---|
| `no-call-only-spec` | `expect(spy).not.toHaveBeenCalled()` — a negated call assertion looks like a different matcher. | The matcher climb takes the LAST property in the chain, so `.not` is passed through and the answer is still the call matcher. |
| `no-call-only-spec` | `await expect(promise).resolves.toBe(1)` — a modifier chain looks unparseable. | Same climb; the answer is the real matcher, and the file is correctly spared. |
| `no-call-only-spec` | Moving the file into a subfolder, or beside the code it exercises. | The lane gate reads the filename suffix, never the directory. |
| `e2e-asserts-persisted-state` | Reading state through the query runner instead of the entity manager. | Both names are in the alternation, along with the data source and the repository getter. |
| `no-model-call-in-e2e` | `import { models } from "../helpers/models.service"` — a relative path, so an absolute-path pattern would miss it. | The helper pattern is deliberately unanchored and matches the suffix, which is the form an end-to-end file beside the helper folder actually writes. |
| `no-model-call-in-e2e` | `import OpenAI from "openai/index"` — a deep import. | The provider pattern accepts both the bare package and the package followed by a slash. |
| `e2e-uses-production-transport` | `const bus = app.get(CommandBus)` with no direct construction. | The call check is method-name-based, so `bus.execute(...)` reports whatever the object is or where it came from. |
| `e2e-uses-production-transport` | `import { CommandBus as Bus } from "@nestjs/cqrs"` — renaming on import. | The specifier check reads `imported`, the name on the package side, not the local alias. |
| `harness-calls-provider-directly` | `import { AiInvokeService as Gateway }` — renaming the gateway on import. | The check accepts `imported` first, so the package-side name is what is tested. |
| `harness-calls-provider-directly` | `Pick<AiInvokeService, "run">` as a hand-rolled stand-in type, which no ordinary AST visitor for the plugin's parser would reach. | A raw token scan at `Program:exit` looks for the literal three-token sequence, so the type is caught without type information. |
| `harness-calls-provider-directly` | Declaring the gateway in a test module: `{ provide: AiInvokeService, useValue: fake }`. | The `Property` visitor reports on the key/value pair directly. |

### Open

A way of writing these rules genuinely do NOT catch. Each row is a real shape, not a hypothetical.

| Rule | What slips through | Why |
|---|---|---|
| `no-call-only-spec` | **One alibi assertion disarms the whole file.** Thirty call-only cases plus a single `expect(result).toBeDefined()` anywhere in the file report nothing. | The counters are file-wide and the report requires them to be exactly equal. The rule has no notion of a test case. |
| `no-call-only-spec` | **A matcher name that was never invoked still counts.** `expect(result).toEqual` — parentheses forgotten — asserts nothing at runtime and silences the file. | The matcher is read as the last property name in the member chain; whether the chain ends in a call is never checked. |
| `no-call-only-spec` | **A call assertion spelled a way the set does not list.** `toHaveBeenCalledOnce`, `toHaveBeenCalledExactlyOnceWith`, `toHaveReturnedWith`, `toHaveReturnedTimes`. | The set holds nine names. An unlisted name leaks twice: it is not counted as a call assertion, and it makes the counters differ, which spares every real call assertion in the file. |
| `no-call-only-spec` | **The same test rewritten as a value assertion.** `expect(charge.mock.calls[0][0]).toEqual({ amount: 5000 })` restates the source exactly as before. | The matcher is `toEqual`, which the rule treats as a result assertion. The rule watches the matcher, not the subject. |
| `no-call-only-spec` | **The assertion moved into a helper, or `expect` aliased.** A file whose cases call `assertCharged(spy)` from another module, or `expect.soft(spy).toHaveBeenCalled()`. | The visitor requires the callee to be an `Identifier` named exactly `expect`; a member callee is skipped, and a helper's assertions live in a file that is not a unit spec. A file with zero recognised assertions is explicitly not reported. |
| `no-call-only-spec` | **`.test.ts`, `.spec.tsx`, `.spec.mts`, and the whole integration lane.** | The gate requires the exact `.spec.ts` ending and excludes three suffixes outright. Renaming a file is the cheapest change in a repository. |
| `e2e-asserts-persisted-state` | **The import satisfies the rule.** `import { DataSource } from "typeorm"` at the top of a flow that asserts nothing but response status marks the file as reading state. | The visitor fires on every `Identifier` node, and an import specifier is an identifier. So is a type annotation, a dependency-injection token, and a teardown line closing the connection. |
| `e2e-asserts-persisted-state` | **A read that is never asserted.** `const rows = await entityManager.find(Order)` with no `expect` on `rows`. | The rule sets a boolean when a name appears. It never traces the value to an assertion. |
| `e2e-asserts-persisted-state` | **A property name spelled the same way.** `config.dataSource`, `options.queryRunner`. | A non-computed member property is an `Identifier`, and the rule tests its name with no regard for position. |
| `e2e-asserts-persisted-state` | **An honest read the list does not know.** A repository named `repo`, an entity manager named `em`, a second query issued through the transport, a cache client, or any datastore that is not the one the six names describe. This fires a FALSE positive, and the cheapest way to clear it is to rename a variable rather than to add an assertion. | The alternation is six literal names. Vocabulary is what is measured. |
| `no-model-call-in-e2e` | **Anything that is not a static import.** `await import("openai")`, `require("openai")`, or a plain `fetch` to the provider's HTTPS endpoint. | Only `ImportDeclaration` is visited. A dynamic import is a different node type and a network call is not an import at all. |
| `no-model-call-in-e2e` | **The provider that is not on the list.** The newer first-party client from the same vendor whose older client IS listed, plus every gateway, aggregator and inference host not enumerated. The sibling rule on this shelf accepts a package that this rule does not ban, so the two lists disagree inside one file. | Both lists are hand-maintained prefixes. |
| `no-model-call-in-e2e` | **Reaching a model without importing anything.** The flow resolves the production gateway from the application container and nobody remembered the stub. This is the exact failure the law calls out — a rule that depends on being remembered — and no rule watches for it. | The rule proves an import is absent, which is not the same as proving no call is made. |
| `no-model-call-in-e2e` | **The helper renamed or moved one level.** `helpers/model.service`, `helpers/llm-client`, `helpers/models/index`. | The suffix pattern requires the path to END in the one word. |
| `e2e-uses-production-transport` | **A computed member call.** `bus["execute"](command)`, or `bus[method](command)`. | The callee check bails out when `computed` is true. |
| `e2e-uses-production-transport` | **Every other way into the application.** `eventBus.publish(event)`, `handler.handle(command)`, `resolver.findThing(args)`, `service.enroll(...)`, `worker.run()`. Publishing an event straight onto the bus enters exactly where the law forbids and is not reported. | The method set holds two names. |
| `e2e-uses-production-transport` | **The dispatcher imported from anywhere else.** A project barrel that re-exports it, a deep path into the package's build output, or `import * as cqrs from "@nestjs/cqrs"` followed by `cqrs.CommandBus`. | The import check is string EQUALITY on one package specifier, and a namespace specifier is skipped because it is not an `ImportSpecifier`. |
| `e2e-uses-production-transport` | **False positives on the same two words.** A database driver's `connection.execute(sql)` used to read state back, a queue's `queue.process(handler)` registered in setup, a test client's `execute`. The rule cannot tell an application internal from a library, so satisfying it can mean renaming a legitimate call. | The object is never inspected — only the property name. |
| `harness-calls-provider-directly` | **An unused import satisfies the provider requirement.** `import "openai"` at the top, then the whole harness runs through a locally named house client. | The flag is set by the presence of an import whose source matches. Whether the SDK is ever called is not checked. |
| `harness-calls-provider-directly` | **The credential read in its ordinary form.** `process.env.CLAUDE_CODE_OAUTH_TOKEN` is invisible; only the bracket form `process.env["CLAUDE_CODE_OAUTH_TOKEN"]` is a string literal. A template literal is invisible for the same reason. | The check visits `Literal` and requires a string `value`. A member property is an identifier and a template chunk is a `TemplateElement`. |
| `harness-calls-provider-directly` | **The gateway wearing a different type or token.** `Partial<AiInvokeService>`, `Omit<AiInvokeService, "x">`, a hand-written `interface FakeInvoke { run(...) }`, `provide: AI_INVOKE_TOKEN`, `overrideProvider(AI_INVOKE_TOKEN)`, or a default import of the gateway module under a local name. | The token scan looks for one exact three-token sequence; the specifier set, the `provide` check and the override check all compare against one literal class name. |
| `harness-calls-provider-directly` | **A helper renamed out of the ban.** The house model helper moved to `./judge-client` and imported from the harness. | The helper pattern lists two names. Renaming a file leaves the same code legal. |
| `harness-calls-provider-directly` | **A helper outside the one folder.** Only `/src/tests/helpers/` is in credential scope; `test/helpers/`, `src/test/helpers/` and any nested `helpers/` under another root are out of scope entirely, and out of scope means every check including the credential check. | The helper gate is a literal path fragment. Folder bans are not file bans. |

## Inputs

| Input | What the rule reads |
|---|---|
| filename | `context.filename`, falling back to `context.getFilename()`, normalised to forward slashes. Decides the lane and therefore whether any visitor runs. |
| AST nodes | `CallExpression`, `Identifier`, `ImportDeclaration`, `ImportSpecifier`, `Literal`, `Property`, `MemberExpression` chains. |
| token stream | `sourceCode.getTokens(sourceCode.ast)`, used once, to find a generic type argument without type information. |
| file-end state | Counters and flags accumulated across the file, reported at `Program:exit`. |

Nothing else. No type checker, no cross-file resolution, no test-runner configuration, no coverage
report, no runtime observation.

## Invariants

- A rule's identity is its published name. There is no second numeric identifier, because a rule
  with two names cannot be traced from a build log back to the file that produced it.
- Lane membership comes from the filename suffix and nothing else, which is the law's own
  `TESTING-7`. A rule that runs in the wrong lane is a bug in the gate, not in the file.
- A rule reports a SHAPE, never an intent. Every message names the shape and the remedy.
- A call assertion is legitimate as a second assertion. The call-only rule fires only when a file
  has nothing else, and that carve-out is deliberate rather than an oversight.
- No rule is type-aware, so every check is a comparison against a spelled name.
- Two rules read the file whole and speak once at the end. A single added line changes the verdict
  for the entire file.
- A rule that cannot be pointed at is a proposal. Six law codes have no rule; they are unenforced
  and recorded as such.

## Exceptions

Exceptions are part of the enforcement, not relief from it.

- **The second assertion.** A call assertion beside a result assertion is the intended shape when
  the call itself is the observable effect — a message sent, an event published. This is why the
  call-only rule counts a file rather than a case.
- **A flow with no persisted consequence.** The persisted-state rule expects a disable comment
  naming what the flow observes instead. A disable with no reason is the rule being deleted one
  file at a time.
- **Credential scope is wider than harness scope.** In a harness helper, only the consumer
  credential check runs. Every other check in that rule is gated on the harness lane, so a helper
  may import and export whatever it likes.
- **The integration lane is unwatched by design.** The law separates four lanes; three rules watch
  the flow lane, one watches the unit lane, one watches the harness lane. No rule watches
  integration specs at all.

## Output

A verdict about one file, in this shape:

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

The `hatch` line is the point of this shelf. A silent rule is not evidence that a file is correct;
it is evidence that the file did not present the one shape the rule can see.

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for what each rule catches and why the law deserves a
machine holding it, [`example.md`](./example.md) for code that fires and code that does not,
[`audit.md`](./audit.md) while reviewing enforcement itself, and [`changelog.md`](./changelog.md)
for version history.

## Scope

This module documents enforcement for one law. It names the rules by their published identifiers,
because those identifiers appear in build output and in disable comments and must be spelled
exactly. Its prose and examples name no product, no company and no repository: every example is an
ordinary spec file with ordinary imports.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in
[`changelog.md`](./changelog.md). A rule added to or removed from the source is such a change; so
is an open hatch discovered, closed, or argued away.
