# uat run — <feature>/<flow> — <runId>

The working sheet for one run, written under `runs/<runId>/` once, at the end, under the exclusive
lease, and never edited afterwards. A second attempt is a new `runId`.

This is a working sheet. The published receipt follows `templates/kinds/uat-flow-verification.contract.json` and its skeleton, including every required section; working detail stays in the run record.

## Admission

| Kind | Ref | Commit |
| --- | --- | --- |
| `frontend-surface-audit` | `<step-n/parallel-n/response/response.md>` | `<40 hex>` |
| `quality-verification` | `<step-n/parallel-n/response/response.md>` | `<the same 40 hex>` |

## Snapshot

| Field | Value |
| --- | --- |
| Run | `<runId>` |
| Approval | `<authenticated sign-in authority; — for anonymous>` |
| Feature | `<feature>` |
| Flow | `<flow>` |
| Commit | `<40 hex>` |
| Snapshot | `<.worktrees/uat/<feature>/<flow>/snapshot.json>` |
| Namespace | `uat-<runId>` |
| Accounts | `<authenticated aliases; — for anonymous>` |
| Environment | `<env>` |
| Credential | `<authenticated sealed reference resolved only at login; — for anonymous>` |
| Flow source | `<the bound uat.plan flow reference>` |
| Golden | `<approved \| candidate>` |
| Run record | `<.worktrees/uat/<feature>/<flow>/runs/<runId>/result.json>` |
| Latest | `<runId>` |

## Cases

| Case | Order | Assertions | Capture | Screenshot | Outcome |
| --- | --- | --- | --- | --- | --- |
| `<case-id>` | 1 | `<assertion ids, comma separated>` | `response/data/captures/<case-id>.json` | `response/artifacts/<case-id>.png` | `<pass \| fail>` |

## Steps

One row per step the run actually performed, in execution order. `Time` is the measured wall time from
the activation to the observed change, and it is the evidence `UX-4` is scored on. The login field is
masked in every screenshot this table points at.

| # | Case | Action | Expected | Evidence | UX ids measured | Result | Time |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `<case-id>` | `<what was done, from a visible label>` | `<the observable change or record>` | `response/artifacts/<case-id>-1.png` | `<e.g. UX-4, UX-8>` | `<pass \| fail>` | `<ms>` |

A step that could not be performed is not a fail: it is recorded with result `unavailable` and stops
the run at the operator's own stop code, because charging unavailability as a failure blames a product
nobody observed.

## UX scores

The `ux` lane of this run, scored under `UX-12`. Every score names the step or capture behind it; a
score with no measurement is void and leaves the lens incomplete.

| Rule | Score | Fail | Measurement | Route on fail |
| --- | --- | --- | --- | --- |
| `UX-1` | `<1-5>` | `<yes \| no>` | `<step # or capture ref>` | flow owner |
| `UX-2` | `<1-5>` | `<yes \| no>` | `<steps counted against the flow budget>` | direction |
| `UX-3` | `<1-5>` | `<yes \| no>` | `<step # of the deliberate wrong input>` | direction |
| `UX-4` | `<1-5>` | `<yes \| no>` | `<the slowest step's measured time>` | direction |
| `UX-5` | `<1-5>` | `<yes \| no>` | `<navigation levels counted>` | direction |
| `UX-6` | `<1-5>` | `<yes \| no>` | `<the states captured and their exits>` | direction |
| `UX-7` | `<1-5>` | `<yes \| no>` | `<the back, refresh and deep-link steps>` | flow owner |
| `UX-8` | `<1-5>` | `<yes \| no>` | `<the keyboard and autofill passes>` | direction |
| `UX-9` | `<1-5>` | `<yes \| no>` | `<the narrow-viewport capture>` | direction |
| `UX-10` | `<1-5>` | `<yes \| no>` | `<the surfaces compared>` | direction |
| `UX-11` | `<1-5>` | `<yes \| no>` | `<the captures read>` | flow owner |
| Verdict | `<mean>` | — | `ship` requires no fail on `UX-1`, `UX-3`, `UX-4`, `UX-6`, `UX-7` and a mean of at least 4 | — |

This verdict is the `experience` row of the receipt's `## Verdict` table, copied and never rescored.

## Lanes

| Lane | Verdict | Evidence |
| --- | --- | --- |
| `behavior` | `<pass \| fail>` | `<capture or store ref>` |
| `ux` | `<pass \| fail>` | `<the UX scores section and the captures behind it>` |
| `ui` | `<pass \| fail>` | `response/artifacts/sheet.png` |

## Fallbacks taken

| Code | Action |
| --- | --- |
