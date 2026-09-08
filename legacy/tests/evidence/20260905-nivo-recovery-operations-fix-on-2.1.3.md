# Closing the operations-history ownership discrepancy of the Nivo workspace auto-recovery feature (2.1.3)

Backend only, product `nivo`, feature `agentos-workspace-recovery`, runtime StarCi Skills **2.1.3** (`e17d79e3`),
processor Fable 5.1 standing in for the bound profiles (`boundProfile`/`ranProfile` on every receipt). The
previous mission (`tests/evidence/20260905-nivo-recovery-e2e-on-2.1.2.md`, session `20260905-131026-nivo-recovery-e2e`,
api.verify run `20260905-071250-8ff79ea`) proved the journey five of six as a client and reported one product
finding: `myAgentWorkspaceOperations` refused an owned workspace that has no provisioned instance while
`myAgentWorkspaceControlCenter` (fixed at `ca60f419`) answers it. This mission repairs it and proves the journey
again, six of six.

- Session: `<Source>/.worktrees/sessions/20260905-150800-nivo-operations-fix` (status `done`, `validate-session` green).
- Route: nivo/be, session worktree `D:/Repositories/nivo-be-ops-20260905-150800` cut from `nivo-backend` main `8ff79eae`,
  removed after the publish.
- Goal choice recorded `as-stated`, sourceRef the dispatch prompt (treated as the person's goal-confirm).
- Evidence slots imported at 100/1 (the architecture decision, 20260904-042654 step 21), 101/1 (the previous backend
  receipt, 131026 step 3/1), 102/1 (its seed plan, 3/2) and 103/1, 104/1 (its two identity receipts, 5/1 and 6/1). The
  blocked reconciliation of 131026 step 9/1 could not be imported (`origin is not the named completed producer`), which
  is the import gate doing its job: a blocked receipt is not a producer.

## The chain

`environment.preflight -> workspace.bind#be -> backend.generate (scope fix) -> runtime.serve -> {data.seed, quality.verify}
-> api.verify -> business.reconcile -> git.publish`. No identity.provision: the flow's two aliases already exist and the
preflight proved both sign in (`identity.flow.signin` ok with the flow named). No data.plan: `data.seed`'s `units` input
is optional, and the imported seed plan cannot be bound as `inputs.units` because a unit must come from a plan branch that
ran earlier in the chain (`validate-request`: "not produced earlier than step 5"), so the request carries no unit and the
seed is placed as the flow's one seed.

## The fix: one commit, two files

`793eaad8` on the session branch, scope `fix`, mode `apply`, inside the one write root
`src/modules/bussiness/agent-workspace-operations`:

- `agent-workspace-operation.service.ts` — `history()` resolves the workspace on `catalogOrder.user.id` (the key the
  control centre and the workspace list read) instead of `instance.owner.id`, with a line comment giving the consequence.
  A foreign or missing workspace still meets the one `AgentWorkspaceNotFoundException`. The admission path `request()` in
  the same service is left on `instance.owner.id` on purpose: an operation needs an instance to act on.
- `agent-workspace-operation.service.spec.ts` — two cases: an owned workspace with no instance resolves to `[]` and the
  `findOne` where clause is asserted; a stranger rejects with `AGENT_WORKSPACE_NOT_FOUND_EXCEPTION` and the operations
  read never runs. Both `it` titles open with a verb; the file lints clean.

The contract operation restated is `workspace-operation-admission` (writer `agent-workspace-operation.service.ts`, the
one whose writer the repair touches), facets `authorization` and `exception-identity`, proofs `unit` (4/4 on the committed
tree) and `conformance-read` (eslint 0 over both files, `git show --stat` two files). Preflight recorded at
`2026-09-05T08:14:37Z`, the commit at `08:15:27Z`; reflog HEAD 2 → 3, stash 0 → 0.

## Runtime served on 3068

`runtime.serve` merged the session commit into `uat` under this session's lease (`26e18b5e` → `9693eee1`, two files, no
conflict; `git merge-tree --write-tree` reported none beforehand), ran the delivery gates on the merged head in the
integration worktree (typecheck 0, eslint over the delivered files 0, the delivered spec 4/4), and restarted the one
detached server through `scripts/serve-runtime.mjs` under the previous record (pid 10416 stopped, pid 30804 started,
listener 26796, cache kept, manifests unchanged). Entry generation 6 → 7, registry 47 → 49, lease taken at
`08:19:06Z` and released at `08:20:30Z`, no queue. The served head contains `793eaad8`, `8ff79eae` and `ca60f419`.

