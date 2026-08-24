# Execute `fe/coding-scope-freeze`

## Step 1 — Validate approvals

**Read:** complete input and exact session artifacts.
**Context:** approved layout, source-fit, Principles, Grammar, and optional request receipts only.
**Session write:** validated envelope and approval join.
**Stop:** stop on identity, approval, task, or hash mismatch.
**Orchestration:** coordinator only.

## Step 2 — Rebind candidates

**Read:** canonical coding-context records named by candidate IDs and current source metadata.
**Context:** generated JSON and hashes only; Qdrant result text and raw source are forbidden.
**Session write:** candidate rebind proof under `scratchPrefix/rebind`.
**Stop:** stop when candidate generation/content hash differs from canonical JSON or source HEAD advanced.
**Orchestration:** read-only rebinds may fan out only when the profile threshold is met; workers receive one candidate each.

## Step 3 — Freeze exact headers

**Read:** declared file headers only.
**Context:** relative path, existence, SHA-256, and access mode—never file bodies.
**Session write:** immutable coding scope and validated output.
**Stop:** stop on ambiguous owner, scan requirement, undeclared path, or write outside approved roots.
**Orchestration:** coordinator joins a duplicate-free target list and registers terminal cleanup.
