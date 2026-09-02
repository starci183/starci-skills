# Input for `git.publish`

The input has two closed sections: `context`, which declares the exact existing material the operator
may read, and `input`, which declares the boundary to publish and the exact heads it publishes.
Undeclared fields are invalid.

## Envelope

- `schemaVersion`: exactly `8`.
- `operatorId`: exactly `git.publish`.
- `context`: authority and evidence bindings described by `context.md`.
- `input`: one frozen publication.

## Context bindings

`context.routeReceipt` is required and its `status` is the constant `bound`; a publish never resolves
its own checkout. Its project must equal `input.project`.

`context.approval` is required and its `scopeUnit` must equal `input.boundary.unit`. An approval for a
different unit is a real approval for somebody else's boundary.

`context.gitPolicy` carries the routed worktree policy and the mutation branch, plus `forcePush` and
`historyRewrite` as the constant `false`.

`context.hookInventory` lists the installed hooks, each with `enforced: true` as a constant, and must
include `pre-push`. `context.remote` observes exactly the ref being published, and its `remoteHead`
is null when the ref does not exist yet.

`context.completionProofRefs` is non-empty. It records the gates the boundary passed. It is evidence,
never a substitute for approval.

## Publication boundary

`input.boundary` names one unit, its targets, its write roots, and its exclusions. A path cannot be
both a target and an exclusion.

`input.sourceHeads` binds each contributing checkout by reference, branch, exact head, upstream head,
and ahead and behind counts. Each checkout appears at most once, at least one head is ahead of its
upstream, and under `worktreeBranches: forbidden` every head is on the mutation branch. A head with no
upstream cannot report commits behind one.

`input.workingTree.dirtyPaths` must all lie under a declared write root. Anything dirty outside the
boundary is work this publication does not own.

`input.publication.branchRef` is the single ref being published, `mode` is the constant
`fast-forward-only`, and `annotatedTag` is either null or one annotated continuation tag.
`context.remote.ref` must be that same ref.

## Destructive operations are unrepresentable

`input.destructiveOperations` is a closed object whose every member is the constant `false`:
`forcePush`, `historyRewrite`, `resetHard`, `clean`, `stash`, `branchDelete`, `hookBypass`. There is
no input that requests any of them, in any combination, under any justification. The field exists so
that the prohibition is enforced by the contract rather than remembered under pressure.

## Resume input

`resume` is `null` for a new invocation. A resumed invocation supplies the exact blocked receipt, its
single-use token, and the references added since. Project, boundary unit, approval, and artifact root
must equal the blocked receipt. A resume that adds no head, approval, hook, or remote delta is invalid
as `NO_PROGRESS`.
