---
name: starci-fe-design-review
description: Challenge and revise an evidence-backed StarCi frontend design brief before source changes begin. Use after starci-fe-design-plan records the selected direction. Reviews contracts, ownership, states, file boundary and acceptance evidence; writes no HTML, JSX, CSS or production source and ends with one explicitly approved revision for starci-fe-design-apply.
---

# StarCi FE Design Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

Review settles what Apply will build. It does not build a second implementation for Apply to copy.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

`Touching` is the workflow and declared review evidence only. Read `## plan`; if it has no selected
direction, return to `$starci-fe-design-plan`. Review writes no target source.

## PROCESS

Challenge the selected direction against live contracts, existing source ownership, the relevant
[`../../fe/canon/uxui/layers/`](../../fe/canon/uxui/layers/) rules and
[`../../fe/canon/patterns/contract.md`](../../fe/canon/patterns/contract.md). Confirm exact target
paths, owner states, fixture identities and acceptance commands.

Inventory every proposed entry or owner and classify it as REUSE, EXTEND or NEW because no existing
relationship can express it. Reject duplicate shape under a second name.

Review two to four conceptual directions only when the Plan still carries a real unresolved product
choice. Create no HTML, JSX, CSS, design-code directory, copied component tree or production edit.
The approved revision must be precise enough that Apply can work directly in final source paths.

Use this loop until explicit approval:

```text
brief -> feedback -> revised brief -> workflow append -> brief
```

Record every rejection with its replacement and reason. Append `## review` with
`Approved revision: <identity>`, the exact production boundary, states and acceptance evidence. Then
invite `$starci-fe-design-apply`.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED`
and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

`OUTPUTS` names the approved concept and acceptance meaning. `CHANGES` details workflow/evidence
paths only. Production paths belong to the approved boundary, not to Review's written changes.
