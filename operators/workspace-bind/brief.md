# workspace.bind — brief

Generated from `operators/workspace-bind/operator.md`. Profile `luna`, dispatch `inline`. Read operator.md for the step you are on; write only response/ of your branch; replace the running skeleton in response.json before you exit. A stop marked * is a fallback.

## Job

Resolve one project and role into a verified checkout identity, its exact source head, and the closed runtime binding it may consume, and return that as one typed route receipt.

## Inputs

none: this operator opens the chain.

## Requirements

| Field | Type | Default |
| --- | --- | --- |
| `project` | id | — |
| `role` | choice | — |
| `checkout` | choice | routed |
| `gitPolicy` | list of `{worktreeBr | the policy the route dec |
| `declaredWriteRoots` | list | empty |
| `runtimeNeed` | choice | none |
| `resume` | token | null |

## Outputs

| Kind | File | Type | Required |
| --- | --- | --- | --- |
| `workspace-route-binding` | `response/response.md` | md | yes |
| `route` | `response/data/route.json` | data | yes |

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `IDENTITY_UNVERIFIED`, `ROUTE_UNDECLARED`, `ROUTE_UNHYDRATED`, `ROUTE_MISMATCH`, `BRANCH_POLICY_VIOLATION`, `CHECKOUT_DIRTY`, `ENDPOINT_AUTHORITY_STALE`, `RUNTIME_NOT_READY`, `RUNTIME_BUSY`

## Next

`git.publish`, `business.decide`, `backend.source.apply`, `frontend.source.apply`, `library.source.apply`, `dependency.update`, `platform.operate`, `frontend.direction.decide`, `quality.verify`, `frontend.surface.audit`
