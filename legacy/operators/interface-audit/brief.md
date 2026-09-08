# interface.audit — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when every selected matrix entry has its `capture`, its `screenshot` and its row in `verdicts`, every claim inside a selected surface was measured on a served head that contains the applied commit and judged by the owner of its node, each proof topic has closed by its own rule into one row of the `frontend-surface-audit` verdict table with the route a failure carries, and the sheet was served over `host` and printed to the person with the worst capture of each topic.

Primary output: `frontend-surface-audit`

## Inputs

`quality-verification`?, `frontend-source-application`, `frontend-presentation-resolution`, `frontend-direction-decision`, `route`, `uat-account`?, `platform-operation-receipt`?, `seed-receipt`?, `units`?, `landing-composition`?, `knowledge-repair-receipt`?

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist. Paths: response/.

`art-direction-fidelity` `data/art-direction-fidelity.json`? (data)
`frontend-surface-audit` `response.md` (md)
`capture` `data/captures/<matrixId>.json` (data)
`screenshot` `artifacts/<matrixId>.png` (artifact)
`verdicts` `data/verdicts.json` (data)
`findings` `data/findings.json`? (data)
`uat-walk` `data/walks/<walk>/walk.json`? (data)
`walk-result` `data/walks/<walk>/walk-result.json`? (data)
`host` `artifacts/host.json`? (artifact)
`knowledge-coverage` `data/knowledge-coverage.json`? (data)
`family-understanding` `data/family-understanding.json`? (data)
`knowledge-question` `data/knowledge-question.json`? (data)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `RUNTIME_UNAVAILABLE`, `IDENTITY_MISSING`, `EVIDENCE_MISSING`, `UNKNOWN_RULE`, `KNOWLEDGE_QUESTION`, `SURFACE_CLASS_MISSING`, `CALIBRATION_OFF`, `UNCHECKED_UNLAWFUL`, `NO_PROGRESS`
