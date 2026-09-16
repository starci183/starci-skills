# .claude runtime goal

Make the StarCi `.claude` runtime complete and defect-free, so workflows run autonomously to a
verified goal instead of stalling at `finished: blocked`.

## Done means

- Every operation kind sits in one canonical catalog (`model/kinds.yaml`) with a declared family,
  role, record reads/writes and report contract; every executable operator (`ops/`) is either wired
  to a kind or explicitly marked ad-hoc. No orphan operators, no name drift.
- Workflows are goal-driven end to end (see below): intake in a chat app → frozen goal → kernel loop
  → verified completion.
- `devin-agent` is a first-class peer runtime (swe-2-max, paid tier) for implement/verify/write,
  admitted by explicit owner quota.
- The three live workflows (nivo-fe, nivo-be, agentos-business) reach their frozen goals.

## Non-goals

- No bypass of admission, quota, lease fencing or candidate isolation to force execution.
- No model-decided state transitions: the graph decides, models fill operation content.
- No free-text answer parsing; no LLM-generated UI.

## 1. Goal lifecycle — versioned, never file-edited

- A workflow starts in a **chat app** (Devin/Claude/Codex CLI), not in Orca. The chat runs the
  intake (`request.analyze`/`scope.define`), hands the result to the Orca host, and the kernel
  writes `_local/workflows/<id>/goal.json` (machine contract) + `goal.md` (human read).
- Goal is **frozen with `goalRev`** at approval. Every op, decision and artifact binds the rev it
  was derived from.
- Goal is **dynamic through `goal.revise` only** — a typed op that produces goal v(n+1) with a diff
  and bumps the rev. Everything derived from changed sections goes `stale` via the same
  invalidation machinery `business.revise` uses one level up. In-flight ops re-validate: input
  digest changed → re-run or prove unaffected. Reports settled on an old rev do not count toward
  the new rev. Direct file edits to a live goal are forbidden — they break attestation.
- A goal MUST carry a `done:` block of checkable metrics; the kernel refuses to enroll a goal it
  cannot evaluate. Owner approves the metrics block before any build op runs — that is where
  judgment is front-loaded.

## 2. Canonical op catalog — one chain, one purpose

`request.analyze → scope.define → business.decide → architecture.decide → interface.draw →
implementation.plan → build ops → test.author → verify ops → release.deliver`

Repair is a bounded route back upstream, never a parallel invention.

### A. INTAKE

| Op | Input → Output | Role |
|---|---|---|
| request.analyze | request+context → workflow selection + scope statement | plan |

### B. REQUIREMENT

| Op | Input → Output | Role |
|---|---|---|
| scope.define | request → bounded scope: nodes, deps, exclusions | decide |
| business.decide | scope → SRS record settled | decide |
| business.revise | srs-gap → SRS revised + rev bump | decide |

### C. DESIGN

| Op | Input → Output | Role |
|---|---|---|
| architecture.decide | SRS → SDS | decide |
| architecture.revise | sds-gap → SDS revised | decide |
| brand.decide | → brand record | write |
| interface.draw | SRS+SDS+brand+grammar → screens/flows — **allows: gpt-5.6-sol only** | write |
| interface.asset | design → artwork assets — **allows: gpt-5.6-sol only** | write |

### D. PLAN

| Op | Input → Output | Role |
|---|---|---|
| work.author | records → Work node fields/checks | plan |
| implementation.plan | too-big node → children with disjoint scopes | plan |

### E. BUILD

| Op | Input → Output | Role |
|---|---|---|
| frontend.implement | design+grammar → UI code | implement |
| backend.implement | SDS+decision → BE code | implement |
| code.refactor | code → restructured code, **behavior invariant**: a verify op runs the same regression check before and after | implement |
| runtime.operate | SDS → infra/migration/runtime change | implement |
| grammar.update | grammar-gap → grammar package + consumer bump | implement |
| content.generate | brief → content unit | write |

### F. PROVE

| Op | Input → Output | Role |
|---|---|---|
| test.author | code+SDS → authored test files (writes tests; never judges them) | implement |
| e2e.verify | code → API scenario + evidence | verify |
| uat.verify | running product → walk + evidence | verify |
| review.verify | code diff → findings | verify |
| integration.verify | code → live provider proof | verify |
| security.verify | code+config → vulnerability findings | verify |
| perf.verify | running product → performance evidence | verify |

### G. DELIVER

| Op | Input → Output | Role |
|---|---|---|
| release.deliver | build → remote outcome verified | implement |
| scope.retire | scope → retired, evidence preserved | implement |

