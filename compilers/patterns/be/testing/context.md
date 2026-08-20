# Testing

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-be` | `@starci/eslint-canon-be` | npm package | the published backend machine this record cites |

## Record

The input is a shape that has already been accepted: a flow that was agreed on, a handler whose
branches were settled, a capability whose provider was chosen, a demo world somebody signed off. This
pattern does not re-open any of that. It lands it in source: which file holds the test, which lane
that file declares, what door it enters through, what it is allowed to assert, and what it is named.

## Law

A test is bought with the question it answers. An **e2e** answers *does the business run?* — one
flow, start to finish, the way state and money actually move. A **unit spec** answers *does this
decision come out right?* — one branch, with nothing real behind it. A **harness** answers *is the
model's answer acceptable?* — the only lane that pays a provider.

The question that settles which lane a test belongs to is not what it touches but what it would
miss: **could this break in production without the test noticing?** If the answer is yes, the test
is not covering the thing it appears to cover — and for a flow, that almost always means it asserted
the response instead of the consequence.

**This is binding, not advisory.** Every test file in the repository sits in exactly one lane and
carries exactly one shape obligation. There is no size at which a spec is too small to have a code:
a three-line branch table is `TESTING-5` for the same reason a checkout-to-entitlement flow is
`TESTING-2`. "It is only a small spec" is where this rule gets skipped most often.

Most of this law is not machine-checkable, which is exactly why it is written this carefully. Five
of the eleven codes have a lint rule behind them; the other six have only a reader, and the layer
table below says which is which rather than implying uniform enforcement.

## Situation codes

Every situation this module governs carries a code, `TESTING-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | Situation | What the source must look like |
|---|---|---|
| `TESTING-1` | A file for one business flow is being named | An e2e is one business flow, and the file is named for that flow. It forbids a file named for a resolver group (`*-queries`), or one flow split into a test per endpoint |
| `TESTING-2` | The flow ran and something must prove it happened | The assertion is the consequence: a row, a balance, an entitlement, an emitted event. It forbids asserting only `status`, `__typename` or the shape of the response envelope |
| `TESTING-3` | The flow has a production door and an async step | The test enters through the transport production enters through, and polls an async step until it settles. It forbids calling `CommandBus`, `QueryBus`, a handler, resolver or worker method; asserting an async result on the next line; testing a realtime flow over HTTP alone |
| `TESTING-4` | A failure branch is looking for a lane | The happy path is the subject; an unhappy path earns an e2e only by dragging a critical flow behind it. It forbids an e2e whose whole subject is a validation error |
| `TESTING-5` | A handler has several ways out | A unit spec covers every branch that can change the outcome, boundaries included. It forbids treating executed lines as covered decisions |
| `TESTING-6` | A spec has run the handler and is choosing what to check | A spec asserts what came back or what changed. It forbids a spec whose every assertion is `toHaveBeenCalled*` |
| `TESTING-7` | A test file is being placed | A unit test is colocated beside its owner as `*.spec.ts`. Only backend E2E may live in a separate test tree as `*.e2e-spec.ts`; integration and harness keep explicit suffixes. Unit buckets and generic `.test.` names are forbidden |
| `TESTING-8` | A lane is configured, scripted and in CI | A configured lane has tests, or it is deleted. It forbids a scripted lane that passes because it found nothing |
| `TESTING-9` | A flow passes through a model | A flow through a model keeps transport, orchestration, quota and persistence real, and replaces only the external provider result — with realistic JSON, by default. It forbids a real model call in an e2e; a stub returning a marker string; a stub each flow author must remember to install |
| `TESTING-10` | The subject is the model's own answer | A harness imports one approved provider SDK, supplies a provider-issued server API key, names the model and endpoint, and calls for real — one or two cases per capability. It forbids reaching the provider through a tier, catalog, fallback chain, key pool or house wrapper; providing or overriding the production AI gateway; authenticating with a consumer or CLI credential; growing a case per edge |
| `TESTING-11` | A local world is needed to inspect real product state | A demo seed writes source records for a varied cohort and invalidates derived projections so production read paths rebuild them. It forbids seeding one all-zero account; pinning screenshot-shaped JSON; assuming one hard-coded identity is the signed-in reader |

Eleven codes, and it ends at eleven. A new situation that genuinely has no code is a rule change
recorded as such, not a twelfth number added in passing.

## Reading an accepted shape

