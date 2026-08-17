---
title: E2e-flow
module: e2e-flow
kind: pattern
stack: be
codes: [E2E-1, E2E-2, E2E-3, E2E-4, E2E-5, E2E-6, E2E-7, E2E-8, E2E-9, E2E-10, E2E-11, E2E-12]
---

# E2e-flow

The input to this pattern is an accepted shape: a business sentence somebody already agreed is worth
proving, with its steps, its actors and its boundary already settled. This pattern does not re-open
that decision. Its output is source architecture — which file the sentence becomes, which layer holds
the wiring, what the file may import, what it must enter through, what it names its actors, and what
it is forbidden to reach for. The shape says what is promised; this pattern says where the code goes.

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

## Situation codes

Every situation this module governs carries a code, `E2E-<n>`. The number is FIXED. These codes are
cited from other law files and from historical task records, so renumbering one silently breaks a
citation somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `E2E-1` | A file is being opened in the flow lane | Requires: one file per business sentence, and the filename IS the sentence. Forbids: a file named for a resolver group, an endpoint or a module |
| `E2E-2` | The business sentence has several stages | Requires: one named `it` per business step, in order, sharing the `describe` scope. Forbids: one `it` covering the whole flow |
| `E2E-3` | The system needs time to settle — webhook, queue, projection, socket | Requires: polling a predicate under a deadline that says what it waited for. Forbids: `sleep` / `delay` / `wait` / `pause` / `setTimeout`, and any promise wrapped around a timer |
| `E2E-4` | The step has a business consequence | Requires: reading the consequence back from where it lives: the row, the message, the next query. Forbids: asserting only the response envelope or the status code |
| `E2E-5` | The promise includes realtime delivery | Requires: a real client, awaiting the NEXT message matching a predicate, asserting content and recipient. Forbids: asserting a message COUNT, or a mutable recorder reset by hand between steps |
| `E2E-6` | Somebody must NOT receive, something must NOT open | Requires: at least one step that asserts the absence: who must NOT receive, what must NOT open. Forbids: a flow that only ever asserts what SHOULD arrive |
| `E2E-7` | A step's state could be A or B | Requires: one unconditional assertion per step; force the condition or drop the case. Forbids: `if`, ternary, `switch`, or a statement-level `&&` inside a step |
| `E2E-8` | The flow needs app, database, broker and sockets | Requires: one testing-infra place that boots app, database, broker and sockets. Forbids: wiring re-declared per spec file |
| `E2E-9` | Somebody is acting in the flow | Requires: named actors, minted fresh by the flow that uses them. Forbids: a magic ordinal, or an actor shared between flows |
| `E2E-10` | The step is hard to follow and printing is the reflex | Requires: the step name and the assertion as the only output. Forbids: `console.*` or a framework logger inside a spec |
| `E2E-11` | An operational chain — queue, retry, scheduler, projection, realtime | Requires: entry through GraphQL, HTTP, socket, the real broker or the real scheduler, with every internal hop real. Forbids: importing a bus to drive the flow, or resolving a `*Worker` / `*Handler` and calling it |
| `E2E-12` | The flow touches an external dependency | Requires: scripting only the external client's result or error. Forbids: mocking an internal orchestrator, balancer, router, entitlement or billing path; importing a provider SDK in a spec |

Twelve codes. The module ends with twelve: a new situation is a rule change recorded in
`changelog.md`, not a thirteenth code somebody adds because a case felt uncovered.

## Reading an accepted shape

1. **Read what the shape states.** It states the business sentence, the ordered steps, the entry
   boundary, where each consequence lives, the acting identities, what must not happen, and the
   external seam. Those seven facts are the inputs; nothing below is decided without them.
2. **Name what the shape does not state, and therefore does not resolve.** An accepted shape does not
   choose the file name's wording, the helper that polls, the token a flow overrides, or the fixture
   tree the world is booted from. Those are architecture decisions this pattern makes; the shape is
   silent on them and silence is not permission to skip a code.
3. **Resolve outermost first.** The file and its sentence (`E2E-1`) before its steps (`E2E-2`); the
   entry boundary (`E2E-11`) and the scripted seam (`E2E-12`) before what any single step asserts;
   the world (`E2E-8`) and the actors (`E2E-9`) before the assertions that read them.
4. **Ask each code's question in turn.** All twelve are in scope of every file at once. Ask each
   question of this shape — a code whose answer is "this shape has no such situation" is still
   answered, and `E2E-6` is answered by writing the absence step, never by concluding there is none.
