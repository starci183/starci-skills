# w1 — kernel module report (was tinkle-9)

**Briefs:** `ex-testing/briefs/wave2/w1.md` + `_common.md` → `ex-testing/briefs/tinkle/tinkle-9.md` + `tinkle/_common.md` + `tinkle/_common-distless.md`.
**Deliverables:** `modules/kernel/{driver-loop,dispatch,verdict-contract}.yaml` — pure yaml, comments carry the context.

## Prior-work survey (done before writing)

- `modules/goal/{anatomy,archetypes,existing,legality}.yaml` — complete (tinkle-8.done present). The ambiguity ladder, backward-edge suspicion levels and `producesVocabulary` were reused and cited, not restated.
- `modules/ops/ops/*.yaml` — all 30 files present; each carries `route:` (tinkle-6) and a `produces:` list under `business:`. **Caveat:** `produces:` lives on the `business:` block, not inside `route:` — the route-block `produces:` backfill that `legality.yaml`'s KNOWN GAP asks for is still absent (route blocks carry `prerequisites:` only). Owned by another lane; noted, not touched.
- `modules/models/selection.yaml` + `modules/ops/registry.yaml` — present; cited as the route-model / route-op sources of truth.
- `modules/kernel/` — did not exist; created fresh. No tinkle-9.done / w1.done existed.
- `.dist/` still exists on disk (distless wave not finished) — left untouched; all citations point at `kernel/` source files, which exist and are a superset of `.dist/kernel/` (adds `dispatcher.mjs`, `trace.mjs`, `work-status.mjs`).

## What was written

### `driver-loop.yaml` — the reasoned half of the kernel
- **Operating model** (w1): chat = trigger only; `[Kernel] <project>` one long-lived agent per project; `[Op] <name>` ephemeral, dies at verdict settle.
- **The tick**: settle → pick → route → dispatch → wait, citing `kernel/kernel.mjs` head comment, `engine.mjs rank()/pulse()/settled()`, `dispatcher.mjs planDispatch` (file/lease/group launch rules, cut bounds), `route-op.mjs`/`route-model.mjs`/`selection.yaml`, `reserveOperation`/`beginLaunchIntent`/`launched`.
- **Verdict table**: pass → next leg; fail → route-table retries with real limits (`failed`→same ×3, `partial`→same ×5, rejected-report ×2, repairs ×3, gap routes ×2, `common.mjs` budgets, `incident()` progress fingerprinting); blocked → typed-blocker routes, `environment/authority/ask` → needUser, owner-bound → provision.ask; suspicion → backward edges.
- **Re-plan triggers**: S₀-measured-wrong (re-survey, `propagateInvalidation`), goal-identity-wrong (MUST escalate — `validateGoalRevision` rejects identity change), retry-exhausted, goal-completes.
- **Escalation ladder**: driver-alone (ORDER, RETRY, REPAIR-ROUTE) vs must-ask-owner (INTENT, SCOPE-WIDENING, IDENTITY-WRONG, ENVIRONMENT/AUTHORITY, BUDGET-EXHAUSTED) — mapped to `legality.yaml` ambiguity rungs.
- **Failure handling, seen in practice** (w1 requirement): agent-child-exit via **output staleness** — watchdog screen classification (`NEED-TRUST`/`NEED-PERM`/`CRASH`/`WORKING`/`DONE`/`EXITED`) + context-meter-unchanged ≥5–8min → `STALL?` (`watchdog.sh`, `watchdog-v2.sh`, `watch-v3.sh`), durable equivalent `reconcileWithOrca` + `dispatchLastWords`; **respawn policy** — own-fault `RESTART_LIMIT=3` vs infrastructure `INFRA_RESTART_LIMIT=12` (`infrastructureCause`), settle-before-respawn, never re-bind a Run; **permission-stall** — NEED-PERM/NEED-TRUST as events, pre-answered at spawn (`--permission-mode dangerous`, `--yolo`), credentials never stall a worker (settle-by-presence, `fill.mjs`); **kernel death** — supervisor health window 25min, launch window 10min, kernel-lock/supervisor-lock singletons.

