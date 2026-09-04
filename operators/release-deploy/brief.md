# release.deploy — brief

Generated from `operators/release-deploy/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Deploy one immutable release to one declared target under its declared authorization and prove the steady state it reached, taking the recovery or rollback branch inside the same pass rather than assuming the rollout succeeded.

## Inputs

| Kind | Required |
| --- | --- |
| `quality-verification` | yes |
| `backend-source-application` | no |
| `route` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `release` | id | — |
| `target` | id | — |
| `approval` | id | — |
| `probes` | list of `{probeId, k | the probes the validated |
| `steadyDeadline` | number | 600 |
| `migration` | `{planRef, sha256}` | null |
| `rollbackIdentity` | `{releaseId, artifac | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `release-deployment` | `response/response.md` | md | no |
| `probes` | `response/data/probes.json` | data | no |
| `migration-release` | `response/migration-release.md` | md | no |
| `migration-release-proof` | `response/data/migration-release.json` | data | no |

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `AUTHORIZATION_MISSING`, `MANIFEST_INVALID`, `APPROVAL_REQUIRED`, `CREDENTIAL_UNAVAILABLE`, `HOST_UNAVAILABLE`, `ARTIFACT_MISSING`, `MIGRATION_BLOCKED`, `DOMAIN_UNRECONCILED`, `ROLLOUT_FAILED`*, `RECOVERY_EXHAUSTED`*, `CONCURRENT_DRIFT`, `ROLLBACK_IDENTITY_MISSING`, `STEADY_STATE_UNPROVEN`

## Next

`platform.operate`
