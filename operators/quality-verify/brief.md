# quality.verify — brief

Generated from `operators/quality-verify/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Verify one bounded delivery by running its declared gates against an unchanged predecessor receipt at one frozen head, and return the exact measured verdict, repairing nothing.

## Inputs

| Kind | Required |
| --- | --- |
| `backend-source-application` | no |
| `frontend-source-application` | no |
| `changes` | no |
| `frontend-surface-audit` | no |
| `uat-flow-verification` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `gates` | list of `{gate, comm | the routed gate plan |
| `thresholds` | object or list of `{ | [] |
| `coveragePolicy` | object `{format, sou | null |
| `explicitE2eRequest` | choice | false |
| `sonarScope` | choice | new-code |
| `declaredDebts` | list of `{debtId, ga | [] |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `quality-verification` | `response/response.md` | md | yes |
| `gate-result` | `response/data/gates/<gate>.json` | data | yes |
| `coverage` | `response/data/coverage.json` | data | no |
| `audit-scope` | `response/data/audit-scope.json` | data | no |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED`

## Next

`backend.source.apply`, `frontend.source.apply`, `git.publish`, `release.deploy`, `business.decide`, `uat.verify`
