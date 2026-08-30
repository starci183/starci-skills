# `quality/delivery-proof` output

- `output.outcome`: one of `blocked`, `pass`.
- `output.resultRef`: exact produced artifact or receipt reference, or null.
- `output.evidenceRefs`: exact supporting references.
- `output.findings`: bounded observable findings.
- `output.reason`: bounded explanation when no result is produced, otherwise null.
- `output.adversarialDecision`: evidence-backed `add`, `change`, and `remove` dispositions required before terminal PASS.