## quality.verify at 793eaad8

lint (overall) 0, typecheck 0, the three Nest builds 0, the whole unit lane 596 suites / 2732 tests (two more than the base),
coverage measured with no bar (statements 49.27, branches 43.3, functions 39.52, lines 50.91); verdict `pass`, nine surface
topics `not-applicable` (no frontend checkout bound), scorecard `ship`.

A mount hazard worth recording: the first unit attempt failed exactly one suite,
`agentos-module-studio-seeder.service.spec.ts`, because `.gitmounts/data` had been **cloned** into the session worktree at
its committed head (`34bdbe3e`) while the canonical mount carries 33 uncommitted changes, `module-registry/support-desk`
among them, that the suite reads. The clone was replaced by a working-tree copy (`robocopy /E /XD .git`) and the lane
passed whole; the first attempt is kept as `unit-coverage-attempt1-no-data-mount.log`. The lesson is the same as the
131026 note's and sharper: the data mount that gates and the pre-push hook read is the canonical **working tree**, not
the mount's commit.

## Seed and identities

No account was provisioned: `uat-workspace-recovery-owner-131026` and `-stranger-131026` exist at realm `nivo` and the
preflight's sign-in probe (password grant, credential resolved by name through sops into the request body, 32 characters,
never printed) answered 200 for both. `data.seed` redrafted the flow's seed directory for a fresh namespace
`uat-workspace-recovery-20260905-082130-793eaad` — unit prefix `1508`, every instant shifted to the seed time — and placed
twelve rows through `psql` inside `nivo-postgres` (credentials by `POSTGRES_USER_FILE`/`POSTGRES_DB` inside the container):
three orders, three workspaces (unprovisioned, healthy, suspended-and-due), two instances, two recovery rows, two completed
jobs. The store held none of the ids before and every id exactly once after; rollback by exact id.

## api.verify — run 20260905-082130-793eaad

Record at `.worktrees/e2e/workspace-recovery/api/runs/20260905-082130-793eaad/result.json` (pointer and history line
appended). The suite ran as a client of `http://127.0.0.1:3068/graphql`, pinned at `793eaad8`, served head `9693eee1`.

| Case | Status |
| --- | --- |
| `control-centre-null-instance` | pass (16 ms) |
| `recover-not-owner-refused` | pass (52 ms) |
| `recover-owned-admitted` | pass (18174 ms) |
| `core-failure-reversed` | pass (10 ms) |
| `recover-healthy-fenced` | pass (19 ms) |
| `namespace-clean` | **pass** (54 ms) — the case run `20260905-071250-8ff79ea` failed |

Lanes: contract pass, data pass, lifecycle pass. The data lane read every seeded workspace back through the API as the
owner (unprovisioned: instance null, history `success: true` with 0 items; healthy: recovery `healthy`; due: recovery
`idle` with `RECOVERY_TARGET_UNAVAILABLE`) and the due workspace as the stranger (the one not-found identity on both
queries), kept in `read-back.json`. The lifecycle lane verified the namespace read-only, then removed it by the seed's own
rollback (twelve `DELETE 1`; the scheduler created no operation row, having stopped at `RECOVERY_TARGET_UNAVAILABLE`
before dispatch); every id counts zero afterwards.

The runner's output and every file the branch wrote were swept for the credential (the spawn scrubs the child's
stdout/stderr against the resolved value as well).

## The unchecked ledger

