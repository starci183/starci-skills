# frontend.surface.audit — brief

Generated from `operators/frontend-surface-audit/operator.md`. Profile `sol-reviewer`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Observe the selected primary surfaces at the served route across their frozen audit matrix, measure every node that carries a claim, and judge each measurement against the published proof rules by the owner of the node it stands on.

## Inputs

| Kind | Required |
| --- | --- |
| `frontend-source-application` | yes |
| `frontend-presentation-resolution` | yes |
| `frontend-direction-decision` | yes |
| `route` | yes |
| `uat-account` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `auditScope` | object | — |
| `matrix` | list | selected surface entries |
| `readinessProbe` | choice | route-served |
| `account` | id | null |
| `env` | id | dev |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-surface-audit` | `response/response.md` | md | yes |
| `capture` | `response/data/captures/<matrixId>.json` | data | yes |
| `screenshot` | `response/artifacts/<matrixId>.png` | artifact | yes |
| `verdicts` | `response/data/verdicts.json` | data | yes |
| `host` | `response/artifacts/host.json` | artifact | no |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `SURFACE_CLASS_MISSING`, `NO_PROGRESS`

## Next

`frontend.presentation.resolve`, `frontend.direction.decide`, `quality.verify`, `workspace.bind`, `frontend.surface.audit`, `platform.operate`
