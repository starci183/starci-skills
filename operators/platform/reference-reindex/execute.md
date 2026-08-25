# Execute `platform/reference-reindex`

## Step 1 — Validate, doctor, and freeze

**Read:** the complete input, portable-route receipts, versioned drift policy, and machine-local runtime metadata.
**Context:** metadata only.
**Session write:** validated input plus frozen route, reference, policy, runtime, and index-contract identities below `payload.session.inputRef`.
**Stop:** run `validate-input.mjs`; stop before mutation on a foreign task ref, a path outside `.worktrees/references/<project>-<role>`, a dirty or unfrozen checkout, an unpinned policy, or a non-loopback endpoint.

Run the reusable `reference-context doctor` contract. On a new machine it resolves `.workspaces/projects/*/*.json`, materializes clean reference checkouts, creates the ignored `.workspaces/local/state/reference-context` root, installs the pinned Python Qdrant Edge and MCP SDK environment, detects or installs Caddy, generates loopback-only config, and idempotently merges only the `starci-reference-context` Codex user entry. Credentials, environment values, generated configs, Python environments, checkouts, and database files never enter Git.

## Step 2 — Inventory eligible tracked blobs

**Read:** clean target commits and prior partition manifests.
**Context:** Git blob identities, paths, bytes, prior record counts, contract fingerprints, generation health, and ancestry only; do not load file bodies.
**Session write:** complete added, modified, deleted, unchanged, byte, affected-record, tombstone, compatibility, and cost evidence below `scratchPrefix/drift`.
**Stop:** stop on duplicate paths, an incomplete eligibility inventory, revision drift, a partition/reference mismatch, or metrics that cannot be reproduced.

The coordinator owns the final decision. Orchestration workers may inventory disjoint references read-only, but each reference has one worker and the coordinator rejects overlaps or incomplete joins.

## Step 3 — Choose `noop`, `incremental`, or `full`

**Read:** joined drift evidence and the exact adaptive-policy revision.
**Context:** metrics and compatibility only.
**Session write:** one decision and reason per reference below `scratchPrefix/decisions`.
**Stop:** stop if the decision is not deterministic under this precedence:

1. `full` for `manualFull`, missing/corrupt generation, index-contract fingerprint change, or incomparable Git history.
2. `noop` when eligible added, modified, and deleted sets are empty.
3. `full` when affected-record ratio, delete ratio, or estimated incremental/full cost crosses the resolved policy budget.
4. `incremental` otherwise.

Policy numbers are versioned input, never hard-coded operator truth. A percentage such as ten percent may be one profile value but is not the decision model.

## Step 4 — Build, activate, and prove

**Read:** changed bodies for `incremental`; all eligible bodies for `full`; no bodies for `noop`.
**Context:** exact selected files plus machine-local opaque runtime handles.
**Session write:** deterministic point catalogs, candidate receipts, activation receipt, MCP protocol proof, and full-text/path query proof below `scratchPrefix/activation`.
**Stop:** stop before activation on checkout drift, point identity collision, record-count mismatch, generated-path escape, non-loopback publication, failed protocol/query proof, or any credential/dependency-cache/build-output capture.

Use a maintenance lock so MCP cannot return mixed index state. Apply path-stable point upserts/deletes for `incremental`; create and prove a complete candidate before replacing the active partition for `full`; preserve the active generation for `noop`. Embeddings may enrich scoring when present but their absence cannot block readiness.

## Step 5 — Emit and clean up

**Read:** policy, drift decisions, runtime/client receipts, active generations, proof receipts, and scratch inventory.
**Context:** references, revisions, metrics, reasons, hashes, and opaque handles only.
**Session write:** validated output at `payload.session.outputRef`; register every intermediate for terminal purge.
**Stop:** do not emit `ready` unless every reference has a reproducible action, one active generation bound to its target revision, and successful loopback MCP plus full-text/path proof.

Generated checkouts, Qdrant Edge data, Python environments, Caddy config, Codex-local runtime receipts, inventories, and candidate generations remain ignored machine-local state. Only this reusable operator, runtime source, policy contract, installer source, and tests may be versioned.
