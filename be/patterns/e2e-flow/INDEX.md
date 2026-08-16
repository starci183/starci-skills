---
id: be-patterns-e2e-flow-index
title: INDEX.md
slug: /be/patterns/e2e-flow
sidebar_label: e2e-flow
sidebar_position: 0
description: Binding rules for the shape of one flow file — the parts it needs, the order they go in, and the habits that turn a flow test into a slow flaky one.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `e2e-flow`

## Law

**One flow file is one business sentence, proved through the production boundary, and it goes red
when that sentence stops being true and at no other time.**

The testing law settles WHICH tests belong in this lane and what they must assert. This module
settles how one of them is written: the parts a flow needs, the order they go in, and the habits
that turn a good flow test into a slow flaky one.

The question every code below answers is the same one:

> When this goes red at 3am, will the person reading it know which step broke and why?

A flow that answers "no" is a flow that gets re-run rather than read, and a test that gets re-run
rather than read has stopped being a test. That is the whole standard. Speed, coverage and elegance
are downstream of it.

**This is binding, not advisory.** Every file matching `*.e2e-spec.ts` is in scope of all twelve
codes at once — they are not a menu. A flow does not satisfy `E2E-3` and get a pass on `E2E-6`;
the codes describe twelve independent ways one file stops being evidence. "It is a small flow" is
not an exemption; it is the most common place the law gets skipped.

## Situation Codes

Every situation this module governs carries a code, `E2E-<n>`. The number is FIXED. These codes are
cited from other law files and from historical task records, so renumbering one silently breaks a
citation somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `E2E-1` | One file per business sentence, and the filename IS the sentence | A file named for a resolver group, an endpoint or a module |
| `E2E-2` | One named `it` per business step, in order, sharing the `describe` scope | One `it` covering the whole flow |
| `E2E-3` | Polling a predicate under a deadline that says what it waited for | `sleep` / `delay` / `wait` / `pause` / `setTimeout`, and any promise wrapped around a timer |
| `E2E-4` | Reading the consequence back from where it lives: the row, the message, the next query | Asserting only the response envelope or the status code |
| `E2E-5` | A real client, awaiting the NEXT message matching a predicate, asserting content and recipient | Asserting a message COUNT, or a mutable recorder reset by hand between steps |
| `E2E-6` | At least one step that asserts the absence: who must NOT receive, what must NOT open | A flow that only ever asserts what SHOULD arrive |
| `E2E-7` | One unconditional assertion per step; force the condition or drop the case | `if`, ternary, `switch`, or a statement-level `&&` inside a step |
| `E2E-8` | One testing-infra place that boots app, database, broker and sockets | Wiring re-declared per spec file |
| `E2E-9` | Named actors, minted fresh by the flow that uses them | A magic ordinal, or an actor shared between flows |
| `E2E-10` | The step name and the assertion as the only output | `console.*` or a framework logger inside a spec |
| `E2E-11` | Entry through GraphQL, HTTP, socket, the real broker or the real scheduler, with every internal hop real | Importing a bus to drive the flow, or resolving a `*Worker` / `*Handler` and calling it |
| `E2E-12` | Scripting only the external client's result or error | Mocking an internal orchestrator, balancer, router, entitlement or billing path; importing a provider SDK in a spec |

Twelve codes. The module ends with twelve: a new situation is a rule change recorded in
`changelog.md`, not a thirteenth code somebody adds because a case felt uncovered.

## Tầng giữ

Which tier actually holds each code. `enforced` means a rule in
[`sources/be/e2e-flow.mjs`](../../../sources/be/e2e-flow.mjs) fires on it, and the rule is named.

