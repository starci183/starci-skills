---
name: starci-be-feature-review
description: Review and revise a StarCi or nivo backend feature brief before implementation. Use after starci-be-feature-plan names the schema evidence, operation family, exact file tree and test cases. Writes no production source and ends only with explicit approval of one revision.
---

# StarCi BE Feature Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Read `## plan` in `.workflows/feature/<app>/<name>.md`. `Touching` is the workflow
and review artifacts only. No complete Plan means return to `$starci-be-feature-plan`.

## PROCESS

Challenge the brief against the unfiltered live schema, the sibling operation family and the full
backend canon named by Plan. Review the exact file tree, database connection, transport, exception
identity, test matrix, e2e entry and live-call proof. Surface every unresolved product rule together.

Revise the brief after feedback and append each revision and rejection. Do not write handlers,
entities, resolvers or migrations here. Review completes only when the user approves one revision
and its exact production `Touching` boundary.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED`. `OUTPUTS` names the
approved capability and architecture concept; `CHANGES` details only workflow/review artifacts.
Append `## review` and the approved revision, then invite `$starci-be-feature-apply`.
