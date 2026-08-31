# Execute `workspace/route-verify`

## Context

Resolve only the supplied exact references with default repository or file search. Verify their frozen fingerprint and routed project identity.

## Input

Bind all work to the verified project and one bounded objective.

## Action

Resolve one request to one project-role route and carry its declared Git policy into the immutable
route receipt. When `worktreeBranches=forbidden`, mutation is ready only on `mutationBranch`; creating
or switching to a task, feature, or worktree branch is forbidden. Do not route later work, own
workflow state, broaden source scope, or perform another operator's job.

## Output

Return only one atomic result: `outcome`, `resultRef`, `evidenceRefs`, `findings`, and `reason`.

## Stop

Return the applicable non-success outcome when evidence is missing, fingerprints drift, the active
checkout branch differs from `mutationBranch`, or the requested work exceeds this single job.
