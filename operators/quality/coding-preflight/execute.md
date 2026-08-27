# Execute `quality/coding-preflight`

This operator binds one frozen coding boundary to its nearest maintained references and a dormant
static-gate plan. It does not mutate product source or execute lint, typecheck, coverage, or Sonar.

## Step 1 — Validate and freeze the boundary

**Read:** the complete input envelope, exact target hashes, coding-scope ref, and approved contract ref.
**Context:** none before input validation succeeds.
**Action:** run `validate-input.mjs`, verify every target is exact-file bound, and freeze the declared session slots.
**Session write:** `payload.session.inputRef` and a bounded boundary fingerprint.
**Stop:** emit `blocked` when the source boundary is stale, incomplete, or not frozen.

## Step 2 — Bind implementation and static contracts

**Read:** only the declared target, reference, ESLint, and TypeScript files.
**Context:** the nearest maintained implementation or template for the same responsibility, applicable ESLint rules and options, governing `tsconfig` references, public local types, and strictness settings. Do not scan unrelated source.
**Action:** derive concise coding constraints and record contradictions or missing references without expanding scope.
**Session write:** exact reference identities, revisions, and evidence refs beneath the declared session output.
**Stop:** emit `reference-gap` when a suitable reference or governing contract cannot be selected without boundary expansion.

## Step 3 — Prepare the dormant gate plan

**Read:** validated bindings and `payload.loads.orchestration`.
**Context:** the pinned lint, typecheck, coverage dependency, and Sonar commands with bounded timeouts; no command output because this operator does not run them.
**Action:** bind `staticGateTrigger=commit-or-explicit-gate-request`. Do not infer activation from coding, build, focused tests, deployment recovery, or UAT.
**Session write:** `preflightReceiptRef` and `deferredPlanRef`; both remain ephemeral until the parent skill terminal.
**Orchestration:** independent read-only preparation may run in parallel, while the deferred execution plan serializes Sonar after its required coverage artifact.
**Stop:** emit `blocked` if commands, toolchain identity, dependency order, or timeout ownership cannot be frozen.

## Step 4 — Emit and register cleanup

**Read:** the frozen bindings, plan, findings, and evidence lineage.
**Context:** return refs and revisions only; never include loaded source bodies, prompts, or chain-of-thought.
**Action:** align decision, state, root route, and emitted facts; construct `output.schema.json` and run `validate-output.mjs`.
**Session write:** `payload.session.outputRef`; enumerate all scratch refs in `payload.cleanup.scratchRefs`.
**Orchestration:** one coordinator owns the final route and deterministic join.
**Stop:** do not emit an invalid or partially joined output, run a static gate, or mutate source.
