---
name: starci-workflow-drift-review
description: Compare planned StarCi workflow claims with current source, render state and decisions, then review each drift classification with the user. Use after starci-workflow-drift-plan locks the audit matrix. Writes no production source and approves exact verdicts and repair routing.
---

# StarCi Workflow Drift Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT` and read the drift Plan. `Touching` is the drift workflow and evidence artifacts.

## PROCESS

For every claim, verify that written files still exist and mean what the record says, new files
inside the old boundary are explained, approved decisions still hold and states render under the
same identity. Classify each difference as intentional later work, stale record, fidelity drift,
undecided design or unknown. Source is the answer; the record is the claim.

Show exact evidence, accept feedback and append revisions/rejections. Repair nothing. Complete only
when verdicts and owning repair capabilities are approved.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names approved drift verdicts; `CHANGES` details workflow
and evidence artifacts. Append `## review`, then invite `$starci-workflow-drift-apply`.
