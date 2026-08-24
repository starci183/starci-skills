# `platform/source-index` output

The output is ephemeral task-session state and is purged with loaded bodies, chunks, embeddings, observations, and receipts at every `skill-terminal`.

## JSON architecture

| Section | Purpose |
| --- | --- |
| Root route fields | Emit `platform.mcp.publish / ready` with `platform-source-index-ready`. |
| `payload.decision` | Typed `ready` route key. |
| `payload.state` | Explicit completion state and emitted route. |
| `payload.produced` | Session receipt, action (`unchanged`, `upserted`, or `replaced`), generation ref, and actual durable Qdrant writes. |
| `payload.context` | Used refs and hashes, never copied business/source content. |
| `payload.cleanup` | Scratch refs and mandatory terminal purge. |
| `payload.evidenceRefs` | Session-only hash, dedup, and partition evidence. |
| `payload.findings` | Value-safe unresolved facts. |

An unchanged partition has an empty `durableWrites` array. Changed partitions list only committed Qdrant generation/partition effects.
