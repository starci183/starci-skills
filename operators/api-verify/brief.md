# api.verify — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Run the repository's own end-to-end suite as a client against the served runtime, on the namespace the seed placed, and publish one append-only run record whose cases are the runner's and whose three lanes are judged apart, or stop at the exact unavailability instead of manufacturing a verdict.

## Done when

Done when the `api-cases` carry every case the repository's own suite reported with its status and its evidence, none of them authored by this branch, the `api-verdicts` judge the contract, data and lifecycle lanes apart on that evidence, the run namespace was read back through the API and then deleted and nothing else was, the append-only run record exists under the flow's API history with its pointer and its history line, and the `api-verification` names the served head that answered, the commit it contains, the command that was run and the lane table it printed to the person.

Primary output: `api-verification`

## Inputs

`platform-operation-receipt`, `uat-account` (optional), `seed-receipt` (optional), `quality-verification` (optional), `units` (optional)

## Outputs

`api-verification` `response/response.md`
`api-cases` `response/data/cases.json`
`api-verdicts` `response/data/verdicts.json`
`api-output` `response/artifacts/api-output.txt`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `RUNTIME_UNAVAILABLE`, `API_CASE_FAILED`, `API_NAMESPACE_LEAK`
