# business.reconcile — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Compare one published business promise, dimension by dimension of its frozen coverage matrix, against the source that was actually delivered, and republish the head with the reconciliation it now carries or stop on the first discrepancy that stands.

## Done when

Done when the `business-reconciliation` carries one row per dimension of the frozen coverage matrix with the delivered evidence each rests on and no discrepancy standing, the `claims` bind every delivered fact to the frozen source head, and the `model` republishes the same head under the exclusive lease with the reconciliation it performed and the legal transition it took, archived under its content address and named by the head index with the state it now holds.

Primary output: `business-reconciliation`

## Inputs

`backend-source-application`, `quality-verification` (optional), `uat-flow-verification` (optional), `api-verification` (optional)

## Outputs

`business-reconciliation` `response/response.md`
`claims` `response/data/claims.json`
`model` `response/data/model.json`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `HEAD_NOT_RECONCILABLE`, `APPROVAL_REQUIRED`, `EVIDENCE_MISSING`, `RECONCILIATION_DISCREPANCY`
