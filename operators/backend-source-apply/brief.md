# backend.source.apply — brief

Generated from `operators/backend-source-apply/operator.md`. Profile `luna`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Implement one backend outcome inside a frozen mutation contract, following the observed sibling family, and return the measured conformance and proof receipt that shows the boundary was not widened.

## Inputs

| Kind | Required |
| --- | --- |
| `architecture-decision` | yes |
| `model` | no |
| `backend-source-application` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `featureId` | id | — |
| `outcome` | prompt | — |
| `mutableFileRefs` | list | — |
| `protectedRefs` | list | empty |
| `contractFingerprint` | id | null |
| `mode` | choice | apply |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `backend-source-application` | `response/response.md` | md | yes |
| `changes` | `response/changes.md` | md | yes |
| `mutations` | `response/data/mutations.json` | data | yes |
| `conformance` | `response/data/conformance/<operationId>.<facet>.json` | data | no |
| `proof` | `response/data/proofs/<operationId>.<proofKind>.json` | data | no |

## Stops

`INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `OWNER_WIDENED`*, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE`

## Next

`quality.verify`, `business.decide`, `frontend.direction.decide`, `workspace.bind`, `platform.operate`, `user`
