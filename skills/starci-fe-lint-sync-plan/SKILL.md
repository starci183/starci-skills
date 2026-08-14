---
name: starci-fe-lint-sync-plan
description: Audit a StarCi frontend repository against the canonical FE lint set and brief the exact wiring and repairs required. Use when local plugins, vendored rules, weakened severity or adoption drift is suspected. Writes no target source and hands evidence to starci-fe-lint-sync-review.
---

# StarCi FE Lint Sync Plan

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print `CONTEXT`. Use `.workflows/lint/<app>/<name>.md`. `Touching` is the workflow only.

## PROCESS

Run the sync tool without `--write`, then audit the effective config against a real production file:

```powershell
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo>
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe <production-file>
```

Inventory canonical rules, local-only rules, severity drift, inline config, config files and product
paths that would fail after adoption. A report on correct code is a proposed rule defect, not product
debt. Write the wiring brief and candidate repair tree; write no target code.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names the adoption concept and measured gap. `CHANGES`
details only the workflow. Append `## plan`, then invite `$starci-fe-lint-sync-review`.
