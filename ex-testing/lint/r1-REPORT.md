# r1 — distless-migration test reconcile: fix the 6 remaining suite failures

Lane: `r1` (reconcile). Scope: the distless migration wave finished (10 lanes,
all done markers in `ex-testing/lint/done/`); this lane fixed the 6 remaining
failures in `node --test "tests/*.spec.mjs"` without reverting the migration,
restoring `.dist/`, or re-adding old-layout assumptions.

Constraints honored: `knowledge/` untouched (0 modified files), no `.dist/`
created, nothing committed, distless layout (`modules/models/index.mjs`,
`legacy/ops`, `core/runtime-root.mjs`) preserved.

## Result

`node --test "tests/*.spec.mjs"`: **2410 tests, 2399 pass, 0 fail, 11 skipped**
(previously 6 initial failures; an intermediate run showed 3 additional
late-decision replay regressions caused by this lane's first fix — also
resolved, see F7).

## Failures and fixes

### F1 — `tests/goal-contract.spec.mjs`: PREFER_THEN_OVERFLOW picked `devin-agent`, test expected `qwen-agent`

Root cause: stale test assertion. The allocator contract (documented in
`docs/runtime-allocation.md`, `docs/5-plus.md` §4, and enforced by
`tests/runtime-allocator.spec.mjs`) is: quota slots are target shares; the
pick is the largest `effectiveShare - inFlight` deficit; owner order breaks
ties only. Strict owner-order preference does not override a larger weighted
deficit.

Fix: updated the goal-contract assertions to the weighted-deficit contract —
the later 5:5 deficit tie resolves via owner order toward `codex-agent`.
`kernel/schedule.mjs`/`kernel/common.mjs` unchanged; allocator suite still
37/37 green.

### F2 — `tests/workflow-kernel.spec.mjs`: ungrounded input recovery not refused early enough

Root cause: the test created the missing-grounding condition by deleting a
legacy `goal.json` file that no longer exists in the 1.0.4 SQLite-backed store
(`store.paths.goalJson` gone), so the intended condition was never created and
recovery proceeded to downstream consumers.

Fix: test now deletes the goal row from the ledger `goals` table.
`recoverWorkflowInputReferences` (`kernel/inputs.mjs`) then refuses before
`refreshPreparation`, input consumption, host startup, or launch — verified by
the test.

### F3 — `tests/workflow-kernel.spec.mjs`: audit changed canonical Work/runtime bytes

Root cause: the immutability snapshot walked all of `.starciwork/` and treated
the 1.0.4 ledger layout's mutable runtime artifacts (`runtime.sqlite`,
`runtime.sqlite-shm`, `runtime.sqlite-wal`, `ledger-anchor.json`) as canonical
Work bytes. Audit legitimately updates those.

Fix: the test snapshot walker excludes the four ledger/runtime artifacts;
canonical Work files remain included and byte-identical through launch,
settlement and finding report.

### F4 — `tests/workflow-kernel.spec.mjs`: foreign-repository refusal duplicated (12 identical rows)

Root cause: each loop iteration re-appended an equivalent `outside this
repository` refusal instead of recognizing the existing refusal signature.

Fix (`kernel/kernel.mjs`): repeated identical refusals are deduplicated on the
stable reason + path set — one `workflow-input-repair` need-user item and one
refusal event are retained across retries.

### F5 — `tests/workflow-kernel.spec.mjs`: shared-ledger `usedToday` read as 0

Root cause: test clock mismatch — allocation used a frozen Sep 12 fixture
clock while the assertion read the ledger under real `Date.now()` (Sep 20);
the ledger correctly rolled the day and reset `usedToday`.

Fix: the test reads the shared ledger with the same frozen clock used by
allocation/release. `kernel/loads.mjs` bookkeeping itself was correct.

### F6 — `tests/candidate-multi-root.spec.mjs`: full-suite-only seal race → `quarantine` instead of `sealed`

Root cause: `sealRuntime` hashed source files first and copied them later.
Parallel tests regenerate evidence under
`examples/todo-app-backend/.starciwork/`; a concurrent write landed between
the two phases, so the staged bytes didn't match the manifest and
`verifyRuntimePin` correctly quarantined the torn copy
(`custody-path-touched`, `Runtime pin changed: …/evidence.yaml`).

Fix (`kernel/runtime-pin.mjs`):
- manifest hashes are computed over the bytes actually copied into staging,
  so the digest describes the sealed payload, not an earlier source read;
- generated runtime-local state under `.starciwork/_local` is excluded from
  authored example-document collection;
- files that disappear or change mid-seal get bounded retry; the stage is
  still published atomically.

This also fixed the full-suite `public retry first enrolls an approved
workflow without inventing a retired event generation` pin failure, which was
the same torn-copy race.

### F7 — regression introduced and fixed within this lane: `tests/engine-kernel-flow.spec.mjs` late answered-decision replay (3 tests)

The consumed-report filter added in `acceptReports` (`kernel/kernel.mjs`)
initially required `consumedAt === null`; the test fixture's stubbed report
rows carry no `consumedAt` field, so `undefined !== null` filtered them out
and the late-decision replay produced no actions.

Fix: filter uses `report.consumedAt == null` so absent `consumedAt` (stub
rows, older shapes) counts as unconsumed while archived rows are still
skipped. All 7 engine-kernel-flow tests green.

## Targeted validation

- `tests/engine-kernel-flow.spec.mjs` — 7/7
- `tests/workflow-kernel.spec.mjs` — 154/154
- `tests/runtime-allocator.spec.mjs` — 37/37
- `tests/goal-contract.spec.mjs` — 18/18
- candidate/identity/pin combined — 62/62

## Full suite

```
node --test "tests/*.spec.mjs"
tests 2410 | pass 2399 | fail 0 | skipped 11 | duration ~294s
```

## Files changed by this lane

- `kernel/kernel.mjs` — refusal dedup on stable reason+path signature;
  `acceptReports` consumed-report filter (`consumedAt == null`).
- `kernel/runtime-pin.mjs` — seal hashes staged bytes, excludes `_local`
  generated state, bounded handling of mid-seal source churn.
- `kernel/store.mjs` — consumed-report bookkeeping supporting the dedup path.
- `tests/goal-contract.spec.mjs` — assertions updated to weighted-deficit
  contract.
- `tests/workflow-kernel.spec.mjs` — SQLite goal-row removal for the
  ungrounded case; audit snapshot excludes ledger artifacts; shared-ledger
  read uses the frozen fixture clock.

## Migration compatibility

- No `.dist/` created; `core/runtime-root.mjs` distless resolution unchanged.
- `knowledge/` untouched.
- Sealing still covers source dirs (`kernel`, `core`, `modules`, `models`,
  `scripts`, `schemas`, `knowledge`, …) plus authored example metadata; only
  runtime-local generated state is excluded from the sealed payload.
- No commit created.
