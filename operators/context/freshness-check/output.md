# `context/freshness-check` output

| Field | Meaning |
| --- | --- |
| `output.outcome` | `fresh`, `initialize-required`, or `blocked`. This is data; only the Skill machine selects the next state. |
| `output.receiptRef` | Exact current receipt for `fresh`; otherwise `null`. |
| `output.reason` | `current`, `missing`, `identity-drift`, or `invalid`. |
| `output.evidenceRefs` | Metadata evidence used by the comparison. |
