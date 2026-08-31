# Execute `workspace/workflow-handoff`

## Context

Resolve only the supplied exact references with default repository or file search. Verify their frozen fingerprint and routed project identity.

## Input

Bind one publish or resume operation to the exact route, approval, touched checkouts, mission, and portable continuation fields. Conversation, reasoning, prompts, and session-only artifact references are not continuation inputs.

## Action

Publish the smallest mission-only checkpoint or adopt one exact checkpoint. When the route declares
`worktreeBranches=forbidden`, remain on `mutationBranch`: never create or switch to a task, feature, or
worktree branch. An incoming branch ref may be fetched and merged non-force into `mutationBranch`; it
must never become the mutation branch. Preserve only Git heads, the annotated continuation tag,
resume capability, resume point, and durable authority references. Do not route later work, own
workflow state, broaden source scope, or perform another operator's job.

## Output

Return one atomic checkpoint result whose `resultKind` agrees with `outcome`, plus its exact portable identity, ephemeral proof receipt, evidence, findings, and reason.

## Stop

Return the applicable non-success outcome when evidence is missing, fingerprints drift, a force
operation or policy-forbidden branch action is requested, or the requested work exceeds this single job.
