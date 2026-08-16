---
id: be-patterns-testing-index
title: INDEX.md
slug: /be/patterns/testing
sidebar_label: testing
sidebar_position: 0
description: Binding rules for which lane a back-end test belongs to and what it is allowed to assert.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `testing`

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
of the eleven codes have a lint rule behind them; the other six have only a reader, and the
`Tầng giữ` table below says which is which rather than implying uniform enforcement.

## Situation Codes

Every situation this module governs carries a code, `TESTING-<n>`. The numbers are FIXED: they are
cited from sibling laws and from historical task records, so a renumber silently breaks a citation
somebody already made.

| Code | What it requires | What it forbids |
|---|---|---|
| `TESTING-1` | An e2e is one business flow, and the file is named for that flow | A file named for a resolver group (`*-queries`), or one flow split into a test per endpoint |
| `TESTING-2` | The assertion is the consequence: a row, a balance, an entitlement, an emitted event | Asserting only `status`, `__typename` or the shape of the response envelope |
| `TESTING-3` | The test enters through the transport production enters through, and polls an async step until it settles | Calling `CommandBus`, `QueryBus`, a handler, resolver or worker method; asserting an async result on the next line; testing a realtime flow over HTTP alone |
| `TESTING-4` | The happy path is the subject; an unhappy path earns an e2e only by dragging a critical flow behind it | An e2e whose whole subject is a validation error |
| `TESTING-5` | A unit spec covers every branch that can change the outcome, boundaries included | Treating executed lines as covered decisions |
| `TESTING-6` | A spec asserts what came back or what changed | A spec whose every assertion is `toHaveBeenCalled*` |
| `TESTING-7` | The lane is declared by filename suffix: `*.spec.ts`, `*.int-spec.ts`, `*.e2e-spec.ts`, `*.harness-spec.ts` | Inferring a lane from which folder somebody filed the file in |
| `TESTING-8` | A configured lane has tests, or it is deleted | A scripted lane that passes because it found nothing |
| `TESTING-9` | A flow through a model keeps transport, orchestration, quota and persistence real, and replaces only the external provider result — with realistic JSON, by default | A real model call in an e2e; a stub returning a marker string; a stub each flow author must remember to install |
| `TESTING-10` | A harness imports one approved provider SDK, supplies a provider-issued server API key, names the model and endpoint, and calls for real — one or two cases per capability | Reaching the provider through a tier, catalog, fallback chain, key pool or house wrapper; providing or overriding the production AI gateway; authenticating with a consumer or CLI credential; growing a case per edge |
| `TESTING-11` | A demo seed writes source records for a varied cohort and invalidates derived projections so production read paths rebuild them | Seeding one all-zero account; pinning screenshot-shaped JSON; assuming one hard-coded identity is the signed-in reader |

Eleven codes, and it ends at eleven. A new situation that genuinely has no code is a rule change
recorded in `changelog.md`, not a twelfth number added in passing.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes
the wrong value impossible to write; `enforced` means a lint rule in
[`sources/be/testing.mjs`](../../../sources/be/testing.mjs) catches it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | What holds it |
|---|---|---|
| `TESTING-1` | `documented` | — |
| `TESTING-2` | `enforced` | `e2e-asserts-persisted-state` (export `e2eAssertsPersistedState`) |
| `TESTING-3` | `enforced` | `e2e-uses-production-transport` (export `e2eUsesProductionTransport`) |
| `TESTING-4` | `documented` | — |
| `TESTING-5` | `documented` | — |
| `TESTING-6` | `enforced` | `no-call-only-spec` (export `noCallOnlySpec`) |
| `TESTING-7` | `documented` | — |
| `TESTING-8` | `documented` | — |
| `TESTING-9` | `enforced` | `no-model-call-in-e2e` (export `noModelCallInE2e`) |
| `TESTING-10` | `enforced` | `harness-calls-provider-directly` (export `harnessCallsProviderDirectly`) |
| `TESTING-11` | `documented` | — |

**Five enforced, six documented, none unrepresentable.** The gap is the point of this table. A test
lane is a property of a whole file, not of a value, so no closed union can make the wrong shape
unwritable — a spec is legal TypeScript whether it asserts a consequence or an envelope. Every code
in the `documented` row is named again in `audit.md` under "Rủi ro còn mở", with what a rule would
have to see in order to hold it.

The enforced rows are enforced at `error` with a burn-down already finished; the counts the plugin
measured against the reference repository live in the `recommended` block of the rule file, not
here, because a measurement ages and a law does not.

