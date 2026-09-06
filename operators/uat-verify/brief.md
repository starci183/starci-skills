# uat.verify — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback. Context is limited to what request.json names.

## Done when

Done when the `uat-snapshot` was frozen before any product action, naming the pinned commit, the served head that contains it, the cases in order with their assertions, the declared account and fixture prerequisites, every frozen case has its `uat-capture` and masked `screenshot` taken through the rendered controls after any required sign-in redirect landed, the `uat-verdicts` judge the behaviour, experience and interface lanes on their own evidence with the experience lane scored criterion by criterion, the required rollback handoff was emitted to `data.seed` or the no-fixture mode records no cleanup, the append-only run record exists with its pointer and history line, and the `uat-flow-verification` lists the `sheet` and the verdict table it printed to the person, carrying the `audit-scope` unchanged when the admitted audit had one.

Primary output: `uat-flow-verification`

## Inputs

`frontend-surface-audit`, `quality-verification`, `route`, `uat-account`[when access=authenticated], `units`?, `uat-plan`, `uat-case-sheet`, `seed-receipt`[when fixtures=seeded]

## Outputs

`uat-flow-verification` `response/response.md`
`uat-snapshot` `response/data/snapshot.json`
`uat-capture` `response/data/captures/<case>.json`
`uat-verdicts` `response/data/verdicts.json`
`audit-scope` `response/data/audit-scope.json`?
`findings` `response/data/findings.json`?
`uat-walk` `response/data/walks/<walk>/walk.json`?
`walk-result` `response/data/walks/<walk>/walk-result.json`?
`screenshot` `response/artifacts/<case>.png`
`sheet` `response/artifacts/sheet.png`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `ADMISSION_MISSING`, `PROVISIONING_UNAVAILABLE`, `IDENTITY_MISSING`, `LEASE_INVALID`, `RUNTIME_UNAVAILABLE`, `EVIDENCE_UNAVAILABLE`, `FIXTURE_VIOLATION`, `CANONICAL_WRITE_DENIED`