### `dispatch.yaml` — the spawn contract (the brief's CORE)
The packet shape exactly as specified, then every field defined with its enforcing mechanism:
- `op` → full durable identity {workflowId, opId, attempt, generation} (`opIdentity`, job re-key on never-launched predecessors); `continuation.mjs` drift checks.
- `brief` → `modules/ops/ops/<id>.yaml` → rendered contract (`renderContract`, contracts table).
- `context.records` → closed read set; `firstConflict` read-vs-write protection; the two-asks exception.
- `context.owned_paths` → allowlist enforced at three walls: plan (`planDispatch`), report (`validateReport` allowlist), effect (`freezeDetectionCandidate` seal reasons); DEP_STALE re-verification debt on done-owned surfaces.
- `constraints.model` → `selection.yaml` eligibility → `eligibleModelSelection`; verify-ops avoid the implement runtime (`verifyAvoids`).
- `constraints.budget` → `ai/global` + `ai/provider:*` + `canonical-writer:*`/`runtime-projection:*` + `machine:*`, atomic `admission.reserve` TTL, `pulse()` renew/expire — uncertainty never frees capacity.
- `constraints.lease` → intent-v1 reservation; `leases_match_job` triggers `RAISE(ABORT,'lease-identity-drift')` (`ledger-db.mjs` ~273-284) — the "physically cannot record evidence for another job" property; `reservationPhase`/`staleLeaseProof` for drift.
- `returns` → hands off to verdict-contract.yaml; file first, signal second.
- Spawn mechanics: reserve → launch-intent → `terminal-create`/`read`/`send` → launched; `LAUNCH_WINDOW_MS=10min`; one op = one agent; prototype spawn lines cited.

### `verdict-contract.yaml` — the shell agent's output schema
- Two layers kept distinct: report `outcome` (`done|partial|failed|ask|blocked`, `starci/op-report@1`) vs kernel `verdict` (`pass|fail|blocked` per the packet).
- Evidence must pass byte-level checks: `ASSET_MISSING/EMPTY/MAGIC/STAMP/DIGEST`, `RUN_MEDIA_FAKE`, `RECEIPT_ORPHAN` (`check-work-artifacts.mjs`); `DEP_STALE` (`check-work-deep.mjs`); changed files computed from git, never from the report's claim.
- `suspicion` free text → three-level backward-edge mapping to `goal.revise` / `scope.define`+`provision.ask` / `provision.ask`-always.
- Accepts: schema-valid, identity-bound (exact job + leaseToken), kernel-reproduced, boundary-correct, rev-consistent (`adoptReportRev`).
- Rejects: done-without-proof, done-from-last-words (`writeLastWordsReport` never honours `done`), out-of-scope files, stale-lease settle, unverifiable evidence, unknown-effect fallback (SKILL.md lifecycle correction — only typed `effectState: none`), invented answers, quiet fixes.

## Verification (smoke checks)

```
$ node -e "import('./core/yaml.mjs').then(m=>{ for (const f of [3 files]) m.parseYaml(fs.readFileSync(f,'utf8')) })"
modules/kernel/driver-loop.yaml      OK object
modules/kernel/dispatch.yaml         OK object
modules/kernel/verdict-contract.yaml OK object
```
- All three files parse via `core/yaml.mjs::parseYaml` — pure yaml, no scripts under `modules/`.
- Boundary check: `git status` shows only `?? modules/kernel/` as my change. `.dist/` pre-existed and was not written; `knowledge/`, `modules/ops`, `modules/goal`, `modules/models` untouched. Other `M`/`??` entries in git status (SKILL.md, README*, INDEX.yaml, ex-testing/*) pre-date or belong to other lanes — not mine.
- Citations spot-verified against source: `leases_match_job` trigger + `lease-identity-drift` (ledger-db.mjs:273-284), `validateGoalRevision` identity rejection (goal.mjs:1292), `jobs.complete` stale-fence (jobs.mjs), `writeLastWordsReport` done-refusal (terminals.mjs:229), `reconcileWithOrca`/`infrastructureCause`/`INFRA_RESTART_LIMIT=12` (terminals.mjs:190-313), `planDispatch`/`verifyAvoids` (dispatcher.mjs:156-208), supervisor health/launch windows (supervisor.mjs:24, launch.mjs:8), watchdog stall/perm states (ex-testing/watchdog*.sh), kinds.yaml routes table (lines 830-989).

## Assumptions / noted

- `produces:` inside `route:` blocks is still missing (it sits under `business:`); `legality.yaml` already flags this as tinkle-1 backfill — **needed elsewhere**, not my files.
- The packet's `verdict: pass|fail|blocked` is documented as the agent-facing compression of the five-outcome report enum; the mapping is written down in verdict-contract.yaml §1.
- Brief sources were cited as `.dist/kernel/*.mjs`; the distless wave makes `kernel/*.mjs` canonical, so all citations use `kernel/` paths. Identical APIs verified for every function cited.
- `registry.yaml` generation: modules/kernel has no index/registry requirement in the brief; the three files are self-contained.

## Changed files
- `modules/kernel/driver-loop.yaml` (new)
- `modules/kernel/dispatch.yaml` (new)
- `modules/kernel/verdict-contract.yaml` (new)
- `ex-testing/lint/w1-REPORT.md` (new)
- `ex-testing/lint/done/w1.done` (new)
