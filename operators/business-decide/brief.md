# business.decide — brief

Generated from `operators/business-decide/operator.md`. Profile `sol-fresh`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Decide and publish one evidence-backed business promise as durable backend-owned authority, frozen behind a complete promise-to-enforcement coverage matrix, or reconcile that published head against the source that was actually delivered.

## Inputs

| Kind | Required |
| --- | --- |
| `architecture-decision` | no |
| `backend-source-application` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `featureId` | id | — |
| `mode` | choice | model |
| `promise` | prompt | the promise the previous |
| `targetState` | choice | — |
| `dimensions` | list | the dimensions of the pr |
| `approval` | id | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `business-promise-authority` | `response/response.md` | md | yes |
| `restatement` | `response/restatement.md` | md | no |
| `claims` | `response/data/claims.json` | data | yes |
| `coverage-matrix` | `response/data/coverage-matrix.json` | data | no |
| `model` | `response/data/model.json` | data | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `RESTATEMENT_UNCONFIRMED`, `EVIDENCE_MISSING`, `CONTRADICTION_UNRESOLVED`, `LIFECYCLE_TRANSITION_INVALID`, `AUTHORITY_CONFLICT`, `APPROVAL_REQUIRED`, `COVERAGE_INCOMPLETE`, `CONSUMER_UNPROVEN`, `RECONCILIATION_DISCREPANCY`

## Next

`frontend.direction.decide`, `backend.source.apply`, `architecture.decide`, `git.publish`
