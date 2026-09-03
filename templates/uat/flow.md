# uat flow — <feature>/<flow>

The flow document `uat.verify` freezes at step 4. One flow directory holds exactly this file,
`account.json`, `seed/`, the append-only `runs/<runId>/` history and the `latest` pointer. Nothing
here is a secret: the credential is named, never written.

Replace every `<placeholder>`. A field this template leaves unanswered is `INVALID_INPUT` at the gate,
not a default the operator invents.

## Goal

One sentence naming what a person came here to get done, in their words. This is the sentence `UX-1`
is measured against: the run reaches it or it does not.

## Budgets

| Budget | Value | Why |
| --- | --- | --- |
| Steps | `<n>` | The committed steps a person may spend: each navigation, submission or confirmation. Measured by `UX-2`; if omitted, the class band `UX-2` Case 2 publishes applies and the receipt must say which one |
| Time | `<n>s` | First activation to terminal assertion. Measured by `UX-1` Case 4 |
| Surface class | `<console \| form \| landing \| catalog \| reader>` | The vocabulary `COVERAGE-1` Case 7 publishes; each proof topic reads its own band from it. A flow declaring no class is `blocked` before scoring |
| Viewports | `<e.g. 390x844, 1440x900>` | Every viewport the run captures; must be a subset of the direction's coverage matrix |

## Cases

Frozen in this order. `caseId` is lower-case and hyphenated, and every case names its assertions.

| Order | Case | Entry | Steps | Terminal assertion | Lanes asserted |
| --- | --- | --- | --- | --- | --- |
| 1 | `<case-id>` | `<the surface and state the case starts from>` | `<n>` | `<the observable end state, in the store and on screen>` | `behavior`, `ux`, `ui` |

## Assertions

One row per named assertion. `assertionId` is referenced by the capture record, so it never changes
once a run has cited it.

| Assertion | Case | Lane | What is observed | Rule ids measured |
| --- | --- | --- | --- | --- |
| `<assertion-id>` | `<case-id>` | `<behavior \| ux \| ui>` | `<the exact evidence: a record, a rendered element, a measured duration>` | `<e.g. UX-1, UX-4>` |

## Alternate paths

Every branch the flow declares — a decline, a cancellation, a retry, a permission refusal. `UX-1`
Case 3 requires each one to reach a named terminal assertion, and `UX-6` requires each state it passes
through to offer a next action or a way back.

| Branch | Triggered by | Terminal assertion |
| --- | --- | --- |
| `<branch-id>` | `<the deliberate condition the run creates>` | `<the observable end state>` |

## Fixtures

What `seed/` must place before the run, and what the run itself creates. A seed may never create the
outcome under test.

| Record | Source | Created by | Namespaced |
| --- | --- | --- | --- |
| `<record>` | `<seed file or the run>` | `<seed \| run>` | `is_uat=true`, `uat-<runId>` |

## Cleanup

Names exactly the namespace this flow's runs write, so step 9 can delete that and nothing else. Run
records under `runs/` are history and are never deleted.