5. **When two codes both match, split on what is being asserted, not on what is convenient.** Waiting
   for a row is `E2E-3`; waiting for a message is `E2E-5`. A durable consequence read from a store is
   `E2E-4`; a consequence flying over a socket is `E2E-5`. Which door you enter is `E2E-11`; what you
   replace at the far end is `E2E-12`. Both codes stay in force — matching one never releases the
   other, and a message that is both stored and broadcast is two consequences in two places.

## `E2E-1` — one file, one flow, the filename is the sentence

**Situation.** A file is about to be created in the flow lane. The first question is not "which
resolver am I testing" but **which business sentence is being promised**.

**What it emits in source.** One `*.e2e-spec.ts` file whose name reads as a sentence with a subject
and a verb — *a learner buys a course and can then start learning* — and a `describe` string stating
the same sentence as the filename.

**Recognition signs.** The filename reads as a sentence with a subject and a verb. The `describe`
string says the same sentence as the filename. Someone who did not write the file can guess what it
proves before opening it. Ask: if this file were deleted, which business promise loses its guard?

**Boundary.** Not `E2E-2`: `E2E-1` says what the file **is**, `E2E-2` says how the inside is
**divided** — a correct name with one `it` swallowing everything still fails `E2E-2`. Not `E2E-8`: a
file named after an infrastructure module (`app.e2e-spec.ts`) is not a flow at all, it is the sign
that wiring has leaked into this lane.

**Common business situations.** Buying a course; refund; auto-graded submission; a chat room
receiving a message; unlocking an achievement; trial signup; notification delivery; daily quests.

## `E2E-2` — a flow is a chain of named steps, not one long case

**Situation.** The sentence has several stages: put in cart, pay, open access to learning.

**What it emits in source.** One `it` per stage, in business order, inside one `describe`; shared
state is declared at the `describe` scope and assigned in the step that produces it.

**Recognition signs.** Each `it` reads as a business step, not a technical call. On failure the
runner prints the step name, and later steps are skipped rather than failing in a chain. Ask: reading
only the red line, without opening the file, do I know which stage broke?

**Boundary.** Not `E2E-7`: `E2E-2` divides a flow into steps, `E2E-7` forbids a branch **inside** one
step — correct splitting does not rescue a step containing an `if`. Not `E2E-6`: an absence step is
itself a named step, not an `expect` appended to the end of a positive one.

**Why there is no lint.** Counting `it` blocks would refuse a flow that genuinely has one step. A
rule whose first false positive is the legitimate case teaches authors that the rule is wrong rather
than that they are.

**Common business situations.** Multi-stage checkout; onboarding; taking and grading an exam;
enrolment then content unlock; booking then confirmation; payment then entitlement.

## `E2E-3` — never sleep; poll until the state settles, under a deadline

**Situation.** There is an asynchronous hop — webhook, queue, projection or socket — so the system
needs time to finish.

**What it emits in source.** A bounded poll of the awaited state: a predicate plus a deadline, whose
failure message names the state that was waited for, never the word "timeout".

**Recognition signs.** An `await` on a function named `sleep`, `delay`, `wait`, `pause`, or a
`Promise` wrapping `setTimeout`. A millisecond number nobody can explain. File history showing that
number only ever going up. Ask: which state am I waiting for? If that has an answer, poll that state.

**Why sleeping is wrong in both directions at once.** Too short and the suite goes red for a reason
that is not a defect; too long and **every** run pays for the worst case. Both get "fixed" by raising
the number, and raising it buys neither correctness nor speed. The deadline is itself an assertion:
"this settles within N seconds" is a claim about the system, so the expiry message must name what was
awaited.

**Boundary.** Not `E2E-5`: waiting for a **row** is `E2E-3`, waiting for a **message** is `E2E-5` —
both poll, but the latter must also assert content and recipient. Not `E2E-6`: waiting for presence
is `E2E-3`, observing absence across a silence window is `E2E-6`, and that is the only place a fixed
duration is legitimate, because absence can only be measured in time.

**Common business situations.** A payment webhook arriving; a queued job finishing; a CDC projection
catching up; a cache being invalidated; a scheduler firing; an email reaching the outbox.

## `E2E-4` — assert the consequence, and read it where it lives

**Situation.** A step has just completed a call. The question is where that step's business
consequence lives.

**What it emits in source.** A read from the place the consequence lives — the row through the real
entity manager of the primary datasource, the message, or the subsequent query — with the assertion
made against that read, not against the transport envelope.

