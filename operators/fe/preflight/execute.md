# Execute `fe/preflight`

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Session write:** validated envelope at `payload.session.inputRef`.
**Stop:** reject wrong route, task ownership, or an undeclared field.
**Orchestration:** coordinator only.

## Step 2 — Join receipt metadata

**Read:** exactly `payload.loads.receipts`.
**Context:** receipt headers and revisions only; never resolve semantic bodies, Qdrant knowledge, generated coding context, or source files.
**Session write:** equality proof at `scratchPrefix/receipt-join`.
**Stop:** stop on project, route, business revision, source commit, ownership, or revision mismatch.
**Orchestration:** no worker fan-out because three metadata joins are cheaper locally.

## Step 3 — Freeze scope and emit

**Read:** joined receipts plus target and write-root declarations.
**Context:** normalized paths and immutable identities only.
**Session write:** `frozenScopeRef`, `preflightReceiptRef`, and validated output.
**Stop:** reject an ambiguous target or a write root outside the routed workspace.
**Orchestration:** coordinator registers all refs for terminal cleanup.