1. Read what the shape states: the business flow, the decision, the capability or the demo world
   that was accepted. That is the input, and it is not up for renegotiation here.
2. Read what the shape does not state. A shape naming a flow does not say which door it enters,
   which consequence proves it, or which branches deserve their own spec. What it does not state, it
   does not resolve — leave those open rather than inventing them.
3. Resolve outermost first: the question the test answers, then the lane that question implies, then
   the suffix that declares the lane, then the entry, then the assertion.
4. Ask each code's own question in turn. `TESTING-1`: is the honest name of this file a sentence
   about the business? `TESTING-2`: if the storage layer silently stopped writing, would this file
   go red? `TESTING-3`: are production's guards, pipes and serializers inside this test's scope?
   `TESTING-4`: when this step fails, is there a *second* thing that must also happen?
   `TESTING-5`: which branches can change the outcome, and does each have its own case?
   `TESTING-6`: if I replace a business value with a wrong one, does this file go red?
   `TESTING-7`: from the filename alone, do I know which run it belongs to?
   `TESTING-8`: if this lane held exactly zero files, would anybody know?
   `TESTING-9`: am I proving quota, entitlement, parser and persistence — or the model's prose?
   `TESTING-10`: is the thing under test the thing that will ship?
   `TESTING-11`: if I drop the projection and let the real handler rebuild it, does the screen still
   look right?
5. When two codes both match, they are usually not competing — they hold different parts of the same
   file, and both apply. A correct filename does not rescue an envelope assertion: `TESTING-1` and
   `TESTING-2` fail independently. A correct entry does not rescue a wrong assertion target:
   `TESTING-3` says which door and how to wait, `TESTING-2` says where to look once you arrive. When
   two codes describe the same illness in different lanes — `TESTING-6` for a spec that only asserts
   the call, `TESTING-2` for a flow that only asserts the reply — the lane decides which one is
   cited. When two codes point in opposite directions, that asymmetry is deliberate: in an e2e a
   real model call is wrong, and in a harness a stub is wrong.

## `TESTING-1` — one e2e file is one business story

**Situation.** You are about to name a flow file. That name decides what the file will hold for the
next two years, because whoever comes next adds tests that the name permits.

**What it emits in source.** One `*.e2e-spec.ts` file per business flow, under the e2e folder, whose
basename is that flow written as a business sentence.

**Boundary.** Not `TESTING-4`: this code says what the file **is**, `TESTING-4` says which
**branches** it may hold, and a correctly named file can still hold the wrong branch. Not
`TESTING-7`: that code only governs the suffix, and a correct suffix cannot rescue a wrongly shaped
name. Not `TESTING-2`: a correct name that asserts the envelope is still broken — the two fail
independently.

## `TESTING-2` — assert the consequence, not the envelope

**Situation.** The flow has finished. Now it must prove **something changed in the world**, not that
the server is still alive.

**What it emits in source.** A read-back inside the flow file, through `entityManager`, `dataSource`,
`getRepository` or `queryRunner`, naming the row, balance, entitlement or event the flow produced.

**Boundary.** Not `TESTING-3`: that code says **which door you enter and how you wait**, this one
says **where you look once you have arrived** — entering the right door and looking in the wrong
place is still a `TESTING-2` violation. Not `TESTING-6`: same illness in two lanes — `TESTING-6` is a
spec that only asserts the call, `TESTING-2` is a flow that only asserts the reply.

## `TESTING-3` — the test travels the road the flow travels

**Situation.** In production the flow enters over GraphQL, HTTP, socket, message broker or scheduler.
The test must enter through that same door.

**What it emits in source.** A flow that goes through the shared world helper — a real HTTP client
over the production transport — and, for every async step, a wait built from a deadline plus a
predicate rather than a `sleep`.

**Boundary.** Not `TESTING-2`: see above. Not the integration lane: `commandBus.execute(...)` is
**not** itself bad — it is a legitimate citizen of `*.int-spec.ts`. The violation is using it **in
the e2e lane**.

## `TESTING-4` — the happy path is the subject

**Situation.** You have a failure branch and are deciding which lane it belongs to.

**What it emits in source.** Either an e2e file of its own, named for its own story, when the failure
drags a critical flow behind it; or a case inside a unit spec when it does not.

**Boundary.** Not `TESTING-5`: a validation error is a **decision**, and it belongs to `TESTING-5`,
where it costs a few milliseconds instead of a database. Not `TESTING-1`: a qualifying failure branch
still has to live in a file named for its own story, not tucked into the happy-path flow.