**Recognition signs.** The step asserts only `statusCode`, an empty `errors`, or `data.x` in the
returned envelope. There is no read from database, message or subsequent query. If the handler wrote
to the wrong table but still returned `200`, the step would stay green. Ask: if the server answered
correctly but **wrote nothing**, would this step go red?

**What an envelope proves.** Only that the server answered. That is a transport event, not a business
consequence.

**Boundary.** Not `E2E-5`: a **durable** consequence read from a store is `E2E-4`, a consequence
**flying over a socket** is `E2E-5`. Not `E2E-12`: reading back an external seam's `mock.calls` is
legitimate proof of the **hand-off**, but it does not replace the row read when the consequence has a
row.

**The half the lint holds.** The rule can see only that the file reads persisted state *somewhere*.
It does not know whether you read the **right** consequence. The other half is the reader's work.

**Common business situations.** An enrolment row opening; a balance after a transaction; order
status; experience points added; a job-completion record; access closing again after a refund.

## `E2E-5` — a realtime step opens a real client and asserts WHAT arrived, not HOW MANY

**Situation.** The business promises "people in the room receive the message". The step must open a
real client and await exactly that message.

**What it emits in source.** A real socket client and an await on the NEXT message matching a
predicate, with assertions on content and recipient — no length assertion and no hand-reset recorder.

**Recognition signs.** An `expect(...).toBe(2)` on the length of a message array. A global recorder
reset by hand between steps. Adding one more subscriber to the system turns this step red. Ask: if
the payload were **wrong** but the number of recipients **right**, would this step go red?

**Why counting is wrong.** The number encodes how many listeners happen to be connected today. Add a
third listener and a correct system turns red; send the wrong payload to the right number of people
and a broken system stays green. Counting is an implementation detail of fan-out; **content** is the
promise.

**Boundary.** Not `E2E-6`: `E2E-5` asserts what **reached the right person**, `E2E-6` asserts what
**did not reach anyone else**, and a realtime flow that meets the standard has both. Not `E2E-4`: a
message that is stored **and** broadcast is two consequences in two places — reading the row is
`E2E-4`, receiving on the socket is `E2E-5`, and dropping either drops half the promise.

**Common business situations.** Chat room messages; push notifications; presence cursors; job
progress streamed back; interview session state; live leaderboard updates.

## `E2E-6` — absence is part of the flow

**Situation.** Before the customer subscribes they must receive **nothing**. Before payment settles,
access must stay **closed**.

**What it emits in source.** At least one named step proving the absence, with a second actor
standing outside, observed across a short, explicitly stated silence window.

**Recognition signs.** The file contains only "then it must arrive" steps and no "then it must not
arrive" step. There is no second actor standing outside to prove nothing leaked. A system that
broadcast everything to everybody would pass the whole file clean. Ask: if the system sent everything
to everyone, would this file catch it?

**Why this is the most important failure.** It is **invisible on the happy path**. A leak makes
nobody complain: the person who should receive still receives. Only an absence step can see it.

**Boundary.** Not `E2E-5`: see above. Not `E2E-3`: this is the one exception where a **fixed
duration** is legitimate, because "nothing happened" can only be measured as "for how long". That
silence window must be short and explicitly stated.

**Common business situations.** Someone outside the room not receiving the message; an unpaid learner
not opening content; another user not seeing a draft; a stray webhook not granting entitlement;
someone who left the group no longer receiving notifications.

## `E2E-7` — no branching inside a step

**Situation.** A step is looking at state that could be A or B, and the author writes an `if` to be
"safe".

**What it emits in source.** One unconditional assertion per step: the condition is forced to happen
and then asserted flatly, or the case leaves this file. No `IfStatement`,
`ConditionalExpression`, `SwitchStatement` or statement-level `LogicalExpression` inside a step.

**Recognition signs.** An `if`, a ternary, a `switch`, or `a && expect(...)` standing as a statement
inside an `it`. An `expect` sitting in a branch that does not always run. Two runs going green two
different ways, proving two different things. Ask: on the run that **skipped** this branch, what did
the file prove?

**Why green becomes empty.** A branch inside a step means the test **accepts both paths**, so a green
run is no longer evidence that the business is correct — it only proves the code reached the end. The
fix: if the condition **is** part of the flow, force it and assert unconditionally; if it is not, it
does not belong in this file. Two legitimate outcomes are two steps, or two files.

**Boundary.** Not `E2E-2`: splitting into more steps is the legitimate way to remove a branch;
stuffing a branch into one step is not. Not `E2E-3`: the predicate passed to a bounded poll **may**
be a conditional expression — it is the thing being awaited, not a conditional assertion.

