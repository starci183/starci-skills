# dependency.update — brief

Generated from `operators/dependency-update/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Consume one verified package release by changing only its exact dependency metadata, then prove the unchanged consumer regression and complete declared delivery gates before one session commit.

## Inputs

| Kind | Required |
| --- | --- |
| `route` | yes |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `plan` | object | — |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `dependency-update` | `response/data/dependency.json` | data | yes |
| `dependency-proof` | `response/data/proofs/<phase>.json` | data | yes |
| `dependency-log` | `response/artifacts/proofs/<phase>.log` | artifact | yes |
| `changes` | `response/changes.md` | md | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `DEPENDENCY_BOUNDARY_REJECTED`, `DEPENDENCY_PROOF_FAILED`

## Next

`quality.verify`
