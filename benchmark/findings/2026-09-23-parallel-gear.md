# parallel-gear

## Practiced

The owner asked for one knob: a long task runs 3 agents, an extra-long one 6; gear up and
those become 5 and 10 (`fable.md` "parallel-gear", 2026-09-23). Everything else — which pool,
how many slots, what a slice is — stays where it already lives. Three holes had to close for
that knob to mean anything:

1. `api estimate` sized a cut from a 15–30 minute window and knew nothing about a size class.
2. `budgets.maxOps` was validated by `engine/config.mjs` and enforced by nobody.
3. `api status` reported a queued job's existence but never why it was still queued.

## Observed

### Ledger source

Read-only copy of `D:/Repositories/nivo-backend/.starciwork/runtime.sqlite` (6 033 408 bytes,
20 tables), taken 2026-09-23. The live tree was never opened.

**There is no measured closure in the ledger.** No `estimate` or `preflight` event kind exists
(31 kinds, none of them); no `jobs.payload_json` carries a file/assertion/component count. The
only closure measure the ledger holds is `reports.report_json.files` — the authored file list a
worker files with its report — and `jobs.payload_json.owned_paths`, which counts path *prefixes*
(a directory), not files.

### Population

Settled jobs of `backend.implement`, `interface.implement`, `code.refactor`, `test.author`,
`work.author` that carry both an `op-dispatched` and an `op-settled` event: **88**. Wall-clock is
`op-settled.created_at − op-dispatched.created_at`.

| filter | n |
| --- | --- |
| dispatched + settled | 88 |
| `report.files` present and non-empty, outcome `done` or `partial` | 57 |
| minus 5 stall outliers ≥ 600 min | **52** (the analysis set) |

Dropped stalls (all one overnight kernel gap, all `interface.implement`): files 3/4/5/5/8 at
852, 852, 874, 874, 875 min. A blocked job's wall-clock measures the block, not the work, so
`blocked`/`failed` outcomes are out of the analysis set.

### Windows

`allocation.slicing.targetMinutes: [15, 30]`. `estimate` divides by `targetMinutes[1]`, so one
slicing window = **30 min** and three windows = **90 min**.

### Duration by authored-file count (n = 52)

| files | n | median min | p75 | max | > 1 window (30 min) | > 3 windows (90 min) |
| --- | --- | --- | --- | --- | --- | --- |
| 0–4 | 17 | 12 | 21 | 57 | 4/17 (24%) | 0/17 |
| 5–7 | 11 | 9 | 14 | 64 | 2/11 (18%) | 0/11 |
| 8–11 | 9 | 17 | 25 | 71 | 2/9 (22%) | 0/9 |
| 12–15 | 8 | 9 | 30 | 73 | 2/8 (25%) | 0/8 |
| 16–25 | 3 | 46 | 46 | 96 | 2/3 (67%) | 1/3 |
| 26+ | 4 | 63 | 72 | 82 | 4/4 (100%) | 0/4 |

### Threshold scan — share of jobs at or above a file cutoff that exceed one window

| cutoff F | n ≥ F | > 30 min | share | n < F | > 30 min below F | share below |
| --- | --- | --- | --- | --- | --- | --- |
| 8 | 24 | 10 | 42% | 28 | 6 | 21% |
| 10 | 20 | 10 | 50% | 32 | 6 | 19% |
| **12** | **15** | **8** | **53%** | **37** | **8** | **22%** |
| 13 | 9 | 7 | 78% | 43 | 9 | 21% |
| 16 | 7 | 6 | 86% | 45 | 10 | 22% |
| 18 | 5 | 5 | 100% | 47 | 11 | 23% |
| 40 | 2 | 2 | 100% | 50 | 14 | 28% |

At `files ≥ 12` the median wall-clock is **46 min** against **12 min** below it — a 3.8× lift,
and the first cutoff where the majority of the population crosses one window. That is the one
threshold the ledger supports.

### The three-window class is unobserved

Of 52 jobs, **exactly one** exceeded three windows: `interface.implement`, 18 files, 96 min. The
two largest closures in the whole ledger (71 files / 82 min and 75 files / 49 min) are 2.7 and
1.6 windows, not 3. **The `xl` threshold cannot be derived from this ledger**, and
`allocation.slicing.size.xl.from` carries the `fable.md` sketch values as a declared assumption,
marked as such in `modules/models/runtimes.yaml`.

### Two confounds that keep these numbers weak

**Provider dominates file count.** Same analysis set, split by routed pool:

| pool | n | median min | median files | > 30 min |
| --- | --- | --- | --- | --- |
| `codex-agent` | 29 | 8 | 6 | 1 |
| `devin-agent` | 21 | 49 | 10 | 15 |

