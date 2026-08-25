# Execute `fe/request-review`

This operator turns one queued feedback request into an explicit durable review decision without resolving its authority target.

## Step 1 — Validate and freeze the invocation

**Read:** the complete input object only.
**Context:** no request, knowledge or approval evidence is loaded before validation.
**Session write:** freeze the accepted envelope at `payload.session.inputRef`.
**Stop:** stop on invalid state, missing `feedback-request-recorded`, foreign session references, unsafe target, or mismatched orchestration profile.
**Orchestration:** coordinator only.

## Step 2 — Resolve the request and review evidence

**Read:** `payload.provided`, `payload.loads.upstream`, `payload.loads.knowledge`, and `payload.loads.exactTargets`.
**Context:** load only `fe.request-lifecycle`, the exact request revision, and the declared review evidence. The request must be `captured` or `proven` with a valid per-session accepts/rejects ledger.
**Session write:** normalize current request status, proof, declared owners, proposed decision and priority under `scratchPrefix/constraints`.
**Stop:** stop on stale evidence, owner expansion, malformed ledger, conflicting prior review, or a request target outside `.claude/requests`.
**Orchestration:** workers may inspect disjoint evidence references read-only; the coordinator owns the decision join.

## Step 3 — Build the review decision

**Read:** normalized constraints and explicit reviewer evidence.
**Context:** approval requires sufficient current evidence and records `status: approved`; rejection records `status: rejected`. `urgent` changes queue order only and never waives proof.
**Session write:** write the canonical review draft under `scratchPrefix/request-review-draft` with decision, priority, evidence hash, owner subset, and concise rationale.
**Stop:** stop on ambiguous reviewer intent, contradictory evidence, raw transcript content, or a decision that implies an authority or product mutation.
**Orchestration:** coordinator alone canonicalizes the review; workers cannot approve, reject, or broaden owners.

## Step 4 — Verify and persist

**Read:** the canonical review draft, current request target, and expected emitted fact delta.
**Context:** preserve every feedback-session row and mutate only top-level `status` and `review`. Treat an identical decision as idempotent and block a conflicting decision.
**Session write:** store the accepted mutation descriptor and resulting content hash under `scratchPrefix/accepted-result`.
**Stop:** stop on target hash drift, incomplete persistence, path escape, owner expansion, or any mutation outside the request ledger.
**Orchestration:** coordinator alone upserts the exact approved target.

## Step 5 — Emit and clean up

**Read:** the accepted result, emitted route, and complete scratch inventory.
**Context:** emit references, revisions and one mutation descriptor only; do not copy the request or review message.
**Session write:** validate output at `payload.session.outputRef` and register every scratch reference for purge.
**Stop:** do not emit a completed review without exactly one content-hash mutation descriptor.
**Orchestration:** coordinator emits once; every session intermediate purges at the parent skill terminal.