**Common business situations.** A gateway status that may be pending or paid; a job that may already
have run; a cache that may be warm; a user who may already have a row; a retry budget that may not be
exhausted.

## `E2E-8` — one place stands the world up

**Situation.** The flow needs app, database, broker, sockets. That wiring belongs to the testing
infrastructure, not to the flow file.

**What it emits in source.** Entry points in the testing-infra tree that boot the world, called from
the spec's first line; the spec file itself contains no wiring of its own, and a per-flow override
re-declares exactly the one token it overrides.

**Recognition signs.** A flow file opening with two hundred lines of `Test.createTestingModule`.
Changing one infrastructure provider means editing twenty-five files. Two flow files standing the
world up **slightly differently**, with nobody knowing where they differ. Ask: when the wiring
changes, how many files change with it?

**Boundary.** Not `E2E-12`: the shared infrastructure decides what is scripted **by default**, and a
flow overrides it by re-declaring that same token — overriding is legitimate, **copying the whole
world** to override one token is not. Not `E2E-9`: the world supplies the actor **factory** and the
flow calls it; the world does not hold a ready-made shared actor.

**Why there is no lint.** This is a fact about a repository's **fixture tree**, not about one file.
It belongs to a gate that can see the whole tree, not to a rule that sees only one file.

**Common business situations.** Booting the app for the flow lane; resetting the database between
files; standing up a broker connection; opening a socket namespace; loading a minimal seed.

## `E2E-9` — actors are named, and minted by the flow itself

**Situation.** The flow needs a buyer, somebody else who must see nothing, and an organisation.

**What it emits in source.** Calls to the world's actor factory taking a NAME, persisting a fresh row
per flow; no ordinal is accepted and no actor is shared between flows.

**Recognition signs.** Magic ordinals: `accountNumber: 8`, `userId: 3`. An actor taken from a shared
seed instead of minted fresh. Two files run at the same time and both go red inexplicably. Ask: if
this file ran **at the same time** as another, would the two tread on each other?

**Why an ordinal is debt.** It tells the reader nothing, and it **collides silently** when two flows
pick the same number. A name both describes the role and forces each flow to mint its own actor — so
flows share no state and run in any order.

**Boundary.** Not `E2E-6`: the second actor (`otherLearner`, the stranger) exists **precisely so**
absence can be checked; without a named actor there is no decent absence step. Not `E2E-8`: see
above.

**Common business situations.** A buyer and an outsider; a room owner and a guest; a grader and a
submitter; an organisation and a member; someone who left the group.

## `E2E-10` — a flow logs nothing at all

**Situation.** A step is hard to follow, and the first reflex is to print a few lines.

**What it emits in source.** Nothing: the step name and the assertion are the spec's only output. No
`console.log`, `console.debug` or framework logger anywhere in a spec file.

**Recognition signs.** A `console.log`, `console.debug`, or a framework logger inside the spec file.
The output of a green run being longer than the list of step names. On failure, the assertion line
being pushed off the screen. Ask: when it goes red, what does the reader **need**? The step name and
the assertion — the runner already prints both.

**Boundary.** Not `E2E-2`: if you need a log to know which step is running, what is missing is a
**step name**, not a log. Not `E2E-4`: if you need a log to know the state, what is missing is **a
state read with an assertion**, not a log.

**Who holds it.** Not this module. The observability law already has `no-console` and
`starci-be/no-framework-logger` covering every call site; a second rule in this lane would only
double every report.

**Common business situations.** Temporary debug left in; printing a webhook payload; printing a job
id; printing retry state.

## `E2E-11` — an operational chain enters through the production door, and every internal hop stays real

**Situation.** The flow is proving fallback, retry, queue, scheduler, projection, cache invalidation
or realtime delivery.

**What it emits in source.** Entry through GraphQL, HTTP, a socket, a publish to the real broker, or
letting the real scheduler fire; a worker may be imported so the framework registers it, and nothing
in the file resolves an internal actor to drive the flow.

**Recognition signs.** The file imports a bus and calls `execute` itself "to move the flow along
faster". The file resolves a `*Worker` / `*Handler` from the container and calls `process` directly.
Retry, ack, locking and competing-consumer behaviour appear **nowhere** in the file. Ask: if
serialization or ack broke, would this file go red?

