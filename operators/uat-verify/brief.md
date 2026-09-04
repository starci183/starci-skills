# uat.verify — brief

Generated from `operators/uat-verify/operator.md`. Profile `sol-fresh`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Verify one product flow end to end on the running product at the pinned commit, and publish one append-only run record with three independently judged lanes, or stop at the exact unavailability instead of manufacturing a verdict.

## Inputs

| Kind | Required |
| --- | --- |
| `frontend-surface-audit` | yes |
| `quality-verification` | yes |
| `route` | yes |
| `uat-account` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `approval` | id | — |
| `feature` | id | — |
| `flow` | id | — |
| `env` | id | dev |
| `cases` | list of `caseId` | every case of the flow |
| `runId` | id | — |
| `lease` | token | — |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `uat-flow-verification` | `response/response.md` | md | yes |
| `uat-snapshot` | `response/data/snapshot.json` | data | yes |
| `uat-capture` | `response/data/captures/<case>.json` | data | yes |
| `uat-verdicts` | `response/data/verdicts.json` | data | yes |
| `audit-scope` | `response/data/audit-scope.json` | data | no |
| `screenshot` | `response/artifacts/<case>.png` | artifact | yes |
| `sheet` | `response/artifacts/sheet.png` | artifact | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED`

## Next

`git.publish`, `business.decide`, `frontend.presentation.resolve`, `backend.source.apply`, `platform.operate`, `user`
