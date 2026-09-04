# git.publish — brief

Generated from `operators/git-publish/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Publish one approved Git boundary from the exact commit quality verified, with non-force, fast-forward-only semantics, and stop with a typed failure rather than reaching for a bypass.

## Inputs

| Kind | Required |
| --- | --- |
| `workspace-route-binding` | yes |
| `changes` | yes |
| `quality-verification` | yes |

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `boundary` | id | — |
| `approval` | id | — |
| `tag` | `{name, message}` | null |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `git-publication` | `response/response.md` | md | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ROUTE_UNVERIFIED`, `SESSION_MISSING`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD`

## Next

`release.deploy`, `platform.operate`
