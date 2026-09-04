# backend.generate — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Generate one backend outcome inside a frozen mutation contract, following the observed sibling family, in full or as a fix inside the orchestrator's fix size, and return the measured conformance and proof receipt that shows the boundary was not widened.

## Done when

Done when, under mode apply, the `backend-source-application` and its `changes` account for one commit on the session branch whose `mutations` restate every contract operation unchanged and record each touched file with its before and after hash, every declared facet has its `conformance` record and every declared proof its passed `proof` record, and every path written outside the owner boundary carries its widening row; or, under mode dry, the `mutations` carry the operations it would fill and the paths it would touch with a null commit, no after hash, no `conformance` and no `proof`, and the checkout is untouched; or, when the request narrows the scope to fix, the same holds under the mode it named with the `mutations` touching no more paths than the orchestrator's fix size allows and no widening row at all.

Primary output: `backend-source-application`

## Inputs

`business-reconciliation` (optional), `architecture-decision`, `model` (optional), `backend-source-application` (optional), `units` (optional)

## Outputs

`backend-source-application` `response/response.md`
`changes` `response/changes.md`
`mutations` `response/data/mutations.json`
`conformance` `response/data/conformance/<operationId>.<facet>.json` (optional)
`proof` `response/data/proofs/<operationId>.<proofKind>.json` (optional)

## Stops

`INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `NO_PROGRESS`, `CONTRACT_UNFROZEN`, `CONTRACT_WIDENED`, `BUSINESS_AUTHORITY_MISSING`, `OWNER_CONFLICT`, `OWNER_WIDENED`*, `PATTERN_UNBOUND`, `PROOF_UNAVAILABLE`
