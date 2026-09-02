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
| Credential | `.stacks/local/secrets/uat.enc`, resolved by name at login only |
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

## Fallbacks taken

| Code | Action |
| --- | --- |
