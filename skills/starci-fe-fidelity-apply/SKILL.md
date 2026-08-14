---
name: starci-fe-fidelity-apply
description: Apply the bounded StarCi frontend correction approved by starci-fe-fidelity-review and prove it with a before-and-after pair in the frozen comparison state. Use only after Review approves the exact correction and file boundary.
---

# StarCi FE Fidelity Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print the table, then **confirm `Repo / branch` and `Touching` with the user before the first
production write.** Once. A small fix changes the amount of code, not the authority required to
change it.

Read the approved `## review` in `<Source>/.workflows/fidel/<app>/<id>.md`. No approved
revision means `$starci-fe-fidelity-review` has not finished.

## PROCESS

Make the smallest correction that restores the expected result, in the files the plan listed,
following canon and the components already shipped.

**A file the plan did not name is a stop, not a detail.** Either the plan measured the defect wrongly
or the target moved; both are worth one line to the user before the write, and neither is worth
discovering afterwards in a diff.

If the target has moved and the frozen comparison no longer exists — the route renamed, the state
unreachable, the reference commit gone — that is a confirm row. Do not re-freeze it silently: a
comparison chosen after seeing the defect is a comparison chosen to pass.

**Render before and after for every touched state.** This lane is judged on a pair of images, and
green tests know nothing about what a screen looks like. When the browser refuses to composite, take
the fallback in
[`../starci-fe-design-review/references/state-coverage.md`](../starci-fe-design-review/references/state-coverage.md)
before recording any state as uncaptured — and when a capture tool lays the page out at a width it
was never given, say so and carry the measurement instead. An image that lies is worse than no image.

Typecheck, lint, focused tests and build must be green with nothing suppressed.

For several independent fixes, dispatch non-overlapping owner/file packets and integrate centrally.
One blocked packet does not hold the others.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the restored fidelity concept; `CHANGES` details
every written path. Append `## apply` with the CONTEXT, frozen comparison, before/after proof, green
commands, warnings, rejections and owed work.
