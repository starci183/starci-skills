# Execute `platform/sonar-service-reconcile`

This operator reconciles declared Sonar service and project enforcement. All inputs, observations, responses, and receipts remain session-only.

## Step 1 — Validate and freeze

**Read:** complete input only.
**Context:** none before validation.
**Action:** run `validate-input.mjs`; freeze provided refs, exact approval and plan hash, resource revisions, credential handles, and orchestration profile.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before provider access on invalid schema, route, or task ownership.

## Step 2 — Resolve policy and exact resources

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`, and `payload.loads.external`.
**Context:** exact project/profile refs, pinned `platform.sonar`, declared Sonar resources, and opaque handles only. Raw credentials are forbidden.
**Analysis:** verify project keys, expected source revisions, profile/gate identities, service endpoint identity, handle capability, and current provider revisions.
**Session write:** `scratchPrefix/bindings`.
**Stop:** emit `blocked` on missing custody, missing or stale approval, approval/plan mismatch, stale revision, ambiguous project identity, or undeclared resource.

## Step 3 — Inspect current Sonar state

**Read:** only declared service, project, profile, and gate resources.
**Context:** each worker receives one read-only resource identity and minimum expected state.
**Analysis:** return value-safe differences for service availability, project existence, profile assignment, gate assignment, and enforcement settings.
**Session write:** `scratchPrefix/provider-checks/<worker-id>` and joined map at `scratchPrefix/provider-delta`.
**Orchestration:** balanced/parallel modes may fan out independent reads; coordinator validates the join. Workers never mutate Sonar.
**Stop:** emit `blocked` if provider state is unreadable, overlaps conflict, or the join is incomplete.

## Step 4 — Reconcile the declared delta

**Read:** validated provider delta and exact enforcement bindings.
**Context:** coordinator only; load no additional project, profile, gate, or credential.
**Decision criteria:** every mutation is declared, idempotent, revision-guarded, and reversible or safely repeatable.
**Action:** create missing declared projects, bind exact profile/gate identities, and enforce only declared settings; verify resulting provider revisions.
**Durable write:** declared Sonar service/project enforcement state only.
**Session write:** before/after refs at `scratchPrefix/mutations` and candidate receipt at `scratchPrefix/candidate`.
**Stop:** emit `blocked` rather than widening scope or overwriting concurrent provider changes.

## Step 5 — Emit and clean up

**Read:** decision, mutations, used revisions, and evidence.
**Context:** refs and value-safe metadata only.
**Action:** construct output, align state and route, run `validate-output.mjs`, and register scratch refs.
**Session write:** `payload.session.outputRef`.
**Stop:** never emit invalid or partially verified output.
**Orchestration:** coordinator owns final validation and terminal purge.
