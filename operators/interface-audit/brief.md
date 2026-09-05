# interface.audit — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when every selected matrix entry has its `capture`, its `screenshot` and its row in `verdicts`, every claim inside a selected surface was measured on a served head that contains the applied commit and judged by the owner of its node, each proof topic has closed by its own rule into one row of the `frontend-surface-audit` verdict table with the route a failure carries, and the sheet was served over `host` and printed to the person with the worst capture of each topic.

Primary output: `frontend-surface-audit`

## Inputs

`frontend-source-application`, `frontend-presentation-resolution`, `frontend-direction-decision`, `route`, `uat-account`?, `platform-operation-receipt`?, `seed-receipt`?, `units`?, `knowledge-repair-receipt`?

## Outputs

`frontend-surface-audit` `response/response.md`
`capture` `response/data/captures/<matrixId>.json`
`screenshot` `response/artifacts/<matrixId>.png`
`verdicts` `response/data/verdicts.json`
`findings` `response/data/findings.json`?
`uat-walk` `response/data/walks/<walk>/walk.json`?
`walk-result` `response/data/walks/<walk>/walk-result.json`?
`host` `response/artifacts/host.json`?
`knowledge-coverage` `response/data/knowledge-coverage.json`?
`family-understanding` `response/data/family-understanding.json`?
`knowledge-question` `response/data/knowledge-question.json`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `KNOWLEDGE_QUESTION`, `SURFACE_CLASS_MISSING`, `CALIBRATION_OFF`, `UNCHECKED_UNLAWFUL`, `NO_PROGRESS`