## `TESTING-5` — cover decision branches, not lines

**Situation.** A handler has several ways out, and you are writing its spec.

**What it emits in source.** A `*.spec.ts` next to the handler holding a branch table — typically
`it.each` — with one row per outcome-changing case rather than one case in the middle of the range.

**Boundary.** Not `TESTING-4`: `TESTING-5` is where every failure branch that drags nothing behind it
comes to rest. Not `TESTING-6`: `TESTING-5` says **how many cases**, `TESTING-6` says **what a case
asserts** — enough cases that all assert calls still prove nothing.

## `TESTING-6` — a spec that only asserts calls is a copy of the source

**Situation.** The spec runs the handler, checks that a collaborator was called, and stops there.

**What it emits in source.** At least one assertion per file about a returned value or a changed
state; a call assertion may stand beside it, never alone.

**Boundary.** Not `TESTING-2`: same illness, different lane. Not the permitted exception: when the
call **is itself the observable effect** — mail sent, event published — the call assertion is a
**second** assertion standing next to one about a result.

## `TESTING-7` — the lane lives in the suffix, not in the folder

**Situation.** You are placing a test file next to the code it checks, and the fast lane must stay
fast.

**What it emits in source.** A unit file beside its production owner named `*.spec.ts`. Integration and
harness keep their explicit suffixes. Only backend E2E may be separated under the declared E2E tree as
`*.e2e-spec.ts`; a unit bucket such as `src/tests` or `test/unit` is invalid.

**Boundary.** Not `TESTING-8`: `TESTING-7` says how a lane is **declared**, `TESTING-8` says how a
declared lane must actually **exist**. Not `TESTING-1`: a correct suffix cannot fix the part of the
name in front of it.

## `TESTING-8` — an empty lane is not a green lane

**Situation.** A lane is configured, has a script, sits in CI — and no file matches it.

**What it emits in source.** Either files that the lane's `testRegex` actually matches, or the
removal of the lane's script and config.

**Boundary.** Not `TESTING-7`: see above. And the "pass when empty" flag is **not** by itself a
violation. The violation is that flag plus a genuinely empty lane, because then the green is a claim
about coverage with nothing standing behind it.

## `TESTING-9` — an e2e never calls a model

**Situation.** A flow passes through a model: cited question answering, grading, CV generation,
summarising.

**What it emits in source.** A default provider stub installed by the shared world helper, returning
well-formed JSON the production strict parser can actually parse, and reprogrammable per step by the
flow — with everything else in the flow kept real.

**answers differently every time**; all three are fatal in a flow suite. The assertions have to be
loosened until they survive different phrasings, at which point they catch nothing. The stub returns
`"stubbed"`, `"ok"`, `"test"` ⇒ the strict-JSON parser **never runs**, and the parser is exactly the
most fragile point: it is where model output meets the schema. The stub is one each flow author must
remember to install ⇒ the law depends on memory.

**Boundary.** Not `TESTING-10`: the two lanes run **in opposite directions**. In an e2e a real call
is wrong; in a harness a simulation is wrong, because the harness's subject is precisely the model's
real answer. Not an escape from `TESTING-2`: once stubbed, the rest of the flow must still assert the
consequence.

## `TESTING-10` — the harness calls the provider directly, and stays small

**Situation.** You need to know whether the model's answer **is acceptable**. That is the only
question this lane answers.

**What it emits in source.** A `*.harness-spec.ts` importing one approved provider SDK, reading one
required process-only credential per authority — no file, OAuth, key-pool or sibling-variable
fallback — naming the model and endpoint, and holding one or two cases per capability.

**invent** metadata about provider, tokens and cost. The credential is a CLI's OAuth, a chat app's
session, or a profile file ⇒ that is not a provider-issued server API key, and it proves no deployed
right. The harness grows a case per edge ⇒ billed per call ⇒ eventually nobody runs it, and a stale
green still hangs on the board.

**Boundary.** Not `TESTING-9`: see above. The asymmetry is deliberate and must be preserved — an e2e
keeps everything real **except** the provider result; a harness really calls the provider but
**only** proves prompt, model and parser quality. And the harness is **not** a substitute for flow
coverage: it knows nothing about quota, entitlement or persistence.

## `TESTING-11` — a demo seed builds a world, not a screenshot

**Situation.** A local environment is needed so a reader can **inspect real product state through
production's own read path**.

