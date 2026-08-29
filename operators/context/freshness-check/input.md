# `context/freshness-check` input

| Field | Owner | Meaning |
| --- | --- | --- |
| `context.currentReceipt` | Runtime | Revision-bound metadata for the current cached generation, or `null`. The operator never loads the cached body. |
| `input.project` | Caller | Exact project identity. |
| `input.contextKind` | Caller | Expected generated-context kind. |
| `input.sourceFingerprint` | Caller | Exact source-input fingerprint. |
| `input.generatorFingerprint` | Caller | Exact generator and configuration fingerprint. |
| `input.contractVersion` | Caller | Expected generated artifact contract version. |