`@worktrees/unchecked/nivo/agentos-workspace-recovery.jsonl` is unchanged: one line, `u1ae53fc646c8`
(`workspace-recovery` / `recovering-reached` / lane e2e / tier secondary), still open. `record-unchecked.mjs` on the done
api.verify branch appended and resolved nothing (`0 appended, 0 resolved`): the request names no `unit` and no feature, so
the writer addresses no ledger entry, and the run did not reach `recovering` for the same environment reason as before —
the dev stack declares no replacement target. The entry is carried in the reconciliation's `## Unchecked` and, being
secondary, does not stand in the way of `implemented`.

Noted for the tree: with `unit` absent the writer prints the ledger path as `nivo/null.jsonl` in its one-line summary
(`ledgerKeyOf` reads `requirements.feature ?? requirements.featureId`, which api.verify's request carries neither of); it
writes nothing there, so nothing is wrong on disk, but the line misreports the file it left alone.

## business.reconcile

The head of `agentos-workspace-recovery` is republished `implemented` over `implemented->implemented` at `793eaad8`:
object `4449e017`, claims `b5fd83c0`, coverage fingerprint unchanged (`6498d3f9…`), previous head `77f3c545` (already
archived). The forty-seven fact claims of the `c87accaf` reconciliation were re-bound to the delivered head — the line
ranges of twelve of them mapped through the unified diff hunks their files gained from the lint baseline (`fae6462e`),
the control-centre fix (`ca60f419`) and this repair, and spot-read at the new head — and one claim was added,
`operations-history-catalog-order-scoped`. All fourteen dimensions answer; the `recovery-observability` row cites the new
claim beside the control-centre projection and the api run that read both boundaries. Findings: two `info` (the discrepancy
closed; the target-less environment), one `info` on the remapped ranges, and the two `access-state` warnings of the
`c87accaf` reconciliation carried unchanged.

Publication was committed in the businesses worktree as `99978da7b` with **only this publication's paths staged**: the
feature directory, the two new objects, and the registry entry applied onto the HEAD version of
`business-registry-v1.json` as a staged blob (`git hash-object -w` + `update-index --cacheinfo`), because the working copy
of the registry carries two other sessions' uncommitted entries (`pro-subscription`, `course-advisor`) and several
untracked objects that are not this mission's to commit. A first publication attempt archived a head whose new claim's
`role` exceeded the 256-character limit of `claims.schema.json`; those two orphan objects were deleted before the
corrected head was published, so the store holds no unreferenced object of this session.

## git.publish

`git.publish` fast-forwarded nivo-backend `main` `8ff79eae` → **`793eaad8`** and pushed non-force through
`.husky/pre-push` (`lint:check` then `test:unit`, 596 suites / 2732 tests, with `PINNED_AGENTOS_CHART_PATH` as a backslash
path and the canonical checkout's `.gitmounts/data`); nothing bypassed, no tag. The session worktree's `node_modules`
junction was unlinked with `rmdir` (174 shims in the canonical `.bin` before and after), then the worktree and the merged
session branch were removed. `origin/main` = `793eaad8`.

## Done-when

| # | Line | Producer | Outcome |
| --- | --- | --- | --- |
| 0 | backend.generate scope fix + unit test | backend.generate | done (`793eaad8`) |
| 1 | quality.verify at the session head | quality.verify | done (pass) |
| 2 | runtime.serve on 3068 | runtime.serve | done (served `9693eee1`, gen 7) |
| 3 | data.seed a fresh namespace | data.seed | done (12 rows) |
| 4 | api.verify 6/6 | api.verify | done (run `20260905-082130-793eaad`, three lanes pass) |
| 5 | business.reconcile republish | business.reconcile | done (object `4449e017`, discrepancy closed) |
| 6 | git.publish into main | git.publish | done (`origin/main` = `793eaad8`) |

## Excludes honoured

No schema or migration changed, no frontend, no production deploy, no dependency install; 3068/8147/5499 were never
stopped except the one recorded nivo/be server restarted by the serve rung under the lease; no `--no-verify`, no reset,
force, stash or clean; no credential printed. The runtime is 2.1.3; only this evidence note was added under `.claude`.