| Code | Tier | Held by |
|---|---|---|
| `E2E-1` | `documented` | Only a reader. A filename cannot be compared to a business sentence |
| `E2E-2` | `documented` | Only a reader. Counting `it` blocks would refuse a flow that is genuinely one step |
| `E2E-3` | `enforced` | `no-sleep-in-flow` — messages `sleep` and `timer` |
| `E2E-4` | `enforced` (half) | `e2e-asserts-persisted-state` — holds only that SOME persisted read exists, never that the RIGHT consequence was read |
| `E2E-5` | `documented` | Only a reader. What is asserted is meaning, not syntax |
| `E2E-6` | `documented` | Only a reader. An absent assertion has no shape to fire on |
| `E2E-7` | `enforced` | `no-branch-in-flow-step` — `IfStatement`, `ConditionalExpression`, `SwitchStatement`, statement-level `LogicalExpression` |
| `E2E-8` | `documented` | Only a reader. This is a fact about a tree of fixtures, not about one file |
| `E2E-9` | `documented` | Only a reader. Who is acting is meaning |
| `E2E-10` | `documented` | Not by this module. `no-console` and `starci-be/no-framework-logger` in the observability law already cover every call site; a second rule here would double every report |
| `E2E-11` | `enforced` (half) | `e2e-uses-production-transport` — bus imports and direct `*Worker` / `*Handler` calls. The "entered at the production boundary" half is a reader's judgement |
| `E2E-12` | `enforced` (half) | `no-model-call-in-e2e` — provider SDK imports. Mocking an internal orchestrator has no import to catch |

**Five of twelve are enforced, seven are documented. That is the honest number, not a gap somebody
should close.** A rule earns its place by firing on a syntactic shape. A rule that fires on a
judgement is one authors learn to disable, and a disabled rule leaves the law worse off than when
nothing enforced it.

**No row reads `unrepresentable`, and none can.** That tier closes a set of VALUES with a union or a
brand. Every code here is a claim about the shape of a test file — which steps exist, what they
assert, who acted — and a file's shape is not a value a type system holds. The one place a type
could help is the transport handle a flow receives, and it would still not stop a spec from
resolving an internal actor out of the container.

## Anchor

Every code points at real code it can be checked against. A law that cannot be pointed at in real
code is a proposal, not a law.

| Code | Anchor | What to look for |
|---|---|---|
| `E2E-1` | `src/tests/e2e/course-purchase.e2e-spec.ts` | The filename and the `describe` string say the same sentence; the file proves one purchase, not a resolver group |
| `E2E-2` | `src/tests/e2e/background-worker-resilience.e2e-spec.ts` | Fourteen named `it` steps in one `describe`, each naming the business step it proves |
| `E2E-3` | `src/tests/helpers/flow-wait.ts` → `until`, `DEFAULT_TIMEOUT_MS`, `WaitOptions.describe` | The deadline plus predicate that replaced `sleep`; the `describe` field exists so the failure names the state, not the timeout |
| `E2E-4` | `src/tests/helpers/flow-world.ts` → `FlowWorld.entityManager`, resolved via `getEntityManagerToken(POSTGRESQL_PRIMARY)` | A flow gets the REAL entity manager of the primary datasource, so a consequence is read from the row it was written to |
| `E2E-5` | `src/tests/helpers/flow-wait.ts` → `nextMessage`, used in `src/tests/e2e/community-chat.e2e-spec.ts` | Awaiting the next matching message on a real socket; no count assertion anywhere in the helper's surface |
| `E2E-6` | `src/tests/helpers/flow-wait.ts` → `expectNoMessage`, `DEFAULT_SILENCE_MS`; used in `src/tests/e2e/notification-delivery.e2e-spec.ts` | A step that proves a stranger's socket stayed silent while the intended recipient was served |
| `E2E-7` | `.claude/sources/be/e2e-flow.test.mjs` → `tester.run("no-branch-in-flow-step", …)` | The valid and invalid fixtures that pin exactly which shapes count as a branch inside a step |
| `E2E-8` | `src/tests/helpers/flow-world.ts` → `bootFlowWorld`; `src/tests/helpers/create-e2e-app.ts` → `createE2eApp` | Two entry points that stand the world up, so a spec opens with what it is testing |
| `E2E-9` | `src/tests/helpers/flow-world.ts` → `FlowWorld.mintLearner(name)` | The actor factory takes a NAME and persists a fresh row per flow; no ordinal is accepted |
| `E2E-10` | `src/tests/e2e/` (84 spec files) | Zero real `console` call sites. The only two textual matches, at `coding-submission.e2e-spec.ts:550` and `:646`, are source strings INSIDE a submitted program, not logging |
| `E2E-11` | `src/tests/e2e/background-worker-resilience.e2e-spec.ts`; `src/tests/helpers/nats-cross-instance-world.ts` | Retry, exhaustion and replay proved through the real queue; a world that boots a real broker connection and the real `ScheduleModule` |
| `E2E-12` | `src/tests/helpers/ai-provider-invoke-script.ts` | A FIFO script of provider outcomes replacing only the external client, while cache, keys and the invoke path stay real |

