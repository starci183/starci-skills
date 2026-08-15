---
name: starci-fe-design-apply
description: Commit the current target source as a clean baseline, then implement the approved StarCi frontend design directly in final source paths and track the resulting diff. Use after starci-fe-design-review approves the exact component tree, prop migrations, production boundary, states and evidence. Creates no parallel design code; renders, tests and records the baseline-to-worktree diff.
---

# StarCi FE Design Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Apply creates the before-state commit, writes the approved design directly in source, and uses that
commit to expose the exact final diff.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Read the approved `## review`. Require one exact revision, a non-deferred `COMPONENT DELTA`, a
non-deferred `PROPS DELTA`, supporting production boundary, states and acceptance evidence. Return
to `$starci-fe-design-review` if any is unresolved. Confirm `Repo / branch` and `Touching` before the
first production write. `Touching` contains the workflow and exact approved source boundary.

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

Treat the approved delta rows as an executable boundary:

- edit only owners marked `ADD`, `MODIFY`, `MOVE` or `REMOVE`; a `REUSE` row must stay unchanged;
- make exactly the approved prop/API actions, migrating every named producer and call site;
- prove `REMOVE`, `MOVE` and `RENAME` with a source search showing no stale import, export, prop or
  call site;
- return to Review when implementation discovers a new owner, tier, path, prop or action.

Track `git diff <baseline>` while working. Every path must remain inside Review's boundary. If a new
path is required, append the finding and return that boundary decision to Review before writing it.

Before completion, reconcile every component and props row against `git diff <baseline>`. Record
the row-to-diff proof in the workflow; an unimplemented row or an unexplained diff returns to Review.

Run the approved Frontend typecheck, lint and build gates without suppression. In addition, before
closing Apply, run a repository-owned non-mutating lint command in each resolved target repository:
Frontend and Backend. Resolve the package manager and check-only script from that repository; prefer
`lint:check` when available and never use `--fix` as a proof command.

Append a `### CROSS-REPOSITORY LINT PROOF` table with one row per target containing repository,
working directory, exact command, exit code and verdict. Both rows must be present and pass. A lint
failure does not expand the approved production boundary: record it in `OWED` and return the repair
to its owning Review or audit capability. Apply cannot close while either lint verdict is missing or
failed.

Open the real page and verify every approved state at the recorded route, viewport, locale, theme,
persona and fixture. For every authenticated or runtime-backed flow, follow
[`../starci-fe-design-review/references/live-flow-proof.md`](../starci-fe-design-review/references/live-flow-proof.md): use the declared app's authorized
test account, log in through the real UI, execute the approved flow, and inspect UI, Network, Console
and frontend/backend terminal output in the same time window. Append `### LIVE FLOW PROOF`; never
record credentials or tokens. A screenshot with an unexplained failed request or terminal error is
failed proof, and Apply cannot close while an approved flow is failed or blocked.

Feedback on the implementation is handled by revising the same source inside Apply and appending
`REJECTED` evidence. Feedback that changes the approved product thesis returns to Plan/Review.

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
