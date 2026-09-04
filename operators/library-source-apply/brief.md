# library.source.apply — brief

Generated from `operators/library-source-apply/operator.md`. Profile `luna`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Repair existing behavior inside one explicitly authorized owner package, prove its regression and package gates, and commit exactly one next-patch delivery on the bound session branch.

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
| `library-source-application` | `response/data/library.json` | data | yes |
| `library-proof` | `response/data/proofs/<phase>.json` | data | yes |
| `changes` | `response/changes.md` | md | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `LIBRARY_BOUNDARY_REJECTED`, `LIBRARY_PROOF_FAILED`

## Next

`quality.verify`
