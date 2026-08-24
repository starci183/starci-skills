# Execute `deployment/execution-root-init`

This operator initializes the ignored rebuildable deployment execution root. All intermediate data is session-only and purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** complete input only.
**Context:** none before validation.
**Action:** run `validate-input.mjs` and freeze route, refs, loads, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, facts, route, or task ownership fails.

## Step 2 — Resolve exact authority and law

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`.
**Context:** exact refs and pinned `deployment.lifecycle` only.
**Analysis:** verify identity, revision, ownership, approval, and freshness; record rules and evidence only.
**Session write:** `scratchPrefix/bindings`.
**Stop:** stop on missing, stale, ambiguous, rejected, or cross-release authority.

## Step 3 — Preflight exact execution boundary

**Read:** `payload.loads.commands`.
**Context:** declared files, commands, resources, and opaque handles only; raw secrets and broad source context are forbidden.
**Analysis:** verify hashes, checkout, resource revisions, capabilities, retry safety, and approval without executing.
**Session write:** `scratchPrefix/preflight/<worker-id>` and `scratchPrefix/preflight-join`.
**Orchestration:** workers perform independent read-only checks; coordinator validates join and alone owns execution and writes.
**Stop:** stop on drift, undeclared scope, raw secret, overlap, or incomplete join.

## Step 4 — Perform the operator decision

**Read:** validated bindings, joined preflight.
**Context:** load nothing undeclared.
**Decision criteria:** the root is ignored, release-scoped, reproducible, free of secrets, and derived from the approved plan.
**Analysis:** verify ignore evidence and create only declared directories and value-free metadata. Record value-safe evidence and conclusions, never chain-of-thought.
**Session write:** candidate `executionRootReceiptRef` at `scratchPrefix/candidate`.
**Orchestration:** economical is sequential; balanced/parallel may delegate reads. Coordinator owns commands, provider calls, decision, and join.
**Durable write:** only for `ready`: initialize ignored rebuildable .infra execution root.
**Stop:** emit one declared decision and never widen target, permission, provider resource, host, or approval scope.

## Step 5 — Emit and clean up

**Read:** candidate, decision evidence, lineage, and effect revisions.
**Context:** refs and value-safe metadata only.
**Analysis:** prove decision, state, route, facts, and effects agree.
**Action:** build output and run `validate-output.mjs`.
**Session write:** `payload.session.outputRef` and cleanup refs.
**Stop:** do not emit invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediates at parent terminal.
