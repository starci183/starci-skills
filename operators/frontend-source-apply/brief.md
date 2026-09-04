# frontend.source.apply — brief

Generated from `operators/frontend-source-apply/operator.md`. Profile `luna`, dispatch `fresh`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Write one already-resolved tree into product source on the session branch, inside a frozen owner ceiling and a declared file set, emitting only values the bound resolution already contains, and account for every byte that entered the repository in one commit.

## Inputs

| Kind | Required |
| --- | --- |
| `frontend-presentation-resolution` | yes |
| `frontend-direction-decision` | yes |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `mode` | choice | apply |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `frontend-source-application` | `response/response.md` | md | yes |
| `changes` | `response/changes.md` | md | yes |
| `writes` | `response/data/writes.json` | data | yes |

## Stops

`INVALID_INPUT`, `SESSION_MISSING`, `SOURCE_DRIFT`, `OWNER_CONFLICT`, `RESOLUTION_STALE`, `WRITE_REJECTED`, `NO_PROGRESS`

## Next

`workspace.bind`, `frontend.surface.audit`, `quality.verify`
