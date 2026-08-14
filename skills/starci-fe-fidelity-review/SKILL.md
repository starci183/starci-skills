---
name: starci-fe-fidelity-review
description: Render, review and revise a bounded StarCi frontend fidelity correction before production editing. Use after starci-fe-fidelity-plan freezes binding evidence and comparison identity. Writes no production source and ends with approval of one correction and file boundary.
---

# StarCi FE Fidelity Review

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Read `.workflows/fidel/<app>/<name>.md`. Lock the exact route, viewport, locale,
theme, persona, fixture, owner state and reference identity from Plan.

## PROCESS

Build the smallest correction as a review artifact and render before/after in the same frozen state.
Read [`../starci-fe-design-review/references/state-coverage.md`](../starci-fe-design-review/references/state-coverage.md)
for capture fallbacks. Feedback may revise the correction, but any new hierarchy, CTA, ownership,
behavior or reusable vocabulary returns to `$starci-fe-design-plan`.

Append each revision and rejection. Complete only when the user approves the measured difference,
the exact correction and its production file boundary.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the fidelity result; `CHANGES` details workflow,
artifact and evidence paths only. Append `## review`, then invite `$starci-fe-fidelity-apply`.
