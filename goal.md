# .claude runtime goal

> Status 2026-09-20: this is the 2026-09 session goal. The living target state for the
> `1.0.0-alpha.1` distless runtime is `.experiments/OPENSOURCE-GOAL.md` (draft until its S* rows
> hold). Where this file says `model/` or `ops/`, read `modules/models/` and `modules/ops/ops/` —
> the catalogs moved there; the old dirs land in `legacy/`.

Make the StarCi `.claude` runtime complete and defect-free, so workflows run autonomously to a
verified goal instead of stalling at `finished: blocked`.

## Done means

- Every operation kind sits in one canonical catalog (`modules/models/kinds.yaml`) with a declared
  family, role, record reads/writes and report contract; every executable operator
  (`modules/ops/ops/`) is either wired to a kind or explicitly marked ad-hoc. No orphan operators,
  no name drift.
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
  writes the goal as a `goals` row of the ledger DB (`store.setGoal`: machine contract + human
  read together, revision-stamped) — see §8 Persistence. There is no `goal.json`/`goal.md` file.
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
| interface.draw | SRS+SDS+brand+grammar → screens/flows — **allows: the codex-agent pool only, no fallback** (ImageGen names the operation agent, not an image-model version; the resolved model is whatever `write` is pinned to) | write |
| interface.asset | design → artwork assets — **allows: the codex-agent pool only, no fallback** (same route as interface.draw) | write |

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
codex-agent:   {provider: codex,  maxParallel: 10, models: {implement/write: gpt-5.6-luna, verify: gpt-5.6-sol, decide/plan: gpt-6-astra}}
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

## 5. op.dispatcher — parallel ASAP, never conflict

Objective: minimize wall-clock to `done`. Each tick the dispatcher admits the **maximal safe
set greedily** — every op whose prerequisites are met and conflicts are clear launches
immediately; nothing waits for a batch or a phase boundary. When structure blocks
parallelism, the dispatcher creates it: decompose (`implementation.plan` cut) rather than
serialize.

- Different tasks, non-overlapping **file-level write scopes** AND no write↔read crossing
  (a writer's files vs another op's declared reads), no contested lease, slots free,
  `fanOut.maxPerGroup` respected → parallel now.
- One task too big → `implementation.plan` cut: the seam op runs alone first (module
  wiring, DI, shared contracts), then children fan out parallel.
- `verifyAvoidsImplementRuntime`: a verify op never runs on the runtime that implemented
  the slice.
- **Saturate across providers, not within one.** Maximal width means filling every eligible
  pool concurrently up to its own cap — e.g. a 20-wide refactor runs `10 devin-agent +
  5 codex-agent + 4 claude-agent + 1 qwen-agent`, not 20 of one runtime. Owner weights set
  the split; capacity rebalance shifts share when a pool degrades; the global ceiling is
  `maxParallelOps` (20) and each pool's own `maxParallel` is its ceiling — hit them.
- The lane count is an output of independence structure, not a target. Parallel width is
  bounded by live provider capacity, `maxParallelOps` (20 global), verify bandwidth and
  merge throughput — never by an arbitrary fixed number, and never past a guard.
- Every admission/deferral carries a human-readable reason (debug trace §7).

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

## 8. Persistence — runtime 1.0.4

Everything a workflow needs lives in `.starciwork/runtime.sqlite`; the kernel never writes or
reads `.starciwork/_local` again.

- **The ledger DB is the record.** `<ledger repo>/.starciwork/runtime.sqlite` holds state, events,
  jobs, leases, goals, reports, contracts, checks, inbox, signals, loads, budgets and owner-named
  inputs (as bytes, not paths) — everything a workflow needs to continue, to be audited and to be
  archived. See `docs/ledger-db.md` for the schema, module API, two-phase reservation and migration.
  Its identity is a UUID minted once into its own `meta` row, never derived from the path — renaming
  the checkout, a junction, a case change or a UNC path cannot re-key it. It opens `journal_mode=WAL`
  by default (readers of `starci op-contract` never block the kernel's writes) and falls back to
  DELETE, recorded in `meta`, on a path WAL cannot use.
- **`_local` is import/export only.** `.starciwork/_local/workflows/<id>/` is never written or read
  by the kernel. `ledger-migrate` imports it once; `workflow-export` writes today's file layout back
  out for a human to read. A kernel that finds a `_local` workflow directory with no matching
  `workflows` row fails closed with `ledger-unmigrated` — it never reads the files as authority. An
  owner-named external input is put into the ledger's `inputs` table at goal time
  (`store.inputs.put`), never copied under `_local/inputs/<workflow>/`; a worker that needs the bytes
  on disk gets a digest-checked materialised copy under `os.tmpdir()/starci/inputs/`.
- **The machine DB holds only `ai/*` and machine budgets.** `%LOCALAPPDATA%/StarCi/runtime/machine.sqlite`
  is the cross-ledger arbiter for provider quota and machine budgets, which span ledgers by
  construction; nothing else lives there. Every other resource (repo fences, `maxConcurrentWriters`)
  is a ledger `resources` row, reserved in the same transaction as the job it belongs to.
  `runtime-budget.json` (Orca's own provider-quota probe, a different concept from the ledger's
  `budgets` table) lives beside the ledger at `.starciwork/runtime-budget.json`, never under
  `_local`.
- **Worktrees are scratch.** A worktree holds code and the git history; nothing durable lives
  there except what git tracks. Coordination files a detached worker needs (an owner-input helper's
  session token, a materialised input, a dispatch context file a host adapter must put on disk) live
  under `os.tmpdir()/starci/`, never under `.starciwork`.
- **The anchor is a tracked head, not the record.** `.starciwork/ledger-anchor.json` is small,
  human-readable and **committed to git** — the opposite of the ledger file itself. It names, per
  workflow, the last checkpoint's generation, its event-chain head digest and seq, written atomically
  right after that checkpoint's ledger transaction commits. A repository re-clone or a restored
  backup keeps the anchor even though `.starciwork/runtime.sqlite*` is untracked and does not travel
  with it; that is exactly what turns a lost ledger into a named refusal (`ledger-missing`, or
  `ledger-behind-anchor` when a stale file is restored in its place) instead of a silent restart at
  generation 0. The record stays the ledger — the anchor holds no state, only heads, and a healthy
  ledger regenerates it (`starci ledger-anchor --write`).
- **Ignore the ledger file in the host repository, not here — but track its anchor.**
  `.starciwork/runtime.sqlite*` (the WAL mode makes it three files) is a runtime file of the
  *product* repository this skill is installed into, not of this skill's own repository — add it to
  the product repository's own `.gitignore` (it is never product completion storage, the same as
  `worktrees/`). This runtime's own `.gitignore` gains no such rule unless a test starts creating one
  in-tree.
