# uat-flow-verification — enrollment/paid-enrollment

One paragraph: who asked for this run, which flow it verified at which commit, and what the three
lanes independently concluded. Written by `uat.verify` as `response/response.md`. The shared UAT
password never appears here, in a capture, in a run record or in a log: the credential is named, and
the login field is masked in every screenshot.

## Admission

| Kind | Ref | Commit |
| --- | --- | --- |
| `frontend-surface-audit` | `step-1/parallel-1/response/response.md` | `1111111111111111111111111111111111111111` |
| `quality-verification` | `step-2/parallel-1/response/response.md` | `1111111111111111111111111111111111111111` |

## Snapshot

| Field | Value |
| --- | --- |
| Run | `run-2026-01-10-1` |
| Requested by | the product owner, in the session that opened this run |
| Feature | `enrollment` |
| Flow | `paid-enrollment` |
| Commit | `1111111111111111111111111111111111111111` |
| Snapshot | `.worktrees/uat/enrollment/paid-enrollment/snapshot.json` |
| Namespace | `uat-run-2026-01-10-1` |
| Accounts | `learner` |
| Environment | local |
| Credential | `.stacks/local/secrets/uat.enc`, resolved by name at login only |
| Flow source | drafted-from-template |
| Golden | candidate, awaiting a person's approval |
| Run record | `.worktrees/uat/enrollment/paid-enrollment/runs/run-2026-01-10-1/result.json` |
| Latest | `run-2026-01-10-1` |

## Cases

| Case | Order | Assertions | Capture | Screenshot | Outcome |
| --- | --- | --- | --- | --- | --- |
| `pay-and-enrol` | 1 | entry, commitment, terminal | `response/data/captures/pay-and-enrol.json` | `response/artifacts/pay-and-enrol.png` | pass |

## Lanes

| Lane | Verdict | Evidence |
| --- | --- | --- |
| `behavior` | pass | `response/data/captures/pay-and-enrol.json` |
| `ux` | pass | `response/data/captures/pay-and-enrol.json` |
| `ui` | pass | `response/artifacts/sheet.png` |

## Experience

| Rule | Measured | Score | Verdict |
| --- | --- | --- | --- |
| `UX-1` | the run reached the terminal assertion and the store holds the record it names | 5 | pass |
| `UX-2` | four committed steps against the flow's declared budget of five | 4 | pass |
| `UX-3` | the wrong value was corrected at its own field and the flow finished two steps later | 4 | pass |
| `UX-4` | the pressed treatment rendered in 60ms; the pending indicator held the initiator | 4 | pass |
| `UX-5` | the destination sat one navigation level from entry, and the three place signals agreed | 5 | pass |
| `UX-6` | every state the run reached offered a next action or a way back | 4 | pass |
| `UX-7` | back, reload and a fresh session each returned the same step with its values | 4 | pass |
| `UX-8` | every field kept a visible label; tab order equalled reading order | 4 | pass |
| `UX-9` | the primary action sat in the lower half at the narrowest declared viewport | 4 | pass |
| `UX-10` | one verb per action across both surfaces of the run | 4 | pass |
| `UX-11` | labels named the things, controls named the effects, no stub copy survived | 4 | pass |

- Mean: 4.18
- Verdict: ship

## Verdict

| Topic | Verdict | Route |
| --- | --- | --- |
| `experience` | ship | none |

## Fallbacks taken

| Code | Action |
| --- | --- |
