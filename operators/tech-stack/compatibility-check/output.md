# `tech-stack/compatibility-check` output

| Field | Meaning |
| --- | --- |
| `output.outcome` | `compatible`, `revise`, or `blocked`; the Skill machine owns the route. |
| `output.checkedModelSha256` | Exact stack-model hash evaluated. |
| `output.receiptRef` | Completed evaluation receipt, or `null` when evidence blocked evaluation. |
| `output.checks` | Typed status and evidence for every compatibility axis. |
| `output.contradictions` | Structured evidence-backed incompatibilities. |
