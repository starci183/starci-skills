# backend.plan — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `backend-plan` names every operation of the frozen contract in exactly one module, each module with its goal, its stores, its proof kinds and its migration refs, orders a module after the ones it depends on, and the `units` file carries one module unit per Modules row with the same id and goal.

Primary output: `backend-plan`

## Inputs

`architecture-decision`, `business-promise-authority`?

## Outputs

`backend-plan` `response/response.md`
`units` `response/data/units.json`

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `MODULE_UNDEFINED`