## Anchor

Real code each law can be checked against. A law that cannot be pointed at is a proposal.

| Code | Anchor | What to look for |
|---|---|---|
| `TESTING-1` | `src/tests/e2e/course-purchase.e2e-spec.ts` · `src/tests/e2e/rewards-queries.e2e-spec.ts` | The first filename is a business sentence; the second is a resolver group wearing a test's clothes, and is the shape this code refuses. Both are live |
| `TESTING-2` | `sources/be/testing.mjs` → `STATE_READERS` · any file under `src/tests/e2e/` reading through `entityManager` | The identifiers the rule accepts as evidence that state was read back, and a flow that actually reads it |
| `TESTING-3` | `src/tests/helpers/flow-world.ts` · `src/tests/helpers/flow-wait.ts` | The world enters over GraphQL through a real HTTP client; the wait helpers replace `sleep` with a deadline plus a predicate |
| `TESTING-4` | `src/tests/e2e/course-refund.e2e-spec.ts` · `src/tests/e2e/community-concurrency.e2e-spec.ts` | Two unhappy paths that earn a flow: a reversal that must run, and a race a constraint must catch |
| `TESTING-5` | `src/features/api/processors/ai/score-uploaded-cv/enqueue-score-uploaded-cv.service.spec.ts` | A branch table driven by `it.each`, one row per outcome-changing case rather than one case in the middle of the range |
| `TESTING-6` | `sources/be/testing.mjs` → `CALL_MATCHERS`, `matcherOf` | The nine matchers counted as call assertions, and the member-chain climb that makes `.not` and `.resolves` pass through |
| `TESTING-7` | `jest.config.ts` → `testPathIgnorePatterns` · `src/tests/e2e/jest-e2e.json` → `testRegex` · `src/tests/harness/jest-harness.json` → `testRegex` | Three configs discriminating on suffix alone, which is what lets the lanes share a folder without the fast run picking them up |
| `TESTING-8` | `package.json` → `test:int`, `test:ci` | Both carry `--passWithNoTests`. That flag is exactly the failure mode this code names, so it is the anchor a reader checks the lane's file count against |
| `TESTING-9` | `src/tests/helpers/flow-world.ts` → the default `AiInvokeService` stub | The stub is installed by the world, returns well-formed JSON rather than a marker, and is a jest mock a flow can reprogram per step |
| `TESTING-10` | `src/tests/helpers/harness-credentials.ts` · `src/tests/harness/` | One required process-only credential per authority, with no file, OAuth, key-pool or sibling-variable fallback, and a separate variable for the judge |
| `TESTING-11` | `scripts/seed-dashboard-test-data.mjs` · `scripts/seed-profile-test-data.mjs` | The seed writes source rows and then invalidates derived projections, and takes the inspected account as an argument rather than pinning one identity |

Every code is anchored. None reads `chưa neo được`.

## Inputs

| Input | Evidence required |
|---|---|
| question | Does the business run · does this decision come out right · is the model's answer acceptable |
| lane | The filename suffix the answer implies |
| entry | The transport production uses for this flow |
| consequence | The row, balance, entitlement or event that proves the flow happened |
| branches | Every input class that can change the outcome, boundaries included |
| externals | What leaves the process, and what is therefore stubbed or really called |

## Invariants

- One e2e file is one business flow, and the filename is that flow.
- An assertion names a consequence, not an envelope.
- An e2e enters where production enters and waits on state, never on a timer.
- A lane is declared by suffix and by nothing else.
- A configured lane either holds tests or does not exist.
- Only the harness lane pays a provider; only the harness lane calls one directly.
- A stub of a model returns a payload the production parser can actually parse.
- Every test file resolves to exactly one code. No lane is out of scope.

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

## Output

```text
file: <path>
lane: <unit | integration | e2e | harness>
situation: <TESTING-1 … TESTING-11>
entry: <graphql | http | socket | broker | scheduler | in-process>
consequence: <the row, balance, entitlement or event asserted>
reason: <the business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.
`changelog.md` is read when a version marker disagrees with what a record says.

## Scope

This module states a rule true of any back end that runs flows over a transport and decisions inside
handlers. Examples are ordinary TypeScript in a NestJS-shaped application: they name no product, no
repository and no course. The lane suffixes and the rule ids are the only proper nouns, because they
are the enforcement identity and a renamed rule cannot be cited in a config.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
Adding, removing or renumbering a `TESTING-<n>` code is a major change, not an increment.
