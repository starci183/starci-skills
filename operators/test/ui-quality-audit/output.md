# `test/ui-quality-audit` output

- `output.outcome`: one of `audit-findings`, `audit-pass`, `blocked`, `delivery-boundary-drift`, `delivery-in-boundary`, `delivery-pass`.
- `output.resultRef`: exact produced artifact or receipt reference, or null.
- `output.evidenceRefs`: exact supporting references.
- `output.findings`: bounded observable findings.
- `output.reason`: bounded explanation when no result is produced, otherwise null.
