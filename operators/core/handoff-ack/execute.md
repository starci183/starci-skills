# Execute `core/handoff-ack`

## Step 1 — Bind the objective, consumer and handoff identity

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.

## Step 2 — Compare every artifact ref and content hash

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.

## Step 3 — Emit ACK and the exact purge set, or reject without purging

**Read:** only validated declared fields. **Context:** objective, artifact and hash identities only. **Session write:** typed result under the declared output or scratch ref. **Stop:** reject identity, approval, resume, or hash mismatch. **Orchestration:** coordinator-only protocol transition; workers cannot acknowledge or purge artifacts.
