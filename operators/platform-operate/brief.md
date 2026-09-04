# platform.operate — brief

Generated from `operators/platform-operate/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Operate one bounded shared service from exact evidence — observability, Sonar, tunnel, the runtime registry, or the identity a bound route authenticates against: inventory it, converge only the approved delta, prove every check the bound knowledge requires, and stop at the smallest owning gap instead of taking product deployment ownership.

## Inputs

none: this operator opens the chain.

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `service` | id | — |
| `desiredState` | `{planSha256, servic | — |
| `portClaims` | list of `{port, reso | [] |
| `approval` | id | — |
| `routeKey` | id | null |
| `operation` | choice | serve |
| `commit` | id | null |
| `flow` | id | null |
| `identityRotation` | `{provider, realm, c | null |
| `env` | id | dev |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `platform-operation-receipt` | `response/response.md` | md | yes |
| `delta` | `response/data/delta.json` | data | yes |
| `checks` | `response/data/checks.json` | data | yes |
| `uat-account` | `response/data/account.json` | data | no |
| `changes` | `response/changes.md` | md | no |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `AUTHORITY_DRIFT`, `CAPABILITY_MISSING`, `INVENTORY_DRIFT`, `PORT_CONFLICT`, `EFFECT_UNAUTHORIZED`, `SERVICE_UNAVAILABLE`, `PROVISIONING_UNAVAILABLE`, `INTEGRATION_FAILED`, `PROOF_FAILED`

## Next

`workspace.bind`, `frontend.surface.audit`, `release.deploy`, `uat.verify`, `quality.verify`
