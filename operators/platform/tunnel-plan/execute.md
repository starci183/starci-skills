# Execute `platform/tunnel-plan`

This read-only operator resolves one exact Cloudflare account, tunnel, hostname, origin, and ownership plan. All inputs, loads, observations, plans, and outputs remain in the task session and are purged at every parent-skill terminal.

## Step 1 — Validate and freeze

**Read:** the complete input envelope only.
**Context:** none before validation succeeds.
**Session write:** freeze the envelope at `payload.session.inputRef`.
**Stop:** run `validate-input.mjs`; stop on route, exact-binding, foreign-session, source-path, or orchestration failure.
**Orchestration:** the coordinator validates; workers receive no pre-validation context.

## Step 2 — Resolve exact authority and artifacts

**Read:** `payload.provided`, `payload.loads.artifacts`, and `payload.loads.knowledge`.
**Context:** resolve exactly `routeReceiptRef`, `hostnameRef`, `originRef`, and `ownershipRef`; retrieve only pinned `platform.operations`.
**Session write:** record identities, revisions, and applied rule IDs at `payload.session.scratchPrefix/bindings`.
**Stop:** stop on missing, stale, duplicate, mismatched, or undeclared bindings.
**Orchestration:** workers may verify disjoint revisions read-only; the coordinator joins all results.

## Step 3 — Inspect exact source and Cloudflare resources

**Read:** `payload.loads.source.targetFiles` and `payload.loads.external`.
**Context:** open only hash-pinned route declarations and declared account, tunnel, hostname, DNS, origin, and opaque Cloudflare handle bindings. Never enumerate the zone or expose credentials.
**Session write:** write value-safe hashes, resource revisions, ownership observations, and conflicts to `payload.session.scratchPrefix/preflight`.
**Stop:** stop on traversal, hash drift, undeclared resource access, raw secrets, zone-wide scope, ambiguous ownership, or a conflicting hostname/tunnel owner.
**Orchestration:** workers may inspect disjoint declarations or external resources read-only. They cannot mutate or use handles for writes.

## Step 4 — Build the value-free tunnel plan

**Read:** the complete joined preflight and accepted route facts.
**Context:** use no new file, endpoint, account, zone, tunnel, hostname, origin, or credential.
**Session write:** write the candidate plan to `payload.session.scratchPrefix/candidate` and proof to `payload.session.scratchPrefix/evidence`.
**Stop:** stop if the plan widens beyond one declared HTTP(S) ingress, changes ownership, contains a credential value, or lacks conflict evidence.
**Orchestration:** workers may compare disjoint read-only facts; the coordinator alone joins and selects the final plan. No participant mutates external or source state.

## Step 5 — Validate, emit, and register cleanup

**Read:** candidate plan, exact context lineage, evidence refs, findings, and scratch inventory.
**Context:** emit refs and revisions only; never copy loaded values, prompts, logs, or reasoning.
**Session write:** write accepted output to `payload.session.outputRef` and list every intermediate in `payload.cleanup.scratchRefs`.
**Stop:** align root route, state emission, and `platform-tunnel-plan-ready`; run `validate-output.mjs`; never emit a mutation or invalid output.
**Orchestration:** the coordinator emits; the parent skill purges every session object at all terminal states.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session-exact | bind exactly the four provided route facts |
| `@platform-operations` | `platform.operations` | qdrant | retrieve the only knowledge authority |
| `@exact-source` | `payload.loads.source.targetFiles` | exact-source | inspect only hash-pinned route declarations |
| `@external-bindings` | `payload.loads.external` | external-exact | bind exact Cloudflare resources and opaque handle custody |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | choose read-only topology independently of provider mapping |