**The narrow, decisive boundary.** **Importing** a worker so the framework can register it is
**correct and required**. **Resolving it and calling** an internal method is refused: the direct call
erases serialization, locking, retry, acknowledgement and competing-consumer behaviour — exactly the
behaviour the operational flow exists to prove.

**Boundary.** Not `E2E-12`: `E2E-11` says **which door you enter by**, `E2E-12` says **what you
replace at the far end** — entering the right door while mocking away the orchestrator in the middle
is still broken, and so is the reverse. Not `E2E-4`: entering the right door and then reading only
the envelope still misses the consequence.

**The half the lint holds.** `e2e-uses-production-transport` catches bus imports and direct `*Worker`
/ `*Handler` calls. Whether the flow was actually entered at the production boundary is a reader's
judgement.

**Common business situations.** A mail job retrying and exhausting its budget; GitHub membership
across three durable steps; a CDC projection catching up; an event crossing two instances; a
scheduler cleaning up expired sessions; a cache invalidated after a write.

## `E2E-12` — override the external RESULT, never the internal POLICY that chose it

**Situation.** The flow touches an external dependency: a model provider, a payment gateway, an IdP,
SMTP, a code-grading sandbox, a transcoder.

**What it emits in source.** A script over the concrete external client's own seam — its `invoke` /
`stream` function, or the gateway's HTTP call — and nothing inside it; no provider SDK is imported in
a spec.

**Recognition signs.** A mock placed on one of **your own** services: the provider selector, the
balancer, the action router, the billing path. The file importing a provider SDK directly. Fallback,
attribution, rollback and idempotency having **no remaining way** to go red. Ask: if the **internal
policy** picked the wrong provider, the wrong refund path, the wrong entitlement — would this file go
red?

**Where the seam is.** At the **concrete external client**: its `invoke` / `stream` function, or the
gateway's HTTP call. Everything **inside** that seam — key rotation, health cache, entitlement,
billing, reconciliation, action routing, entitlement grant — must be real. Forcing the external
client to **throw** is forcing an **external result**, and that is exactly how fallback is proved;
forcing the internal policy's decision about that error is not.

**Boundary.** Not `E2E-11`: see above. Not `E2E-8`: the scripted default belongs to shared
infrastructure, and a per-flow override is legitimate.

**The half the lint holds.** The rule catches only a **provider SDK import** in a spec file. Mocking
an internal orchestrator leaves no import to catch.

**Common business situations.** Fallback across several model providers; a payment-gateway webhook;
IdP token issuance; SMTP refusing then accepting; a grading sandbox timing out; a transcoding service
failing.

## Layer held

Which tier actually holds each code. `enforced` means a rule in `starci-eslint/packages/be/e2e-flow.mjs` fires on it,
and the rule is named.

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
assert, who acted — and a file's shape is not a value a type system holds. The one place a type could
help is the transport handle a flow receives, and it would still not stop a spec from resolving an
internal actor out of the container.

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
| `E2E-7` | `.claude/starci-eslint/packages/be/e2e-flow.test.mjs` → `tester.run("no-branch-in-flow-step", …)` | The valid and invalid fixtures that pin exactly which shapes count as a branch inside a step |
| `E2E-8` | `src/tests/helpers/flow-world.ts` → `bootFlowWorld`; `src/tests/helpers/create-e2e-app.ts` → `createE2eApp` | Two entry points that stand the world up, so a spec opens with what it is testing |
| `E2E-9` | `src/tests/helpers/flow-world.ts` → `FlowWorld.mintLearner(name)` | The actor factory takes a NAME and persists a fresh row per flow; no ordinal is accepted |
| `E2E-10` | `src/tests/e2e/` (84 spec files) | Zero real `console` call sites. The only two textual matches, at `coding-submission.e2e-spec.ts:550` and `:646`, are source strings INSIDE a submitted program, not logging |
| `E2E-11` | `src/tests/e2e/background-worker-resilience.e2e-spec.ts`; `src/tests/helpers/nats-cross-instance-world.ts` | Retry, exhaustion and replay proved through the real queue; a world that boots a real broker connection and the real `ScheduleModule` |
| `E2E-12` | `src/tests/helpers/ai-provider-invoke-script.ts` | A FIFO script of provider outcomes replacing only the external client, while cache, keys and the invoke path stay real |

Twelve codes, twelve anchors. None reads "not yet anchored".

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

## Rules

