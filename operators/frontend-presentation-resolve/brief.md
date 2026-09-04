# frontend.presentation.resolve — brief

Generated from `operators/frontend-presentation-resolve/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Resolve every application-owned presentation property on one already-composed tree to exactly one published rule, emit its class and its verifiable contract claim, and stop at the smallest owning gap instead of inventing a value.

## Inputs

| Kind | Required |
| --- | --- |
| `frontend-direction-decision` | yes |
| `frontend-surface-audit` | no |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `maxRounds` | number | 2 |
| `contractEmission` | choice | on |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-presentation-resolution` | `response/response.md` | md | yes |
| `inventory` | `response/data/inventory.json` | data | yes |
| `resolved-tree` | `response/artifacts/<target>.resolved.tsx` | artifact | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `KNOWLEDGE_UNBOUND`, `UNKNOWN_RULE`, `RULE_MISSING`, `GRAMMAR_UNPUBLISHED`, `NO_PROGRESS`

## Next

`frontend.source.apply`, `frontend.presentation.resolve`
