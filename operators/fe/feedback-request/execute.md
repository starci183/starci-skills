# Execute `fe/feedback-request`

This operator captures one feedback-aware frontend skill invocation as a stable upgrade request before later source work can fail or narrow the evidence away.

## Step 1 — Validate and freeze the invocation

**Read:** the complete input object only.
**Context:** no source or knowledge is loaded before validation.
**Session write:** freeze the accepted envelope at `payload.session.inputRef`.
**Stop:** stop on an invalid stage, missing `feedback-received`, foreign session reference, unsafe target, or undeclared owner.
**Orchestration:** coordinator only.

## Step 2 — Resolve bounded evidence

**Read:** `payload.provided`, `payload.loads.upstream`, `payload.loads.knowledge`, and `payload.loads.exactTargets`.
**Context:** retrieve only `fe.request-lifecycle` at its pinned hash, the declared feedback evidence, and its structured feedback record. The record must name what this session accepts and rejects. Do not load product source, raw transcripts, unrelated screenshots, business bodies, or another request.
**Session write:** normalize evidence identities and owner candidates under `scratchPrefix/constraints`.
**Stop:** stop when evidence is stale, target identity is unstable, or owner selection broadens the request.
**Orchestration:** workers may inspect disjoint evidence references read-only; the coordinator owns identity and target selection.

## Step 3 — Build the stable request

**Read:** normalized evidence, originating skill identity, project, owner candidates and negative boundary.
**Context:** the request contains concise observable feedback, upgrade candidates and acceptance criteria plus a `feedbackSessions` ledger. Each row uses a stable evidence fingerprint and records non-empty `accepts` and `rejects`, originating skill, owners and proof status; it never stores a raw transcript or expiring session URI.
**Session write:** write the canonical draft under `scratchPrefix/feedback-request-draft`.
**Stop:** stop on raw credentials, copied transcript bodies, volatile timestamps, absolute paths, or an unbounded acceptance criterion.
**Orchestration:** the coordinator canonicalizes one stable ID from project, responsibility and rejected behavior.

## Step 4 — Verify and persist

**Read:** the canonical draft and the current exact target when it exists.
**Context:** compare stable identity and canonical content; upsert the current feedback-session row by fingerprint, treat identical rows as idempotent, preserve prior rows, and block conflicting content under the same fingerprint.
**Session write:** store the accepted mutation descriptor and content hash under `scratchPrefix/accepted-result`.
**Stop:** stop on path escape, identity collision, incomplete persistence, or a target outside `.claude/requests`.
**Orchestration:** coordinator alone upserts the exact approved target and never mutates `.claude`, Grammar, or product source here.

## Step 5 — Emit and clean up

**Read:** the accepted result, emitted fact delta and complete scratch inventory.
**Context:** emit references, revisions and mutation descriptors only.
**Session write:** validate output at `payload.session.outputRef` and register every scratch reference for purge.
**Stop:** do not emit a recorded decision without one exact content-hash mutation descriptor.
**Orchestration:** coordinator emits once; all session intermediates purge at the parent skill terminal.
