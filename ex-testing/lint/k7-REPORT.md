# k7 REPORT — test lane (kernel-api + goal-entry specs)

## Files written (owned)

- `tests/kernel-api.spec.mjs` — NEW
- `tests/goal-entry.spec.mjs` — NEW

No source files touched. No commits.

## Test results (honest)

`node --test tests/kernel-api.spec.mjs tests/goal-entry.spec.mjs`
→ 10 tests: **4 pass, 0 fail, 6 skipped** (~1.6s)

### tests/goal-entry.spec.mjs — all 4 PASS against landed sources

- `define-goal --plan` writes nothing to sqlite: exits 0, `plan:true` in JSON, ledger file never created (the strongest proof — the `--plan` path returns before `openLedger`).
- `define-goal` real run creates workflows row (`phase='queued'`), goals row `revision=0`, inbox row `kind='goal' status='pending'` — verified via `inspectLedger`.
- `start-workflow --plan` prints `plan:true` + correct `workflowId`, and the inbox row stays `pending` (not claimed).
- `start-workflow` on a `phase='finished'` workflow exits nonzero (refuses a retired goal re-entering the queue).

### tests/kernel-api.spec.mjs — 6 tests written, all SKIPPED

`scripts/kernel/api.mjs` does not exist yet (sibling lane). Every test carries a dynamic skip (`fs.existsSync` gate) so the gate lane picks them up automatically once api.mjs lands — no edits needed here.

Coverage per contract: `survey` on empty workflow → exit 0 + JSON object with no invented rows; `enqueue` → jobs row pending/queued; `dispatch --job` without `--spawn` → prints packet, job NOT `running`; `settle --verdict pass --report <tmpfile>` → job leaves pending/queued/running + event appended; `incident` → incidents row exists; `retire` → `workflows.phase='finished'` + no pending inbox rows + goals rows preserved.

## Assumptions the api.mjs lane must match (or the tests will need adjusting)

- Subcommand verb first: `api.mjs <verb> --repo <p> --workflow <id> --json`.
- `enqueue` accepts `--kind <k> --op <op>`; job id is read back from JSON (`jobId`/`job_id`) or the DB, so `--job` naming on dispatch/settle is the only hard assumption.
- `dispatch` reads `--job <id>`; `settle` reads `--job <id> --verdict pass --report <file>`; `incident` reads `--op <op>`; `retire`/`survey` need only `--repo --workflow`.
- Job statuses assumed: fresh = `pending`/`queued`; settled pass = anything not pending/queued/running (succeeded|completed|…).

## Source notes (observed, NOT fixed — per lane rules)

- `define-goal.mjs`: the `--project <name>` flag described in the lane context does NOT exist yet (no `.workspaces/projects/<name>/work.json` handling) — sibling lane still owes it; my spec doesn't cover it.
- `start-workflow.mjs`: header comment still says `boot-kernel.mjs` / `scripts/route/boot-kernel.mjs` — stale docstring only, harmless.
- `start-workflow.mjs` non-plan path resolves ORCA (`where.exe orca`) and spawns a terminal — untestable in this lane without orca; only the `--plan` and finished-refusal paths are covered (both exit before any spawn).
- `ledgerFileFor` refuses a repo that IS the runtime root (`ledger-root-is-runtime`); specs always pass an explicit temp `--repo`.

## Conventions followed

`spawnSync(process.execPath, …)` per `tests/check-stales-cli.spec.mjs`; temp dirs in `os.tmpdir()` with `t.after` recursive cleanup per `tests/_ledger-fixture.mjs`; assertions via `inspectLedger` (read-only) so test handles never collide with spawned CLI writes.
