# backend.plan — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Group the operations of one frozen contract into modules once — a module being the operations that share a writer and a store boundary — and give every module its goal, its stores, its proof kinds, its migration refs and its place in the order, so that the blind generators that follow each fill one module and no operation is filled twice.

## Done when

Done when the `backend-plan` names every operation of the frozen contract in exactly one module, each module with its goal, its stores, its proof kinds and its migration refs, orders a module after the ones it depends on, and the `units` file carries one module unit per Modules row with the same id and goal.

Primary output: `backend-plan`

## Inputs

`architecture-decision`, `business-promise-authority` (optional)

## Outputs

`backend-plan` `response/response.md`
`units` `response/data/units.json`

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `EVIDENCE_MISSING`, `MODULE_UNDEFINED`