1. One file proves one sentence, and the filename states that sentence.
2. Steps are ordered because the business is ordered; a step may depend on the step before it.
3. Every wait is bounded by an outcome, never by a duration.
4. Every assertion reads the consequence from where the consequence lives.
5. A realtime assertion is about content and recipient, never about how many listeners existed.
6. Every flow asserts at least one absence.
7. A step asserts exactly one outcome, unconditionally.
8. The world is stood up in one place; a spec file contains no wiring of its own.
9. Actors are named and are never shared between flows.
10. A spec's only output is the step name and the assertion.
11. Internal hops stay real; only the outermost external client is scripted.

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
- **A fixed silence window (`E2E-6`).** Absence can only be measured in time, so a short, explicitly
  stated silence window is the single exception to `E2E-3`.
- **Two flows, not two branches (`E2E-7`).** When two outcomes are both legitimate business
  outcomes, they are two steps or two files. Splitting is the fix; a branch is not.

## Output

One block per spec file the accepted shape produces.

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

## Worked example

**Accepted shape.** A learner pays for a course through the payment gateway, the gateway webhook
settles, access opens for that learner, and a stranger neither receives the notification nor gains
access.

Two legitimate business outcomes are two files, not two branches (`E2E-7`), so the accepted shape
resolves to two spec files.

```text
sentence:    a learner buys a course and can then start learning
file:        course-purchase.e2e-spec.ts
entry:       graphql
steps:       place the order · gateway webhook settles the payment · enrolment opens · a stranger still has no access
consequence: the enrolment row, read through FlowWorld.entityManager on the primary datasource
actors:      buyer and stranger, both minted by name from the world's actor factory
absence:     the stranger's access must not open, and the stranger must receive no notification
scripted:    the payment gateway's own HTTP client, and nothing inside it
codes:       E2E-1 filename is the sentence · E2E-2 four named it steps in business order · E2E-3 the webhook settlement is polled under a deadline naming the awaited state · E2E-4 the enrolment row is read back, not the envelope · E2E-5 no realtime hop in this file, so nothing to open a client for · E2E-6 the stranger step proves absence · E2E-7 the pending-or-paid state is forced, not branched on · E2E-8 the world is booted by bootFlowWorld · E2E-9 buyer and stranger are named, minted here · E2E-10 no logging · E2E-11 entry through GraphQL and the real gateway webhook, no bus import, no worker resolved · E2E-12 only the gateway client is scripted; entitlement and billing stay real
```

*reason:* entry is GraphQL and the webhook is the real production door, which is what excludes
`E2E-11`'s forbidden shape — no bus is imported and no `*Worker` is resolved to move the flow along.

```text
sentence:    a notification reaches its intended recipient and nobody else
file:        notification-delivery.e2e-spec.ts
entry:       socket
steps:       both actors connect · the event is published · the recipient receives the exact payload · the stranger's socket stays silent
consequence: the delivered message on the recipient's real socket, plus the stored notification row
actors:      recipient and stranger, both minted by name from the world's actor factory
absence:     the stranger's socket must receive nothing across a short, explicitly stated silence window
scripted:    nothing external is touched by this flow
codes:       E2E-1 filename is the sentence · E2E-2 four named it steps · E2E-3 the row is polled under a deadline · E2E-4 the stored notification row is read back · E2E-5 a real client awaits the NEXT matching message and asserts content and recipient, never a count · E2E-6 the silence window proves the stranger received nothing · E2E-7 each step asserts one outcome unconditionally · E2E-8 the world is booted by bootFlowWorld · E2E-9 recipient and stranger named and minted here · E2E-10 no logging · E2E-11 entry through a real socket and the real broker, every internal hop real · E2E-12 no external seam, so nothing is scripted
```

*reason:* the consequence flies over a socket and is asserted by content and recipient, which is what
excludes `E2E-4` standing alone — the stored row is read too, because a message that is stored and
broadcast is two consequences in two places.

**What the shape does not state, and therefore does not resolve.** The accepted shape names the
promise, the actors and the boundary. It does not state the file names' exact wording, which helper
polls the settlement, the length of the silence window, which token the flow re-declares to script
the gateway client, or which fixture entry point boots the world. Those are decided here, by these
codes, and their silence in the shape releases no code — `E2E-6` in particular is answered by writing
the absence step, never by concluding the shape did not ask for one.

## Scope

This module states a rule true of any back end that has a flow lane. Examples are ordinary
TypeScript shaped like a framework test: a `describe`, ordered `it` steps, an entity manager, a
queue, a socket. It names no product, no repository and no private module. Where the source law
named an internal service by its own name, this module names the ROLE that service plays, because a
role transfers and a name does not.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood — never an identifier
somebody will read in a failure and have to look up.
