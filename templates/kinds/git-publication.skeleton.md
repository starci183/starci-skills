# git-publication — api.core

One paragraph: which boundary was published, from which heads, onto which ref, and under which
hooks. Written by `git.publish` as `response/response.md`. It proves that exactly these heads reached
exactly this ref; it carries no verdict about the change itself.

## Binding

| Field | Value |
| --- | --- |
| Operator | `git.publish` |
| Step | `step-1/parallel-1` |
| Project | `starci-academy` |
| Boundary | `api.core` |
| Approval | `@worktrees/businesses/features/api-core/model.json#approval` |
| Route receipt | `step-1/parallel-1/response/response.md` |
| Worktree branches | forbidden |
| Mutation branch | `mtp` |
| Frozen head | `1111111111111111111111111111111111111111` |

## Publication

| Field | Value |
| --- | --- |
| Remote | origin |
| Ref | `refs/heads/mtp` |
| Mode | fast-forward-only |
| Forced | no |
| Session branch | `session/s-2026-01-10` |
| Target branch | `mtp` |
| Merge | fast-forward |
| Verified commit | `1111111111111111111111111111111111111111` |
| Cleanup | worktree and session branch removed |

## Published heads

| Checkout | Branch | Head | Previous remote head | Commits |
| --- | --- | --- | --- | --- |
| `@workspaces/be` | `mtp` | `1111111111111111111111111111111111111111` | `2222222222222222222222222222222222222222` | 4 |

## Hooks

| Hook | Reference | Outcome |
| --- | --- | --- |
| `pre-push` | `.husky/pre-push` | passed |

## Continuation tag

| Field | Value |
| --- | --- |
| Tag | — |
| Ref | — |
| Head | — |

## Findings

| Code | Subject | Statement |
| --- | --- | --- |
| `HOOK_ENFORCED` | `pre-push` | the hook ran and was not bypassed |
| `BOUNDARY_CLEAN` | `api.core` | nothing dirty lay outside the published boundary |
| `REMOTE_FAST_FORWARDED` | `@workspaces/be` | the ref advanced from the remote head it carried |
