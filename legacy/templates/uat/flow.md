# uat flow — <feature>/<flow>

The flow document `uat.plan` prepares and `uat.verify` binds unchanged. `README.md` beside this file is the contract for
the whole folder — `accounts.<env>.json`, `seed/`, `snapshots/`, the append-only `runs/<runId>/`
history, `latest.json` and `history.md` — and this document describes the planned journey. Nothing here
is a secret: a credential is named, never written.

Replace every `<placeholder>` during planning. The machine case sheet freezes the access, fixtures and sourceRoles modes; verification refuses missing plan material.

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

| Order | Case | As | Entry | Steps | Terminal assertion | Lanes asserted |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `<case-id>` | `<alias>` | `<the surface and state the case starts from>` | `<n>` | `<the observable end state, in the store and on screen>` | `behavior`, `ux`, `ui` |

`As` is `anonymous` for anonymous access, otherwise one provisioned alias of `accounts.<env>.json`, as required by the frozen machine case sheet.

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

For seeded mode, name the planned prerequisites and what the run itself creates; seed may never create the asserted outcome. For fixtures=none, record none, matching the null machine fixture.

| Record | Source | Created by | Namespaced |
| --- | --- | --- | --- |
| `<record>` | `<seed file or the run>` | `<seed \| run>` | `is_uat=true`, `uat-<runId>` |

## Steps

One row per step the run performs, in order. `As` names the alias acting; `Evidence` names what the
run captures at that step, and capture begins only after a sign-in redirect has landed.

| # | As | Action | Expected | Evidence | UX ids measured |
| --- | --- | --- | --- | --- | --- |
| 1 | `<alias>` | `<what is done, from a visible label>` | `<the observable change or record>` | `steps/<NN-slug>/capture-<viewport>-<scheme>.png` | `<e.g. UX-4, UX-8>` |

## Cleanup

For seeded mode, name the exact receipt-owned rollback set handed to `data.seed`. For fixtures=none, record none. Verification performs no data mutation; run records are never deleted.
