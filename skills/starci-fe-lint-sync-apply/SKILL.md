---
name: starci-fe-lint-sync-apply
description: Apply the approved canonical FE lint wiring and repairs, then prove effective adoption with every canonical rule strict. Use after starci-fe-lint-sync-review approves the exact config and product change tree. Never copies the trust rules or suppresses a failure.
---

# StarCi FE Lint Sync Apply

Read [`../../skill-shape.md`](../../skill-shape.md) first.

## CONTEXT

Present the phase table under the exact heading `### CONTEXT`.

Require a user-declared `Project` or explicit `Frontend` and `Backend`, then resolve `Frontend` for this phase; never infer it from `Source` or `App`.

Print `CONTEXT`, read the approved Review and confirm `Repo / branch` plus `Touching` once.

## PROCESS

Apply the canonical wiring:

```powershell
node <trust-root>/scripts/sync-fe-lint.mjs --target <repo> --write
```

Make only approved repairs. Re-run target lint and prove effective adoption:

```powershell
node <trust-root>/scripts/audit-fe-lint-adoption.mjs --target <repo> --probe <production-file>
```

Only `ok: true`, strict canonical severities and no inline directives close Apply. A newly discovered
visible repair returns to Review.

If an approved lint repair changes visible product source or runtime behavior, follow
[`../starci-fe-design-review/references/live-flow-proof.md`](../starci-fe-design-review/references/live-flow-proof.md).
Use the declared app's authorized test account, run every affected flow, inspect UI, Network,
Console and frontend/backend terminal output, and append `### LIVE FLOW PROOF`. Never record
credentials or tokens. Config-only adoption with no product runtime delta records `not-applicable`
with diff evidence.

## OUTPUT

Use exact headings `### OUTPUTS`, `### CHANGES`, `### NEED APPROVALS`, `### WARNINGS`, `### REJECTED` and `### OWED`.

Print `OUTPUTS`, `CHANGES`, `NEED APPROVALS`, `WARNINGS`, `REJECTED` and `OWED` in that order.

Print the six canonical tables. `OUTPUTS` names canonical lint adoption; `CHANGES` details every
config and source path. Append `## apply` with before/after counts and commands. If called as a
sub-run, return to its owning phase.
