# migration.release — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the `migration-release` and its `migration-release-proof` record the declared migration set applied once through the source-owned runner with every prior journal row preserved, a second invocation proving no pending migration and no journal change, and every value the runner resolved kept out of the receipt, the logs and the proof.

Primary output: `migration-release`

## Inputs

`route`, `backend-source-application`, `quality-verification`

## Outputs

`migration-release` `response/migration-release.md`
`migration-release-proof` `response/data/migration-release.json`
`migration-log` `response/artifacts/migration-<n>.log`?

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `APPROVAL_REQUIRED`, `MIGRATION_PLAN_INVALID`, `MIGRATION_FAILED`
