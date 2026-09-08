# uat.plan — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `uat-plan` names one flow per journey the goal names, each with its entry route, its step budget, its declared account and fixture prerequisites and its tier, and the `units` file carries one flow unit per Flows row with the same id and tier.

Primary output: `uat-plan`

## Inputs

`surface-map`?

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist. Paths: response/.

`uat-plan` `response.md` (md)
`uat-case-sheet` `data/cases.json` (data)
`units` `data/units.json` (data)

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `FLOW_UNDEFINED`
