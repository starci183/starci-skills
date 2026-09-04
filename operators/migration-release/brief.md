# migration.release — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Apply one frozen source migration plan once to one declared non-production target through the source-owned runner, and prove by a second invocation that nothing remains pending and the journal did not move.

## Done when

Done when the `migration-release` and its `migration-release-proof` record the declared migration set applied once through the source-owned runner with every prior journal row preserved, a second invocation proving no pending migration and no journal change, and every value the runner resolved kept out of the receipt, the logs and the proof.

Primary output: `migration-release`

## Inputs

`route`, `backend-source-application`, `quality-verification`

## Outputs

`migration-release` `response/migration-release.md`
`migration-release-proof` `response/data/migration-release.json`
`migration-log` `response/artifacts/migration-<n>.log` (optional)

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `APPROVAL_REQUIRED`, `MIGRATION_PLAN_INVALID`, `MIGRATION_FAILED`
