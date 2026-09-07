# workflow.verify — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `workflow-verification-report` maps every frozen coordinator done-when line to its assigned peer, proves each peer completed every line of the exact frozen child goal, binds each routed repository's full delivered head to accepted delivery evidence and its exact current Git HEAD, keeps earlier source-bound goal evidence only when its revision is an ancestor in that same repository, and preserves rereadable state and branch fingerprints for every claim.

Primary output: `workflow-verification-report`

## Inputs

none

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist. Paths: response/.

`workflow-verification-report` `data/workflow-verification-report.json` (data)

## Stops

`INVALID_INPUT`, `EVIDENCE_MISSING`