Within one pool the file count barely separates: `codex-agent` at files ≥ 12 has median 9 min vs
8 min below; `devin-agent` at files ≥ 16 has median 72 min vs 44 min below. The pooled 3.8× lift
is partly Devin's managed-worker latency, not closure size. Wall-clock also carries kernel
polling latency (`observeCadenceMs` 3 min, `watchdogCadenceMs` 5 min), so nothing under ~5 min
is resolvable.

**The population is already cut.** 36 of 52 rows are cut slices (`payload.cut` present:
`code.refactor` at `--cut-total 8`, `backend.implement` at 4–5, `interface.implement` at 3–5).
Their closures are per-slice, systematically smaller than the un-cut op closure a size class is
meant to classify. Median files: 8 for a cut slice, 7 for a whole op; max 75 vs 18.

`assertions` and `components` have **no measurement anywhere in the ledger** — no report field,
no event payload. Both `from` bounds for those keys are sketch values, not observations.

## Derived

### Data — `modules/models/runtimes.yaml` `allocation.slicing`

- `gears: [1, 2]` — the gear vocabulary, extensible without renaming.
- `size.l.from: {files: 12, assertions: 40}` — `files: 12` is ledger-derived (table above);
  `assertions: 40` is the `fable.md` sketch value, no measurement behind it.
- `size.xl.from: {files: 40, assertions: 150}` — both are `fable.md` sketch values. The ledger
  holds one job over three windows in 52 and cannot derive this class.
- `size.<class>.agents: {<gear>: <n>}` — `l: {1: 3, 2: 5}`, `xl: {1: 6, 2: 10}`, the owner's
  numbers verbatim.
- `weights`, `targetMinutes`, `maxSlices` unchanged: `estimate` still computes `minutes`,
  `perSliceMinutes` and `overTarget` from them, and `targetMinutes[0]` is the `s`/`m` boundary.
- `maxParallelOps` stays the fleet ceiling; the comment beside it now names `budgets.maxOps` as
  the per-workflow ceiling and states that the lower of the two wins.

### Owner knob — `config.yaml`

`parallel: {gear: 1}`. Integer, must be a member of `allocation.slicing.gears`, defaults to 1
when the block is absent, and fails closed on an unknown value like every other key
(`engine/config.mjs` `validateConfig`, `parallelGear`). `budgets.maxOps` keeps its shape.
Documented in `docs/config-format.md` "Parallelism".

### Where it is enforced

| rule | file |
| --- | --- |
| size class, gear, `agentsRequested`/`agentsAchievable` | `scripts/kernel/api.mjs` `cmdEstimate` |
| `min(budgets.maxOps, maxParallelOps)` ceiling | `engine/admission.mjs` `opSlotCeiling`, `admitOpSlot` |
| `max-ops` refusal | `scripts/kernel/api.mjs` `cmdRoute`, `cmdDispatch` |
| `queuedBecause` per queued job | `scripts/kernel/api.mjs` `cmdStatus` |
| contract | `modules/kernel/api.yaml` `estimate`/`route`/`status`/`dispatch` |
| prose | `modules/kernel/driver-loop.yaml` `cutExecution`, `modules/kernel/kernel-prompt.md` |

Gear never raises a pool's `maxParallel`, never raises `maxParallelOps` and never raises
`budgets.maxOps`. It only changes how many agents an `l`/`xl` op *asks* for; `s` and `m` are
always one agent.

## Open

- **Is gear 3 wanted?** `gears: [1, 2]` is a list precisely so a third entry is data, not a
  rename. Nothing in the ledger says what 3 would buy: the fleet ceiling is 20 and the largest
  single pool is 10, so an `xl` op at a hypothetical gear 3 would already be bounded by
  `maxParallel` before the table mattered.
- **Do `s`/`m` need a per-op override?** The boundary is `minutes <= targetMinutes[0]` for `s`,
  one rule for every op. `interface.audit` and `review.verify` are read-heavy and never write 12
  files, so they are structurally `s`/`m` under a file-weighted measure regardless of how long
  they actually take — the file weight is the wrong measure for them. A per-op `from` override
  under `size` would fix that without a second authority.
- **Only `files` and `assertions` carry a class bound.** `components` and `records` are weighted by
  `allocation.slicing.weights` and count toward `minutes` (so they can push a closure from `s` to
  `m`) but neither has a `from` bound, so a record-heavy or component-heavy closure with few files
  never classifies `l`. Adding one is a line of yaml; the ledger holds nothing to set it from.
- **The thresholds need a real closure measure.** They will stay guesses until `api estimate`'s
  own inputs are recorded. The cheapest fix: have the kernel pass the measured counts on
  `enqueue` so `job-enqueued` carries `{files, assertions, components}`, then re-derive this
  table against wall-clock in one workflow's time. Until then `l.from.files: 12` rests on 15
  observations and `xl.from` on none.
- **Provider is the larger term.** A size class that ignores which pool runs the slice explains
  less of the observed wall-clock than the pool does. If the fleet keeps routing `implement` to
  Devin, an `l` op at gear 1 buys less than the table implies.
