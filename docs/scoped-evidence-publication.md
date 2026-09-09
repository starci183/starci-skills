# Scoped evidence publication

`previewEvidencePublication(workRoot, {directory, nodeId, name})` in
`workflows/evidence.mjs` checks a complete new bundle without writes. Its `ok`
describes publication readiness for the named owner and any additional evidence
bindings, including their declared input closure. `globalOk` remains the full
core preview verdict; `remainingErrors` preserves unrelated recoverable stale
diagnostics. A scoped pass never means the whole Work is valid or done.

Primary and additional bindings must match current input digests, and named
owners must be eligible rather than uninvestigated, blocked or suspended.
Aggregate prerequisites require their required children; an optional child
explicitly referenced remains an input. Structural errors anywhere still block.
Malformed manifests, wrong ownership, stale bindings, unsafe paths, missing or
changed assets and unsealed files cannot be dismissed as unrelated diagnostics.

`publishEvidence` uses this same preview, verifies the staged seal and renames
one direct `_local/evidence-staging/<name>` directory into a fresh canonical
evidence directory. Existing proof is never overwritten. Its original return
fields (`path`, `nodeId`, `seal`, `published`) remain, with `globalOk` and
`remainingErrors` added. Retain those diagnostics in the result report.

Publication records proof, not acceptance or completion. Keep normal workflow
authority and completion preflight. Hashes and synchronous checks detect observed
drift; they neither authenticate claims nor provide a cross-process filesystem
lock. The original core `previewEvidence` remains a global diagnostic API.
