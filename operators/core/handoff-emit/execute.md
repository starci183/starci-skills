# Execute `core/handoff-emit`

## Step 1 — Bind the objective and producer capability

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.

## Step 2 — Validate artifacts, candidates, mutation approvals and resume routes

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.

## Step 3 — Emit the immutable handoff and register ACK-bound retention

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.
