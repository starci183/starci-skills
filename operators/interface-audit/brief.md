# interface.audit — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop. You see only what request.json names; nothing else exists.

## Job

Observe the selected primary surfaces at the served route across their frozen audit matrix, measure every node that carries a claim, and judge each measurement against the published proof rules by the owner of the node it stands on.

## Done when

Done when every selected matrix entry has its `capture`, its `screenshot` and its row in `verdicts`, every claim inside a selected surface was measured on a served head that contains the applied commit and judged by the owner of its node, each proof topic has closed by its own rule into one row of the `frontend-surface-audit` verdict table with the route a failure carries, and the sheet was served over `host` and printed to the person with the worst capture of each topic.

Primary output: `frontend-surface-audit`

## Inputs

`frontend-source-application`, `frontend-presentation-resolution`, `frontend-direction-decision`, `route`, `uat-account` (optional), `platform-operation-receipt` (optional)

## Outputs

`frontend-surface-audit` `response/response.md`
`capture` `response/data/captures/<matrixId>.json`
`screenshot` `response/artifacts/<matrixId>.png`
`verdicts` `response/data/verdicts.json`
`host` `response/artifacts/host.json` (optional)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `SURFACE_CLASS_MISSING`, `NO_PROGRESS`
