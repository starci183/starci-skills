---
name: starci-be-feature-approve
description: Challenge a StarCi backend feature plan, obtain explicit approval, then implement and prove exactly that approved backend boundary. Use after starci-be-feature-plan; this combines the former Review and Apply without skipping owner approval.
---

# StarCi BE Feature Approve

Read [`../../skill-shape.md`](../../skill-shape.md) and the complete `## plan` in the task workflow.

## CONTEXT

Print canonical `### CONTEXT`, including exact app, database, repository/branch, workflow and
production `Touching`.

## PROCESS

First challenge the live unfiltered schema, sibling operation family, exact file tree, database,
transport, exception identity, tests, e2e and live-call proof. Append revisions and rejections until
the owner explicitly approves one revision and write boundary. Do not write production source before
that approval.

After approval, implement only the named files. A newly required file or product rule returns to the
approval loop. Prove exhaustive handler cases, production-boundary e2e refusals and success, and a
live API call. Projection proof enters through the real broker. Append the approved revision,
commands, results and exact diff to the same workflow.

## OUTPUT

Print `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and
`### OWED` in order. Before approval, `CHANGES` contains workflow evidence only; afterward it matches
the approved production boundary exactly.
