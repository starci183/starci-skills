# quality.verify — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the `quality-verification` states one measured verdict, pass or fail, over a delivery whose predecessor receipts all name the frozen head, with one `gate-result` per declared gate carrying its command, exit code, evidence and classification, `coverage` preserving every configured and requested threshold beside its measured value whenever a unit gate ran, every red gate classified to its owner or covered by a live approved debt, every topic row of the scorecard copied unchanged from the receipt that computed it, and the admitted `audit-scope` copied unchanged when the audit carried one.

Primary output: `quality-verification`

## Inputs

`backend-source-application`?, `frontend-source-application`?, `changes`?, `frontend-surface-audit`?, `uat-flow-verification`?, `service-receipt`?

## Outputs

`quality-verification` `response/response.md`
`gate-result` `response/data/gates/<gate>.json`
`coverage` `response/data/coverage.json`?
`audit-scope` `response/data/audit-scope.json`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `PREDECESSOR_MIXED`, `PREDECESSOR_STALE`, `GATE_UNAVAILABLE`, `DEBT_UNAPPROVED`
