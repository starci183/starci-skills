# workspace/device-checkpoint output

The output reports one atomic published-or-blocked checkpoint result. A successful result binds source-push receipts, the encrypted release identity and the remote manifest proof without retaining archive contents.

## JSON architecture

| Section | Ownership |
| --- | --- |
| `payload.state` | Declared route, stable code and retryability. |
| `payload.produced` | Session checkpoint receipt, pushed source heads, private release reference and bounded durable-effect names. |
| `payload.context` | Exact route, approval, contract and proof references actually used. |
| `payload.cleanup` | Purges operator scratch and observations at `skill-terminal`; encrypted archives remain only in ignored local runtime or private release assets. |
| `payload.evidenceRefs` / `payload.findings` | Sanitized proof references and bounded failures; never secret or service data. |
