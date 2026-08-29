# `deployment/migration` output

- `output.outcome`: one of `applied`, `blocked`, `not-applicable`, `rollback`.
- `output.resultRef`: exact produced artifact or receipt reference, or null.
- `output.evidenceRefs`: exact supporting references.
- `output.findings`: bounded observable findings.
- `output.reason`: bounded explanation when no result is produced, otherwise null.
