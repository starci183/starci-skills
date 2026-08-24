# Execute `be/implementation`

This operator converts one approved backend boundary into source changes. Its input, output, context bindings, worker observations, patch draft, and receipts live only in the current task session. Do not persist intermediate operator data to `.worktrees`, the repository, logs, Qdrant, or a run directory.

## Step 1 — Validate and freeze the invocation

**Read:** the complete input object only.
**Context:** none. Do not resolve a binding before validation succeeds.
**Action:** run `validate-input.mjs`; freeze `runId`, all five `provided` references, target paths, target hashes, and orchestration profile.
**Session write:** store the validated envelope at `payload.session.inputRef`.
**Stop:** emit `blocked` when validation or reference ownership fails.

## Step 2 — Load business authority

**Read:** `payload.loads.business`.
**Context:** load exactly the declared revision from its `.worktrees/<project>/businesses/...` authority path into session memory. Do not load another project or business feature, and do not infer business behavior from source.
**Analysis:** compare its reference and revision with `provided.businessHeadRef`; record only match/mismatch evidence.
**Session write:** one value-safe binding under `scratchPrefix/business`. Do not copy the full business document into output.
**Stop:** emit `blocked` if the authority is missing, stale, rejected, or does not match the provided reference.

## Step 3 — Load boundary and operator knowledge

**Read:** `payload.loads.boundary`, `payload.loads.scope`, and the single `payload.loads.knowledge` entry.
**Context:** resolve the approved boundary and frozen coding scope from session memory; retrieve only `be.implementation` from the pinned Qdrant generation and content hash.
**Analysis:** verify approval identity, coding-scope identity, baseline commit, target-set hash, allowed changes, exclusions, and knowledge generation. Record applied rules and evidence, never a reasoning transcript.
**Session write:** normalized constraints at `scratchPrefix/constraints`.
**Stop:** emit `blocked` if a required binding is missing; emit `boundary-drift` if the approved boundary and resolved target set disagree.

## Step 4 — Verify exact source files

**Read:** only `payload.loads.source.targetFiles`. Repository-wide source context, source Qdrant, repository scans, and undeclared files are forbidden.
**Context:** each worker receives only its assigned target path, expected hash, allowed changes, and the minimum normalized constraints needed to inspect that target.
**Analysis:** calculate the current SHA-256 and report whether the file still matches the approved baseline.

Orchestration is resolved from `payload.loads.orchestration`:

- `economical`: the coordinator verifies files sequentially.
- `balanced`: up to three read-only workers may verify disjoint target files.
- `parallel`: up to five read-only workers may verify disjoint target files.

Workers write observations only to `scratchPrefix/source-checks/<worker-id>`. Workers must not modify source. The coordinator validates and joins every observation before continuing.
**Stop:** emit `source-drift` before any mutation when one hash differs; emit `blocked` when a file cannot be read safely.

## Step 5 — Prepare the bounded patch

**Read:** the joined source checks, normalized constraints, exact target contents, and declared allowed changes.
**Context:** do not load additional knowledge or source. If another file or rule appears necessary, the approved boundary is insufficient.
**Analysis:** produce a value-safe change plan containing target path, intended responsibility, applied rule, and expected observable result. Do not store chain-of-thought.
**Session write:** patch plan at `scratchPrefix/patch-plan`.
**Stop:** emit `boundary-drift` if correct implementation needs an undeclared file, import boundary, business rule, migration, or external mutation.

## Step 6 — Apply source mutations

**Read:** the validated patch plan and exact target files.
**Context:** coordinator only. Subagents and workers are not allowed to write product source.
**Action:** modify only declared targets and only within each target's `allowedChanges`. Preserve unrelated user changes.
**Durable write:** approved product-source files only.
**Session write:** before/after hashes and changed paths at `scratchPrefix/mutations`.
**Stop:** emit `blocked` if a safe atomic change cannot be completed; do not widen scope.

## Step 7 — Verify the mutation boundary

**Read:** changed targets, joined preflight hashes, and the patch plan.
**Context:** exact files only.
**Analysis:** confirm that every changed file was approved, no undeclared file changed, and every after hash is present.
**Session write:** change receipt at `produced.changeReceiptRef` plus minimal evidence refs. Tests and formatting remain owned by subsequent quality states.
**Stop:** emit `boundary-drift` if observed mutations exceed the plan.

## Step 8 — Emit output and register cleanup

**Action:** construct `output.schema.json`, ensure `payload.state` agrees with the root emitted state, validate with `validate-output.mjs`, and store it at `payload.session.outputRef`.
**Context lineage:** return references and revisions actually used; never return copied context, worker prompts, full observations, or reasoning.
**Cleanup:** list all scratch references in `payload.cleanup.scratchRefs`. The session runtime must purge input, output, loaded bindings, worker observations, patch plans, and receipts when the parent skill reaches any terminal state, including failure or rejection.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@business-head` | `payload.loads.business` | worktree-exact | bind the approved business revision without loading unrelated features |
| `@approved-boundary` | `payload.loads.boundary` | session | bind the exact approved paths, responsibilities, and exclusions |
| `@be-implementation` | `be.implementation` | qdrant | retrieve only the source-mutation law required by this operator |
| `@target-files` | `payload.loads.source.targetFiles` | exact-source | open only approved checkout files after their hashes are pinned |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | choose sequential or read-only fan-out execution |

No source-context load exists for this operator.
