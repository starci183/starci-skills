# migration.release — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the `migration-release` and its `migration-release-proof` record the declared migration set applied once through the source-owned runner with every prior journal row preserved, a second invocation proving no pending migration and no journal change, and every value the runner resolved kept out of the receipt, the logs and the proof.

Primary output: `migration-release`

## Inputs

`route`, `backend-source-application`, `quality-verification`

## Outputs

Before write/resume, read ../../templates/kinds/<kind>: md .contract.json + .skeleton.md; data .schema.json; artifact follows operator.md. Current-status declared kinds; evidence must exist. Paths: response/.

`migration-release` `migration-release.md` (md)
`migration-release-proof` `data/migration-release.json` (data)
`migration-log` `artifacts/migration-<n>.log`? (artifact)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `APPROVAL_REQUIRED`, `MIGRATION_PLAN_INVALID`, `MIGRATION_FAILED`