Twelve codes, twelve anchors. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| sentence | The one business promise this file proves, in words a non-author can check |
| steps | The ordered business steps, each one an `it` |
| entry | The production boundary the flow enters through: GraphQL, HTTP, socket, broker or scheduler |
| consequence | Where each step's outcome LIVES: which row, which message, which subsequent query |
| actors | Every acting identity, named, and minted by this flow |
| absence | What must NOT happen, and to whom |
| external seam | The concrete external client whose result or error is scripted, and nothing inside it |

## Invariants

- One file proves one sentence, and the filename states that sentence.
- Steps are ordered because the business is ordered; a step may depend on the step before it.
- Every wait is bounded by an outcome, never by a duration.
- Every assertion reads the consequence from where the consequence lives.
- A realtime assertion is about content and recipient, never about how many listeners existed.
- Every flow asserts at least one absence.
- A step asserts exactly one outcome, unconditionally.
- The world is stood up in one place; a spec file contains no wiring of its own.
- Actors are named and are never shared between flows.
- A spec's only output is the step name and the assertion.
- Internal hops stay real; only the outermost external client is scripted.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Ordered dependence between steps (`E2E-2`).** A flow step MAY depend on the step before it. This
  is the one lane where that is legal, and it is exactly what a flow is. It does not license a step
  that depends on a step in another file.
- **A genuinely single-step flow (`E2E-2`).** A sentence that is one operation is one `it`. This is
  why no rule counts `it` blocks: the first false positive would be legitimate, and a rule whose
  first false positive is legitimate teaches authors that the rule is wrong rather than that they
  are.
- **Registering a worker (`E2E-11`).** Importing a worker so the framework can register it is
  correct and required. Resolving that worker and calling `process`, `finalize` or another internal
  method is what is refused: the direct call erases serialization, locking, retry, acknowledgement
  and competing-consumer behaviour — exactly the behaviour the operational flow exists to prove.
- **Scripting an external error (`E2E-12`).** A flow MAY force the external client to throw, because
  the error is an external result. It may not force the internal policy that decides what to do with
  that error.
- **Waiting on a mock's own bookkeeping (`E2E-3`).** Polling a scripted seam's call record — "the
  hand-off was enqueued once" — is still polling a state, and is legal. Waiting a fixed duration for
  it is not.
- **Two flows, not two branches (`E2E-7`).** When two outcomes are both legitimate business
  outcomes, they are two steps or two files. Splitting is the fix; a branch is not.

## Output

```text
sentence:    <the business promise this file proves>
file:        <name>.e2e-spec.ts
entry:       <graphql | http | socket | broker | scheduler>
steps:       <ordered business steps, one per it>
consequence: <where each outcome is read from>
actors:      <named, minted by this flow>
absence:     <what must not happen, and to whom>
scripted:    <the external client seam, and nothing inside it>
codes:       <E2E-1 … E2E-12, all twelve, with how each is satisfied>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code and the boundary
against its neighbours, `example.md` for the cases and the request mapping, and `audit.md` only
while reviewing the canon itself.

## Scope

This module states a rule true of any back end that has a flow lane. Examples are ordinary
TypeScript shaped like a framework test: a `describe`, ordered `it` steps, an entity manager, a
queue, a socket. It names no product, no repository and no private module. Where the source law
named an internal service by its own name, this module names the ROLE that service plays, because a
role transfers and a name does not.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
A code is never renumbered and never retired silently: both are structural changes and take the
major number.
