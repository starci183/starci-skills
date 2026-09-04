# interface.fix — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Repair one finding — one audit verdict row, or one UAT verdict — on a generated surface with one small commit on the session branch: inside the orchestrator's fix size, with no layout change, and with every value taken from the resolution inventory the surface was generated from.

## Done when

Done when, under mode apply, the `frontend-source-application` and its `changes` account for one commit on the session branch that repairs the one finding the request bound, whose `writes` record every declared path with its before and after hash, touch no more than the orchestrator's fix size allows, create and delete nothing, carry only classes the bound resolution's inventory publishes and a clean presentation sweep, and whose tree read back at the commit is the projection; or, under mode dry, the `writes` carry the plan with a null commit and the checkout is untouched.

Primary output: `frontend-source-application`

## Inputs

`frontend-presentation-resolution`, `frontend-source-application`, `frontend-surface-audit` (optional), `uat-flow-verification` (optional)

## Outputs

`frontend-source-application` `response/response.md`
`changes` `response/changes.md`
`writes` `response/data/writes.json`

## Stops

`INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `RESOLUTION_STALE`, `OWNER_CONFLICT`, `FIX_TOO_LARGE`, `WRITE_REJECTED`, `NO_PROGRESS`