**What it emits in source.** A seed script that writes source rows for a varied cohort, invalidates
the derived projections so production read paths rebuild them, and takes the inspected account as an
argument.

**Boundary.** Not `TESTING-2`: the same spirit of "read it back where the real state lives", but
`TESTING-11` applies to a demo environment rather than to an assertion. And empty states **still**
deserve seeding; what is refused is a world in which everything is empty.

## Layer held

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a lint rule in `@canon-be` catches it;
`documented` means nothing mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TESTING-1` | `documented` | — |
| `TESTING-2` | `enforced` | `e2e-asserts-persisted-state` (export `e2eAssertsPersistedState`) |
| `TESTING-3` | `enforced` | `e2e-uses-production-transport` (export `e2eUsesProductionTransport`) |
| `TESTING-4` | `documented` | — |
| `TESTING-5` | `documented` | — |
| `TESTING-6` | `enforced` | `no-call-only-spec` (export `noCallOnlySpec`) |
| `TESTING-7` | `enforced` | `unit-test-colocated` (export `unitTestColocated`) |
| `TESTING-8` | `documented` | — |
| `TESTING-9` | `enforced` | `no-model-call-in-e2e` (export `noModelCallInE2e`) |
| `TESTING-10` | `enforced` | `harness-calls-provider-directly` (export `harnessCallsProviderDirectly`) |
| `TESTING-11` | `documented` | — |

**Six enforced, five documented, none unrepresentable.** The gap is the point of this table. A test
lane is a property of a whole file, not of a value, so no closed union can make the wrong shape
unwritable — a spec is legal TypeScript whether it asserts a consequence or an envelope. Every code
in the `documented` row is an open risk, and it is recorded as one, together with what a rule would
have to see in order to hold it.

The enforced rows are enforced at `error` with a burn-down already finished; the counts the plugin
measured against the reference repository live in the `recommended` block of the rule file, not here,
because a measurement ages and a law does not.

## Inputs

| Input | Evidence required |
|---|---|
| question | Does the business run · does this decision come out right · is the model's answer acceptable |
| lane | The filename suffix the answer implies |
| entry | The transport production uses for this flow |
| consequence | The row, balance, entitlement or event that proves the flow happened |
| branches | Every input class that can change the outcome, boundaries included |
| externals | What leaves the process, and what is therefore stubbed or really called |

## Rules

1. One e2e file is one business flow, and the filename is that flow.
2. An assertion names a consequence, not an envelope.
3. An e2e enters where production enters and waits on state, never on a timer.
4. A unit is colocated beside its owner and declared by `.spec.`; only backend E2E may occupy a separate test tree.
5. A configured lane either holds tests or does not exist.
6. Only the harness lane pays a provider; only the harness lane calls one directly.
7. A stub of a model returns a payload the production parser can actually parse.
8. Every test file resolves to exactly one code. No lane is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Call assertion as a second assertion.** `TESTING-6` permits `toHaveBeenCalledWith` when the call
  itself is the observable effect — mail sent, event published — and something else in the file
  asserts a result. The rule fires only when a whole file has nothing else.
- **A flow with no persisted consequence.** `TESTING-2` is satisfied by a documented disable naming
  what the flow observes instead. A flow that cannot name one is not exempt; it is unfinished.
- **Unhappy path in the flow lane.** `TESTING-4` admits an unhappy path when failing sets off
  something that must also be right: a reversal, an idempotency guard, a constraint under a race.
- **Deliberate provider opt-out.** `TESTING-9` stubs by default; reaching a provider from a flow is
  an explicit, reviewed opt-out and not a thing a flow author quietly arranges.
- **Judge tuple.** `TESTING-10` allows a second live model as a judge, provided it declares its own
  provider, model, endpoint and key. Neither subject nor judge inherits the other's tuple.
- **Empty-state fixtures.** `TESTING-11` still wants empty states seeded. What it refuses is a world
  in which every state is empty.
- **`commandBus.execute(...)` outside the e2e lane.** It is a legitimate citizen of the integration
  lane; a `TESTING-3` violation happens only inside `*.e2e-spec.ts`.

## Output

One block per file the accepted shape produces.

```text
file: <path>
lane: <unit | integration | e2e | harness>
situation: <TESTING-1 … TESTING-11>
entry: <graphql | http | socket | broker | scheduler | in-process>
consequence: <the row, balance, entitlement or event asserted>
reason: <the business fact that excludes the adjacent code>
```
