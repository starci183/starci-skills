# Execute `context/freshness-check`

## Step 1 — Bind expected identities

**Read:** validated `provided` fingerprints. **Context:** hash metadata only. **Session write:** expected identity tuple. **Stop:** malformed identity. **Orchestration:** coordinator-only deterministic comparison.

## Step 2 — Decide cache reuse

**Read:** `loads.currentReceipt`. **Context:** receipt metadata only. **Session write:** freshness decision and receipt ref. **Stop:** invalid or forged receipt. **Orchestration:** emit `fresh` only for exact equality; missing or drifted metadata emits `initialize-required`.
