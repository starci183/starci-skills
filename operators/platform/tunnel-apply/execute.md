# Execute `platform/tunnel-apply`

This operator idempotently applies only one approved Cloudflare tunnel ingress and proxied DNS mapping, then proves public HTTPS. Every runtime object remains in the task session and is purged at each parent-skill terminal.

## Step 1 — Validate and freeze

**Read:** the complete input envelope only.
**Context:** none before validation.
**Session write:** freeze the accepted input at `payload.session.inputRef`.
**Stop:** run `validate-input.mjs`; stop on route, missing `platform-tunnel-plan-ready`, exact-binding, session-ownership, source-path, or orchestration failure.
**Orchestration:** the coordinator validates; workers receive no pre-validation context.

## Step 2 — Resolve plan authority and artifacts

**Read:** `payload.provided`, `payload.loads.artifacts`, and `payload.loads.knowledge`.
**Context:** resolve exactly `tunnelPlanRef`, `credentialReceiptRef`, and `approvalRef`; retrieve only pinned `platform.tunnel`.
**Session write:** record identities, revisions, and applied rule IDs at `payload.session.scratchPrefix/bindings`.
**Stop:** stop on missing, stale, duplicate, mismatched, undeclared, foreign-session, or plan-hash-mismatched approval bindings.
**Orchestration:** workers may verify disjoint revisions read-only; the coordinator joins results.

## Step 3 — Preflight exact source, command, and Cloudflare bindings

**Read:** `payload.loads.source.targetFiles`, `payload.loads.commands.commandRefs`, and `payload.loads.external`.
**Context:** open only hash-pinned route files, declared helper commands, exact account/tunnel/hostname/DNS/origin/probe resources, and opaque Cloudflare handles. Never enumerate the zone or reveal secrets.
**Session write:** write hashes, resource revisions, ownership facts, and value-safe conflicts to `payload.session.scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, undeclared scope, raw credential data, conflicting ownership, non-HTTP(S) ingress, or a helper command wider than the approved plan.
**Orchestration:** workers may inspect disjoint files and resources read-only. They cannot run helpers, use credential handles, or mutate state.

## Step 4 — Apply idempotently

**Read:** the complete joined preflight and exact helper/resource/credential bindings.
**Context:** no new account, zone, tunnel, hostname, origin, command, or credential may be loaded.
**Session write:** record command receipts and exact before/after Cloudflare revisions under `payload.session.scratchPrefix/execution`.
**Stop:** stop before mutation on stale ownership, widened scope, unavailable rollback boundary, or any difference from the approved tunnel plan.
**Orchestration:** the coordinator alone invokes the shared helper, uses opaque handles, mutates Cloudflare, and records mutations. Workers never mutate.

## Step 5 — Prove HTTPS and decide

**Read:** execution receipts and only the declared tunnel, DNS, origin, and public HTTPS probes.
**Context:** do not inspect adjacent DNS records, tunnels, hostnames, services, or zones.
**Session write:** write idempotence, ownership, proxied-DNS, origin-routing, TLS, and HTTPS evidence to `payload.session.scratchPrefix/evidence`.
**Stop:** choose `blocked` on conflict, stale or missing proof, DNS/tunnel drift, origin mismatch, or failed HTTPS. Choose `proved` only when all declared checks pass.
**Orchestration:** workers may perform disjoint read-only probes; the coordinator validates the join and owns the decision.

## Step 6 — Emit and register cleanup

**Read:** decision, receipt, mutation revisions, exact context lineage, evidence refs, findings, and scratch inventory.
**Context:** emit references and revisions only; never emit secrets, loaded values, logs, prompts, or reasoning.
**Session write:** write to `payload.session.outputRef` and list all intermediates in `payload.cleanup.scratchRefs`.
**Stop:** align root route, state, and exact manifest facts; run `validate-output.mjs`; never emit invalid output.
**Orchestration:** the coordinator emits; the parent skill purges every session object at all terminal states.
