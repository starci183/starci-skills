# frontend.direction.decide — brief

Generated from `operators/frontend-direction-decide/operator.md`. Profile `sol-fresh`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Decide one evidence-backed, implementation-ready frontend direction for one authorized target, and prove it against the business promise, the published Grammar, the observed implementation and a falsification pass that no candidate survives by taste.

## Inputs

| Kind | Required |
| --- | --- |
| `business-promise-authority` | no |
| `backend-source-application` | no |
| `architecture-decision` | no |
| `frontend-direction-decision` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `target` | id | — |
| `intent` | choice | modify |
| `changeLevel` | choice | — |
| `ownerCeiling` | choice | surface-and-nested-layou |
| `candidates` | number 1–3 | 1 |
| `preview` | choice | no |
| `references` | list | [] |
| `selectionPolicy` | choice | automatic |
| `approval` | id | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-direction-decision` | `response/response.md` | md | yes |
| `ui-coverage` | `response/data/coverage.json` | data | yes |
| `candidates` | `response/artifacts/<candidateId>.html` | artifact | no |
| `direction-image` | `response/artifacts/images/<slot>.png` | artifact | no |
| `host` | `response/artifacts/host.json` | artifact | no |

## Stops

`INVALID_INPUT`, `ROUTE_UNVERIFIED`, `SOURCE_DRIFT`, `SCOPE_UNFROZEN`, `CHANGE_LEVEL_AMBIGUOUS`, `OWNER_CEILING_INVALID`, `BUSINESS_REQUIRED`, `BACKEND_REQUIRED`, `ARCHITECTURE_REQUIRED`, `GRAMMAR_REQUIRED`, `EVIDENCE_MISSING`, `REFERENCE_EVIDENCE_EXHAUSTED`, `REFERENCE_MISSING`, `NO_VIABLE_DIRECTION`, `DIRECTION_CHOICE_REQUIRED`*, `NO_PROGRESS`

## Next

`frontend.presentation.resolve`, `frontend.direction.decide`
