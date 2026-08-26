# Execute `fe/ux-ui-resolve`

## Step 1 — Freeze the resolution phase

**Read:** the validated root state and `payload.provided` only. **Context:** distinguish `plan` from `close` before resolving any knowledge or target. **Session write:** freeze the UAT report hash, request set, phase, and prior-resolution identity at `payload.session.inputRef`. **Stop:** on phase/status mismatch, missing required fact, or a request set with duplicates. **Orchestration:** coordinator only.

## Step 2 — Bind exact evidence and ledgers

**Read:** `payload.loads.upstream`, `payload.loads.knowledge`, and `payload.loads.exactTargets`. **Context:** use only evidence for the visible defect and each request's current revision; do not infer desired behavior from source. In `plan`, targets must be `captured` or `proven`; in `close`, targets must be `approved`. **Session write:** normalized defect claims, state-treatment mappings, request revisions, and authority conflicts under `scratchPrefix/evidence`. **Stop:** on stale hashes, missing viewport/DOM evidence, owner expansion, or source presented as design authority. **Orchestration:** independent workers may inspect disjoint evidence lenses; the coordinator owns identity and conflict joins.

## Step 3 — Produce the repair contract or closure proof

**Read:** normalized evidence only. **Context:** in `plan`, classify each assertion as hierarchy, state semantics, Grammar object, copy, interaction, accessibility, or responsive behavior and name exactly one repair owner. In `close`, compare the rerun UAT report against the prior resolution assertion IDs and request identities. **Session write:** the canonical resolution artifact under `scratchPrefix/ux-ui-resolution`. **Stop:** if assertions are vague, treatments do not match their controlled states, messages contradict available controls, or rerun proof does not cover every assertion. **Orchestration:** workers may propose classifications; the coordinator emits the single canonical contract.

## Step 4 — Mutate only the request lifecycle

**Read:** the canonical artifact and exact target revisions. **Context:** `plan` changes each accepted request to `approved` with a bounded review; `close` changes the same approved requests to `resolved`. Product source and Grammar packages are never mutated here. **Session write:** one content-hash mutation descriptor per request under `scratchPrefix/request-mutations`. **Stop:** on path escape, conflicting review, non-idempotent rewrite, missing mutation receipt, or any request not named by the artifact. **Orchestration:** coordinator alone writes ledgers.

## Step 5 — Validate, emit, and clean up

**Read:** resolution artifact, mutation receipts, handoff identity, and scratch inventory. **Context:** `repair-ready` requires a typed downstream handoff; `resolved` requires all closure proof booleans and no handoff. **Session write:** validated output at `payload.session.outputRef`. **Stop:** before success if state, fact delta, mutations, request actions, or proof disagree. **Orchestration:** coordinator emits once; all task-session inputs, observations, drafts, and worker outputs purge at the parent skill terminal.
