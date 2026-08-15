---
name: starci-workflow-drift-apply
description: Finalize approved StarCi workflow drift verdicts and route each repair to its owning Plan skill. Use after starci-workflow-drift-review approves classifications. Updates records only; never repairs production source while measuring it.
---

# StarCi Workflow Drift Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT` and read the approved drift Review. Confirm the record `Touching` boundary once.

## PROCESS

Append the approved verdicts, current evidence identities and routing to the drift workflow. If an
approved verdict says a historical record needs annotation, append a dated migration note; never
rewrite its original claim. Route fidelity drift to `$starci-fe-fidelity-start`, undecided product
change to `$starci-fe-design-plan`, backend capability drift to `$starci-be-feature-plan`, and rule
failure to `$starci-fe-upgrade-plan`.

Do not edit production source here.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names finalized verdicts; `CHANGES` details every workflow
annotation. Append `## apply` and name each routed Plan in `OWED`.
