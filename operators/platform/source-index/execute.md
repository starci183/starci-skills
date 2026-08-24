# Execute `platform/source-index`

This operator indexes business authority and generated frontend-contract JSON by hash. It never loads broad repository source context.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Action:** run `validate-input.mjs`; freeze project identity, route refs, business revisions, snapshot identities, partition, and orchestration profile.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before any body load or Qdrant access on invalid schema, route, facts, or task ownership.

## Step 2 — Resolve routing and indexing law

**Read:** `payload.loads.artifacts` and `payload.loads.knowledge`.
**Context:** exact MCP config, route set, exclusion policy, and pinned `platform.source-index` only.
**Analysis:** verify partition ownership, permitted document kinds, exclusions, chunking identity, and knowledge hash.
**Session write:** `scratchPrefix/index-policy`.
**Stop:** stop on ambiguous partition, stale routing, excluded authority, or missing indexing law.

## Step 3 — Compare metadata before loading content

**Read:** business and frontend-contract metadata plus `payload.loads.index.currentDocuments`.
**Context:** hashes and identities only. Do not load document bodies yet and do not query source content from Qdrant.
**Analysis:** compare business by `documentId + contentSha256`. Compare frontend coding context by `documentId + sourceRevision + sourceFingerprint + contentSha256 + schemaVersion + generatorVersion + generatorSha256 + generatorConfigSha256`.
**Session write:** `scratchPrefix/dedup-plan` with `unchanged`, `upsert`, and `remove` IDs.
**Orchestration:** workers may compare disjoint metadata read-only; coordinator validates one duplicate-free join.
**Stop:** stop on duplicate document IDs, inconsistent hashes, partition mismatch, or incomplete join.

## Step 4 — Load and normalize changed documents only

**Read:** exact refs marked `upsert` in the dedup plan.
**Context:** load business only from declared `.worktrees/<project>/businesses/` revisions and frontend capability only from declared `.worktrees/<project>/coding-context/frontend/` JSON snapshots. Repository files, source-Qdrant results, unchanged bodies, and another project's artifacts are forbidden.
**Analysis:** validate each document schema, apply exclusions, normalize deterministically, chunk with the pinned chunker identity, and hash every point payload before embedding.
**Session write:** `scratchPrefix/changed-documents`, `scratchPrefix/chunks`, and `scratchPrefix/point-plan`.
**Orchestration:** read/normalize work may fan out by document. Workers return session point plans; they never write Qdrant.
**Stop:** stop on invalid JSON/schema, unexpected business revision, generator identity drift, excluded content, unstable chunk IDs, or hash mismatch.

## Step 5 — Commit one partition generation

**Read:** validated point plan, remove IDs, current generation, and expected partition revision.
**Context:** coordinator only; no new document or context loads.
**Decision criteria:** unchanged points are skipped, changed/new points are upserted, missing old points are removed or tombstoned, and readers never observe mixed generations.
**Action:** if all documents are unchanged, perform no write. Otherwise stage a new generation, upsert only changed points, apply declared removals, validate counts/hashes, and atomically activate it.
**Durable write:** only the declared Qdrant partition/generation. Workers never write Qdrant.
**Session write:** commit evidence at `scratchPrefix/index-commit` and candidate receipt at `scratchPrefix/candidate`.
**Stop:** stop rather than activate on concurrent revision drift, count/hash mismatch, partial upsert, or failed atomic switch.

## Step 6 — Emit and clean up

**Read:** dedup plan, commit or reuse evidence, activated generation ref, context hashes, and scratch inventory.
**Context:** refs and hashes only; never copy business bodies, contract JSON, chunks, embeddings, prompts, or observations.
**Action:** set `indexAction`, construct output, run `validate-output.mjs`, and register every scratch ref.
**Session write:** `payload.session.outputRef`.
**Stop:** do not emit before reuse or atomic activation is proved.
**Orchestration:** coordinator validates output and purges loaded bodies, chunks, embeddings, plans, and receipts at parent terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session | resolve exact MCP routing refs |
| `@platform-operations` | `platform.source-index` | qdrant | retrieve only indexing operations law |
| `@business-authority` | `payload.loads.business` | worktree-exact | load exact business heads only when hashes changed |
| `@frontend-contract-json` | `payload.loads.frontendContracts` | generated-json | load generated contract JSON only when identity changed |
| `@target-index-metadata` | `payload.loads.index` | qdrant-target | compare and commit one declared partition |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
