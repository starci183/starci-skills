# Execute `delivery/impact-classify`

## Step 1 — Bind mission authority

**Read:** Validate the closed input, then resolve only the exact approved mission, fresh business revision, route receipts and `architecture.decision-analysis` knowledge.

**Context:** Keep approved authority and route identities; do not inspect product-source bodies or infer a server contract from UI code.

## Step 2 — Classify affected roles

Compare mission states and operations with the declared FE/BE boundary. Emit `backend-required` when a server-owned contract, invariant or persisted behavior changes. Emit `frontend-only` only when behavior, persistence and transport stay unchanged.

**Session write:** Store the rule matches, evidence refs and impact receipt under the current task session.

**Stop:** Block when authority is stale, role evidence conflicts or impact cannot be classified deterministically.

Use the selected orchestration profile only for independent evidence checks; the final classification remains one deterministic operator decision. Validate the output and register every scratch ref for terminal purge.
