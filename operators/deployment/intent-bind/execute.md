# Execute `deployment/intent-bind`

This operator binds routed business authority to one deployment target. All intermediate data is session-only and purged at every parent-skill terminal.

## Step 1 — Validate and freeze input

**Read:** complete input only.
**Context:** none before validation.
**Action:** run `validate-input.mjs` and freeze route, refs, loads, and session slots.
**Session write:** `payload.session.inputRef`.
**Stop:** stop before loading context if schema, facts, route, or task ownership fails.

## Step 2 — Resolve exact authority and law

**Read:** `payload.loads.artifacts`, `payload.loads.knowledge`, and `payload.loads.business`.
**Context:** exact refs and pinned `deployment.lifecycle` only. Load only the declared `.worktrees/business/` revision.
**Analysis:** verify identity, revision, ownership, approval, and freshness; record rules and evidence only.
**Session write:** `scratchPrefix/bindings`.
**Stop:** stop on missing, stale, ambiguous, rejected, or cross-release authority.

## Step 3 — Perform the operator decision

**Read:** validated bindings.
**Context:** load nothing undeclared.
**Decision criteria:** route, business revision, release, environment, target, and imperative request identify one target.
**Analysis:** reject stale or ambiguous targets and create a session deployment contract without infrastructure mutation. Record value-safe evidence and conclusions, never chain-of-thought.
**Session write:** candidate `deploymentContractRef` at `scratchPrefix/candidate`.
**Orchestration:** economical is sequential; balanced/parallel may delegate reads. Coordinator owns commands, provider calls, decision, and join.
**Durable write:** none; result is session-only.
**Stop:** emit one declared decision and never widen target, permission, provider resource, host, or approval scope.

## Step 4 — Emit and clean up

**Read:** candidate, decision evidence, lineage, and effect revisions.
**Context:** refs and value-safe metadata only.
**Analysis:** prove decision, state, route, facts, and effects agree.
**Action:** build output and run `validate-output.mjs`.
**Session write:** `payload.session.outputRef` and cleanup refs.
**Stop:** do not emit invalid or partially joined output.
**Orchestration:** coordinator validates output and purges all intermediates at parent terminal.

## LOADS

| Alias | Target | Kind | Why |
| --- | --- | --- | --- |
| `@provided-artifacts` | `payload.loads.artifacts` | session | resolve previous-state refs |
| `@deployment-lifecycle` | `deployment.lifecycle` | qdrant | retrieve only this operator law |
| `@business-authority` | `payload.loads.business` | worktree-exact | bind exact business revision |
| `@orchestration-profile` | `payload.loads.orchestration` | orchestration | select strategy independently of provider/model |

No repository source-context load exists for this operator.
