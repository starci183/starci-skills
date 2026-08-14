---
name: starci-fe-design-apply
description: Commit the current target source as a clean baseline, then implement the approved StarCi frontend design directly in final source paths and track the resulting diff. Use after starci-fe-design-review approves the exact revision, production boundary, states and evidence. Creates no parallel design code; renders, tests and records the baseline-to-worktree diff.
---

# StarCi FE Design Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Apply creates the before-state commit, writes the approved design directly in source, and uses that
commit to expose the exact final diff.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Read the approved `## review`. Confirm `Repo / branch` and `Touching` before the first production
write. `Touching` contains the workflow and exact approved source boundary.

## PROCESS

**Commit before editing.** On entry to Apply, commit the current target source state and record
`Baseline commit: <sha>`. This is the before-state for the design diff. Do not make any approved
design edit before this commit. Exclude generated artifacts, secrets and paths outside the target
repository; surface an uncommittable state in `WARNINGS` or `NEED APPROVALS` instead of inventing a
baseline.

When the approved screen needs a backend enabler, complete its approved backend capability before
the frontend consumes it and include its repository baseline separately.

Write the approved revision directly at final source paths. Pages orchestrate, blocks own product
sentences, branches arrange contract content, shells own vendor mechanics, and connected blocks
resolve data before rendering pure halves. Create no detached HTML, design-code directory or copied
component implementation.

Track `git diff <baseline>` while working. Every path must remain inside Review's boundary. If a new
path is required, append the finding and return that boundary decision to Review before writing it.

Run typecheck, lint and build without suppression. Open the real page and verify every approved state
at the recorded route, viewport, locale, theme, persona and fixture. Feedback on the implementation
is handled by revising the same source inside Apply and appending `REJECTED` evidence. Feedback that
changes the approved product thesis returns to Plan/Review.

Before closing, record:

```text
Applied revision: <approved identity>
Baseline commit: <sha>
Tracked diff: <baseline>..worktree
```

The name-status diff, `CHANGES` tree and approved boundary must agree.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

`OUTPUTS` names the implemented concept and proof. `CHANGES` details every source and workflow path
in `git diff <baseline>`. Append `## apply` with commands, rendered states and remaining proof.
