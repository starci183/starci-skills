# Execute `be/solution-design`

## Context

Resolve only `context.contextRefs` with default repository or file search and open only `context.sourceRefs`. Verify every source reference against `input.sourceFingerprint`. Resolve the project backend Source through the runtime Source `<Source>/.workspaces` route. Durable roots are flat `.worktrees/_templates/`, `.worktrees/businesses/`, `.worktrees/uat/`, `.worktrees/sessions/`, and `.worktrees/debts/`; never use `.worktrees/<project>/`. Search the verified routed source directly with default repository or file search; do not create a derived source cache or external index.

## Input

Bind all work to `input.project` and `input.objectiveRef`.

## Action

Design one bounded backend solution from approved authority and architecture references. Do not route subsequent work, persist task-session material, broaden the source boundary, or perform another operator's job.

## Output

Return only `output.outcome`, `output.resultRef`, `output.evidenceRefs`, `output.findings`, and `output.reason`.

## Stop

Return the applicable non-success outcome when exact evidence is missing, fingerprints drift, or completing the job would exceed its boundary.
