# Execute `business/evidence-normalize`

## Context

Resolve only `context.contextRefs` with default repository or file search and open only `context.sourceRefs`. Verify every source reference against `input.sourceFingerprint`. For durable business authority, references must use the verified project backend Source flat `.worktrees/businesses/` root. The runtime Source owns `.claude/.workspaces`; never add a project segment below `.worktrees/`.

## Input

Bind all work to `input.project` and `input.objectiveRef`.

## Action

Normalize one bounded business evidence set into traceable claims. Do not route subsequent work, persist task-session material, broaden the source boundary, or perform another operator's job.

## Output

Return only `output.outcome`, `output.resultRef`, `output.evidenceRefs`, `output.findings`, and `output.reason`.

## Stop

Return the applicable non-success outcome when exact evidence is missing, fingerprints drift, or completing the job would exceed its boundary.
