# `fe/context-sync` input

Synchronize derived frontend design context only after business, page, and state identities are frozen.

## JSON architecture

| Section | Active supply | Passive runtime load |
| --- | --- | --- |
| Route envelope | State model emits `layout.generate / ready`. | None. |
| `payload.provided` | Project, route/freshness/state refs, Common package, and exactly one selected Grammar package. | None. |
| `payload.loads.source` | Source route identity. | Metadata first; deterministic exporter reads component source only on a cache miss. |
| `payload.loads.codingContext` | Canonical cache locations. | Current manifest metadata only before mismatch. |
| `payload.loads.knowledgeIndex` | Project Qdrant partition identity. | Active generation and document hashes only before mismatch. |
| `payload.loads.exporter` | Pinned exporter/schema/config identity. | Script bytes only for hash verification and execution. |
| `payload.loads.orchestration` | Execution policy. | Workers receive only changed document assignments. |
| `payload.session` | Ephemeral slots. | Purged at skill-terminal. |

Do not attach business bodies, Qdrant bodies, generated JSON bodies, or raw source to the model input.
