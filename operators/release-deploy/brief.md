# release.deploy — brief

Read operator.md at your step; write only response/ of your branch; replace the running response.json skeleton before you exit; * marks a fallback stop.

## Job

Deploy one immutable release to one declared target under its declared authorization and prove the steady state it reached, taking the recovery or rollback branch inside the same pass rather than assuming the rollout succeeded.

## Done when

Done when, for an image release, the `release-deployment` records whether the release was deployed or the previous release restored, with the `probes` observed across the whole steady window showing either the immutable digest active on every declared target with every declared probe passing or the exact rollback release restored and never reported as delivery of the rejected one; or, for a migration release, the `migration-release` and its `migration-release-proof` record the declared migration set applied once through the source-owned runner with every prior journal row preserved and a second invocation proving no pending migration and no journal change.

## Inputs

`quality-verification`, `backend-source-application` (optional), `route` (optional)

## Outputs

`release-deployment` `response/response.md` (optional)
`probes` `response/data/probes.json` (optional)
`migration-release` `response/migration-release.md` (optional)
`migration-release-proof` `response/data/migration-release.json` (optional)

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`*, `RECOVERY_EXHAUSTED`*, `CONCURRENT_DRIFT`, `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN`
