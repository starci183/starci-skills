# Execute `fe/context-sync`

## Step 1 — Validate and freeze identities

**Read:** complete input.
**Context:** none before validation.
**Session write:** validated envelope at `payload.session.inputRef`.
**Stop:** reject mismatched project/route, Common as selected Grammar, or malformed hashes and paths.
**Orchestration:** coordinator only.

## Step 2 — Compare metadata and cache keys

**Read:** source, current coding-context, knowledge-index, and exporter metadata.
**Context:** hashes, commits, versions, package IDs, and generations only; load no bodies.
**Session write:** dedup plan at `scratchPrefix/context-dedup-plan`.
**Stop:** stop on cross-project partition, mixed generation, duplicate document ID, or unverifiable exporter identity.
**Orchestration:** metadata comparison stays coordinator-only because fan-out costs more than the work.

The coding-context cache key is source commit plus dirty fingerprint, exporter hash/version, schema version, and config hash. Knowledge keys use document ID plus full content hash. Common and exactly one selected Grammar must be present; a second selected Grammar blocks.

## Step 3 — Reuse or build canonical JSON

**Read:** no body on a hit. On a miss, execute `.claude/scripts/build-frontend-coding-context.mjs` against the routed FE checkout.
**Context:** raw TypeScript is consumed only by the deterministic AST exporter and never placed in model context. Validate the emitted plain JSON, write a temporary generation, then atomically publish `.worktrees/<project>/coding-context/frontend/current.json`.
**Session write:** exporter receipt and changed-document plan.
**Stop:** stop on exporter failure, invalid schema, source drift, output hash mismatch, partial publication, or an undeclared path.
**Orchestration:** one deterministic exporter process; no LLM worker reads source.

## Step 4 — Upsert changed records only

**Read:** only changed Principles, Grammar Common, selected Grammar, and coding-context JSON records. Unchanged bodies remain unloaded.
**Context:** changed derived documents only; raw source and unrelated knowledge are forbidden.
**Session write:** point plan, tombstones, and activation proof under `scratchPrefix/index`.
**Stop:** stop before activation on hash/count mismatch, duplicate IDs, cross-project payload, or partial upsert.
**Orchestration:** workers may normalize/embed disjoint changed documents; coordinator alone writes and atomically activates one generation.

## Step 5 — Emit and clean up

**Read:** reuse or activation proof and canonical manifest identity.
**Context:** refs and hashes only.
**Session write:** validated output at `payload.session.outputRef`.
**Stop:** never claim ready without canonical JSON and index-generation proof.
**Orchestration:** coordinator registers all loaded bodies, embeddings, plans, and receipts for skill-terminal purge.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@source-metadata` | `payload.loads.source` | source-metadata | compute freshness without source content |
| `@coding-context-metadata` | `payload.loads.codingContext` | generated-json-metadata | reuse a matching canonical generation |
| `@knowledge-index-metadata` | `payload.loads.knowledgeIndex` | qdrant-metadata | skip unchanged documents and prevent mixed generations |
| `@exporter` | `payload.loads.exporter` | deterministic-script | validate and run the AST exporter only on cache miss |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | assign only changed documents and keep coordinator-only writes |
