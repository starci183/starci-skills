# business.reconcile — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `business-reconciliation` carries one row per dimension of the frozen coverage matrix with the delivered evidence each rests on and no discrepancy standing, the `claims` bind every delivered fact to the frozen source head, and the `model` republishes the same head under the exclusive lease with the reconciliation it performed and the legal transition it took, archived under its content address and named by the head index with the state it now holds.

Primary output: `business-reconciliation`

## Inputs

`backend-source-application`[when sourceRole=be], `frontend-source-application`[when sourceRole=fe], `quality-verification`?, `uat-flow-verification`?, `api-verification`?

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist.

`business-reconciliation` `response/response.md` (md)
`claims` `response/data/claims.json` (data)
`model` `response/data/model.json` (data)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `HEAD_NOT_RECONCILABLE`, `APPROVAL_REQUIRED`, `EVIDENCE_MISSING`, `RECONCILIATION_DISCREPANCY`
