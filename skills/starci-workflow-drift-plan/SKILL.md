---
name: starci-workflow-drift-plan
description: Select StarCi workflow records and lock the source comparison context for a drift audit. Use before trusting one old task, one app or the full workflow history. Reads records and source, writes only the drift workflow, and hands an exact audit matrix to starci-workflow-drift-review.
---

# StarCi Workflow Drift Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Print `CONTEXT`. Use `.workflows/drift/<app>/<name>.md`. State the record window: kind, app, task or
all known records. `Touching` is the drift workflow only.

## PROCESS

Inventory each selected record's latest Apply claim: production `CHANGES` or legacy `WROTE`, approved
decisions, rendered state identities and `Touching` boundary. Resolve the current source commit,
route, viewport, locale, theme, persona and fixture needed to compare them. Do not classify or repair
drift yet.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the audit matrix; `CHANGES` details only the drift
workflow. Append `## plan`, then invite `$starci-workflow-drift-review`.
