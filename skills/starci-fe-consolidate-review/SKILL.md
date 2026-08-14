---
name: starci-fe-consolidate-review
description: Review and revise StarCi frontend consolidation verdicts before editing. Use after starci-fe-consolidate-plan freezes duplicate members and call sites. Writes no production source and approves merge, prop-variant, extract-composite or keep-apart verdicts with parity evidence.
---

# StarCi FE Consolidate Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print `CONTEXT`. Read the consolidation Plan. `Touching` is the workflow and parity artifacts only;
the measured source tree remains unchanged while its verdicts are reviewed.

## PROCESS

Show each frozen group with members, real call sites, owner meaning and one proposed verdict. Render
representative before states where appearance matters. Reject a merge of identical pictures with
different domain owners; extract the shared shape instead. Reject a variant prop that selects
structure or domain behavior.

Revise verdicts and artifacts after feedback. Append every rejection. Complete only when the user
approves the verdict and measured call-site boundary for every travelling group.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` lists approved consolidation concepts. `CHANGES` details
workflow and review artifacts, not future source edits. Append `## review`, then invite
`$starci-fe-consolidate-apply`.
