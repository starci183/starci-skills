# git.publish — brief

Follow operator.md; write its declared paths and your branch response/; replace the running response.json before exit. ? optional; * fallback.

## Done when

Done when the `git-publication` records that the exact commit the quality receipt measured reached the routed ref on the remote through a non-force push that created or fast-forwarded it with every hook passed, the session branch was merged and never rebased, at most one annotated tag points at the head this same publication pushed, and the session worktree, branch and folder remain intact for the separate session-cleanup lifecycle.

Primary output: `git-publication`

## Inputs

`workspace-route-binding`, `changes`, `quality-verification`, `business-reconciliation`?

## Outputs

`git-publication` `response/response.md`

## Stops

`INVALID_INPUT`, `SOURCE_DRIFT`, `NO_PROGRESS`, `ROUTE_UNVERIFIED`, `SESSION_MISSING`, `APPROVAL_MISSING`, `BRANCH_POLICY_VIOLATION`, `DIRTY_OUTSIDE_BOUNDARY`, `HOOK_BLOCKED`, `NON_FAST_FORWARD`