- **Deletion of a worktree resumes at the checkpoint.** Because the record is the ledger DB and the
  ledger DB is in the Work-owning repository — outside every worker's allowlist — a worktree
  deletion, a repo re-clone or a process crash all keep the record: recreate the worktree and the
  workflow resumes exactly at its last checkpoint. Nothing durable was ever inside the worktree.

## Contract rules

- **Typed I/O, never repo-scan.** The kernel hands an op exactly its declared inputs: record refs
  resolved to concrete file paths + digests, a bound file allowlist, the rendered prompt. Context
  is input, not something the model goes looking for.
- **Four typed input classes.** Every op declares concrete refs, resolved to paths + digests:
  - `records` — SRS/SDS/design/brand/Work node refs in scope.
  - `knowledge` — records under `knowledge/`: `patterns/{fe,be}/*`, `architecture-rules`,
    `design-patterns`, `code-pattern-enforcement`, `grammars/<name>`, `ui/*`,
    `application-stacks`, `coding-reference`. Implement ops consume the patterns of their lane;
    verify ops consume the same records as the standard they check against.
  - `checks` — executable commands the op must run and record with exit codes:
    `scripts/checks/check-scoped-lint.mjs`, `scripts/checks/code-patterns/*.mjs`, `scripts/checks/architecture/*.mjs`,
    `scripts/checks/acceptance.mjs`, `scripts/checks/proof.mjs`. `code.refactor` must declare the regression
    suite + architecture check it runs before and after (invariant evidence).
  - `stacks` — `.stacks/<env>/infra/compose/*` service defs and `.starciwork` schemas
    (`goal-plan`, `execution-request`, `execution-receipt`) for `runtime.operate`,
    `integration.verify`, `work.author`, `workspace.manage`.
- **`.claude` owns the layout of `.starciwork` and `.stacks`.** The canonical trees are
  `schemas/work-layout.yaml` (`.starciwork/features/<feature>/{business,architecture,ui,
  uat,implementation,integration}` + `brand/` + `_local/workflows/<id>/`) and
  `schemas/source-layout.yaml` (Work root binding). Every YAML carries a `schema:` const
  and every folder pattern in those files is fixed — ops fill `<id>` segments only, never
  invent paths. An op that writes at the wrong path/name/schema fails `checks:`
  immediately — layout is op input. Coverage: every node type in `work-layout.yaml` and
  every `.starciwork` record class needs a `*.schema.yaml` + runnable validator; every
  `.stacks` env/service file must conform to the declared topology (`scripts/checks/stacks.mjs`).
- **Pattern coverage parity.** Every record under `knowledge/patterns/{fe,be}/` must have an
  executable check under `scripts/checks/code-patterns/` (or an explicit `check: manual` marker with a
  reason). Current gap: comment/folder/function/naming/typing/imports/test patterns lack
  dedicated scripts — the tests workstream closes this matrix.
- **Per-op allow override.** `allows(op)` defaults to the role set and may only narrow.
- **Pool = quota window.** Runtime pools model real capacity boundaries; models are pinned and
  attested inside.

## Amendment — 2026-09-17

- **Concurrent disjoint writers on one repository are permitted.** Conflicts resolve at two
  fences, never by serializing the workflow: launch-time allowlist fencing keeps write scopes
  disjoint, and seal-time CAS/quarantine isolates a candidate whose sealed delta does not match
  what its report declared.
- **Big ops are cut before first launch.** An op too large for one attempt is decomposed into
  disjoint children and fanned out across provider pools (`implementation.plan`) before any of
  them launches — parallelism is created by the cut, not recovered after a failure.
- **No silent fences.** Every blocked `pending.kind` carries either a reconcile path (journal
  settle, exact-report re-admission, retry) or a named owner action (`needUser`, refusal). A
  writer lease that nothing can reconcile is a defect, not a wait state.
