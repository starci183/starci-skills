# Execute `test/ui-quality-audit`

## Step 1 — Validate and freeze

**Read:** the complete input envelope only.
**Context:** none before validation.
**Session write:** freeze the validated invocation at `payload.session.inputRef`.
**Stop:** stop before loads or browser actions when schema, route, facts, task ownership, orchestration identity, exact target paths, or declared refs fail.

## Step 2 — Resolve route, plan, and authority

**Read:** `previousStateRef`, `routeReceiptRef`, `auditPlanRef`, `targetSetRef`, `baselineRef`, and the pinned `fe.ui-quality-review` generation only.
**Context:** verified route metadata, closed audit-plan identities, and one exact Qdrant record.
**Session write:** normalized rule IDs, evidence requirements, and target identities at `scratchPrefix/constraints`.
**Stop:** stop as `blocked` when any identity is stale, ambiguous, unavailable, foreign, or requires forbidden context.

Verify that project, role, checkout, source revision, browser target, surfaces, states, viewports, and rule applicability form one closed current boundary. Normalize rule IDs and evidence requirements without copying the full knowledge body downstream. Business bodies, design exploration, broad source context, and external UI skill packages are forbidden.

## Step 3 — Validate execution boundary and cache

**Read:** exact command, browser, source, resource, credential-handle, sanitization, and cache headers.
**Context:** revisions and fingerprints only; no source bodies or browser observations.
**Session write:** accepted execution boundary and cache verdict at `scratchPrefix/preflight`.
**Stop:** stop on drift, traversal, raw credential, unsafe resource, or partial cache key.

Reuse is disabled by default. A candidate pass is usable only when the audit plan explicitly permits it and every route, surface, state, viewport, browser, source, knowledge, command, environment, and TTL field matches.

## Step 4 — Execute observable rule checks

**Read:** the validated execution boundary, declared browser handles, and applicable rule slices.
**Context:** one closed surface/state/viewport assignment at a time.
**Session write:** sanitized observations and evidence refs under `scratchPrefix/rules/<rule-id>`.
**Stop:** stop on undeclared navigation, UI bypass, scope expansion, unsafe state change, missing evidence, or unsanitized output.

The coordinator alone controls the browser. Economical orchestration is sequential; balanced or parallel orchestration may delegate disjoint read-only evidence classification, but workers never control the browser. Start from declared public entries and reach states through visible controls. At every declared viewport and state, evaluate only applicable stable rule IDs from `fe.ui-quality-review`. Capture positive evidence for passes and direct evidence for failures or blockers. `not-applicable` requires a bounded reason. Absence of a detected failure never becomes a pass.

Evidence may include sanitized accessibility trees, keyboard traversal, focus placement, computed contrast, target rectangles, overflow and fixed-region measurements, reduced-motion behavior, layout-shift entries, screenshots, and traces. Never inspect or mutate undeclared source, bypass UI controls to manufacture a state, or expose credentials.

## Step 5 — Decide and classify

**Read:** joined rule observations, frozen constraints, and approved baseline identity.
**Context:** rule results and evidence refs only; no new load.
**Session write:** candidate decision and complete rule-result set at `scratchPrefix/decision`.
**Stop:** stop on duplicate or missing rule IDs, unsupported decision, conflicting evidence, or classification outside the approved baseline.

Join exactly one result per declared rule ID. Standalone mode emits `audit-pass`, `audit-findings`, or `blocked` and never proposes repair. Delivery mode emits `delivery-pass`, `delivery-in-boundary`, `delivery-boundary-drift`, or `blocked`; classification uses the approved baseline and never changes it.

`delivery-in-boundary` requires that correction preserve approved layout, ownership, responsive transformation, business behavior, and source boundary. Any required change to those axes is `delivery-boundary-drift`.

## Step 6 — Emit and clean up

**Read:** accepted decision, rule results, context lineage, evidence refs, and scratch inventory.
**Context:** refs and revisions only; no copied evidence bodies.
**Session write:** validated output at `payload.session.outputRef` and complete cleanup registration.
**Stop:** do not emit invalid, partial, or unsanitized output.

Construct `output.schema.json`, validate it, and store only rule results, evidence refs, concise findings, revisions, and a receipt reference. Screenshots, traces, measurements, prompts, and observations remain session-local. Register every scratch ref for purge at the parent-skill terminal. This operator performs no durable mutation.
