# environment.preflight — brief

Generated from `operators/environment-preflight/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Run, once and before any chain, every readiness check a mission would otherwise meet one wall at a time — declarations, checkouts, identity custody, the runtime, the host and the environment's approvals — and return them all at once as one typed readiness report, repairing nothing.

## Inputs

none: this operator opens the chain.

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `project` | id | — |
| `roles` | list | `fe, be` |
| `env` | id | dev |
| `flow` | id | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `environment-readiness` | `response/response.md` | md | yes |
| `readiness-report` | `response/data/readiness-report.json` | data | yes |

## Stops

`INVALID_INPUT`, `NO_PROGRESS`, `ROUTE_NAME_NEAR_MATCH`*, `ENVIRONMENT_NOT_READY`

## Next

`workspace.bind`, `platform.operate`, `content.generate`, `user`
