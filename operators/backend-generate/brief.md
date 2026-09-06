# backend.generate — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when, under mode apply, the `backend-source-application` and its `changes` account for one commit on the session branch whose `mutations` restate every contract operation unchanged and record each touched file with its before and after hash, every declared facet has its `conformance` record and every declared proof its passed `proof` record, and every path written outside the owner boundary carries its widening row; or, under mode dry, the `mutations` carry the operations it would fill and the paths it would touch with a null commit, no after hash, no `conformance` and no `proof`, and the checkout is untouched; or, when the request narrows the scope to fix, the same holds under the mode it named with the `mutations` touching no more paths than the orchestrator's fix size allows and no widening row at all.

Primary output: `backend-source-application`

## Inputs

`business-reconciliation`?, `architecture-decision`, `model`?, `backend-source-application`?, `units`?

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist.

`backend-source-application` `response/response.md` (md)
`changes` `response/changes.md` (md)
`mutations` `response/data/mutations.json` (data)
`conformance` `response/data/conformance/<operationId>.<facet>.json`? (data)
`proof` `response/data/proofs/<operationId>.<proofKind>.json`? (data)

## Stops

`INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `OWNER_WIDENED`*, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE`
