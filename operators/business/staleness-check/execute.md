# Execute `business/staleness-check`

## Step 1 — Validate the metadata-only envelope

**Read:** complete operator input.
**Context:** none before validation.
**Session write:** validated input at `payload.session.inputRef`.
**Stop:** reject invalid task ownership, project mismatch, route mismatch, or a path outside `.worktrees/<project>/businesses/`.
**Orchestration:** coordinator only; no worker can widen the load set.

## Step 2 — Compare freshness identities

**Read:** `payload.loads.businessMetadata` and `payload.loads.sourceMetadata` only.
**Context:** existence, approval status, revision hashes, business baseline commit, current routed source commit, and route revision. Never read business content, source files, Qdrant, Principles, Grammar, or frontend contracts.
**Session write:** comparison at `scratchPrefix/freshness-comparison`.
**Stop:** block on malformed or conflicting identities, or when refresh attempts exceed `maxRefreshAttempts`.
**Orchestration:** comparisons are deterministic and remain coordinator-only.

Decision order:

1. `blocked` when identities conflict or the bounded refresh loop is exhausted.
2. `initialize-required` when authority is missing, invalid, unapproved, route-stale, or its baseline commit differs from the routed source commit.
3. `fresh` only when project, route, approved head, content hash, revision, and source commit all agree.

## Step 3 — Emit the receipt or initialize route

**Read:** frozen comparison and scratch inventory.
**Context:** refs and hashes only.
**Session write:** a freshness receipt only for `fresh`, then the validated output at `payload.session.outputRef`.
**Stop:** never emit `fresh` without equality evidence; never persist the receipt beyond the parent skill terminal.
**Orchestration:** coordinator validates the output and registers terminal cleanup.

Do not run this consumer-read comparison between implementation and business reconciliation. That phase uses the frozen pre-delivery receipt plus delivery proof so an expected source commit advance cannot trigger reinitialization.