### H. GOVERN

| Op | Input → Output | Role |
|---|---|---|
| decision.prepare | ambiguity → typed options for owner | decide |
| provision.ask | missing auth/resource → owner question | decide |
| docs.author | records+code → documentation | write |
| knowledge.repair | challenged rule → canonical fix | write |
| workspace.manage | purpose → workspace bound/validated | plan |

## 3. Runtime pools — pool boundary = quota-window boundary

One pool per independently-quota'd provider window; the model is pinned inside the pool per role
and attested at launch — never inferred from the pool name.

```yaml
devin-agent:   {provider: devin,  maxParallel: 0..10 owner-grant, models: {implement/verify/write: swe-2-max}, gate: explicit-workflow-quota}
codex-agent:   {provider: codex,  maxParallel: 8,  models: {implement/verify/write: gpt-5.6-sol(+luna easy), decide/plan: gpt-6-astra}}
claude-agent:  {provider: claude, maxParallel: 6,  models: {all roles: claude-opus-5}}
claude-fable:  {provider: claude, maxParallel: 2,  models: {verify/decide/plan/write: claude-fable-5-1}, budgetWindow: fableWeekly}
qwen-agent:    {provider: qwen,   maxParallel: 4,  models: {implement/verify/write: qwen3.8-flash(+max)}}
```

- `maxParallelOps: 20` global. Pool caps must stay within what the provider can actually serve —
  inflated caps only convert to cooldown churn.
- Per-role caps inside a multi-model pool (e.g. codex-agent decide ≤ 2) stop one role hogging the
  shared window.

## 4. Model selection per op — owner weights → capacity rebalance → deficit pick

1. **Owner weights first.** `workflow-approve --allocation "devin-agent=6,codex-agent=2,claude-agent=2"`
   is both the quota grant and the target share. User preference always wins over the algorithm.
2. **Live capacity rebalance.** `effectiveShare = targetShare × capacityFactor`, where
   `capacityFactor = 0` when cooling/refused/offline, `× (1 − budgetUsed/100)` on probeable provider
   windows, `× launch-status` for Devin. Freed share overflows **proportionally** to remaining
   runtimes — never dumped wholly on the largest deficit.
3. **Per-op pick.** Hard gates first: role allow ∪ per-op override → difficulty tier →
   avoid/restrictTo → quota slot free → cooling. Among `ready`, pick the largest
   `targetShare − inFlight` deficit; tie → adaptive score → round-robin.

## 5. op.dispatcher — maximize parallel, never conflict

Each tick asks: how many ops can launch right now without touching each other?

- Different tasks, non-overlapping **file-level write scopes**, no contested lease, slots free,
  `fanOut.maxPerGroup` respected → parallel.
- One task too big → `implementation.plan` cut: the seam op runs alone first (module wiring, DI,
  shared contracts), then children fan out parallel.
- `verifyAvoidsImplementRuntime`: a verify op never runs on the runtime that implemented the slice.

## 6. Ask — typed record, terminal renderer

- An op hits a blocker (`ask`, `authority`, `environment`, unresolvable gap) → kernel emits a
  **typed question record**: `{questionId, digest, goalRev, fields: [select|multi|text|confirm +
  options]}` — the model writes the question text and the closed option set, never the UI.
- Renderer = Orca terminal form (numbered options, typed fields). Input is schema-validated — an
  answer outside the offered options is re-asked, never guessed. An HTML form may be added later as
  a second renderer over the same record; the kernel path does not change.
- Every step is journaled (`asked → rendered → answered`), the answer binds the question digest and
  `goalRev`. Questions from different blocked ops resolve independently — no batch unblocking.
- The kernel may answer in place once, only from the offered options; anything else reaches the
  owner.

## 7. Debug trace — `debug: true` in config.json

Every dispatch/settle/block emits a human-readable line (a parallel `trace.log` beside
`events.jsonl`): which op, why picked (gap + requires state), exact inputs (file+digest), chosen
model + reason, what the op returned, and the block classification with its route. Debug off → the
existing event stream, unchanged.

## Contract rules

- **Typed I/O, never repo-scan.** The kernel hands an op exactly its declared inputs: record refs
  resolved to concrete file paths + digests, a bound file allowlist, the rendered prompt. Context
  is input, not something the model goes looking for.
- **Per-op allow override.** `allows(op)` defaults to the role set and may only narrow.
- **Pool = quota window.** Runtime pools model real capacity boundaries; models are pinned and
  attested inside.
