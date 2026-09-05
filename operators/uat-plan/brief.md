# uat.plan — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `uat-plan` names one flow per journey the goal names, each with its entry route, its step budget, its own account alias, its own seed namespace and its tier, and the `units` file carries one flow unit per Flows row with the same id and tier.

Primary output: `uat-plan`

## Inputs

`surface-map`?

## Outputs

`uat-plan` `response/response.md`
`uat-case-sheet` `response/data/cases.json`
`units` `response/data/units.json`

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `FLOW_UNDEFINED`
