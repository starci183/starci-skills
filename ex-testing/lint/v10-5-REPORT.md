# Lane v10-5 — REPORT: derived rebuild + deep-check baseline + final sweep

Date: 2026-09-19. Scope: `examples/todo-app-backend/.starciwork` and
`examples/ecommerce-app-be/.starciwork`. Writes this lane made: **8 files in `_derived/`**
(index.yaml, frontier.md, critique.yaml, critique.md × 2 trees — all by `example-derive.mjs` /
`example-critique.mjs --write`, nothing hand-typed) + **`_derived/deep-baseline.json` × 2**
(via `check-work-deep.mjs --write-baseline`), plus `ex-testing/lint/` report artifacts.
Zero records, zero evidence files, zero product source edited.

## 1. Wait phase — honored

Poll every 60 s from 22:06:26, log `scratch/v10-5-wait.log`:

| event | time |
| --- | --- |
| wait began (0/4) | 22:06:26 |
| `v10-4.done` | 22:24:23 |
| `v10-2.done` | 22:27:54 |
| `v10-1.done` | 22:29:30 |
| `v10-3.done` → 4/4 | **22:42:26** |

Secondary markers: `v7-13.done` 22:08, `v7-15.done` 22:15, `v9-4.done` 22:14, `v9-7.done` 22:41,
`v9-9.done` 22:27 all landed during the wait. `v9-10.done` had not landed by the 30-min
secondary window (~22:36), so this lane proceeded — then gave it a short bounded grace when it
proved to be mid-write, and it landed at ~22:56 with `uat.checkout.place-order` settled `done`
on a real passing run. **Only `v7-9.done` never landed** — v7-13's marker reports its render
captures arrived and its findings were absorbed.

## 2. `_derived/` rebuild — done three times, verified

`node scripts/example-derive.mjs --work <tree> --write` + `example-critique.mjs --write` per
v7-8's documented path. First pass 22:46–47; v9-10's in-flight edit
(`ec-be/.../uat/place-order/index.yaml`, 22:48:34) re-staled ec-be, so it was rebuilt again at
~22:49, and a third time for both trees at 22:57 after v9-10's marker. Final tallies:
todo-be 214 stateful records (143 done / 33 todo / 1 stale / 37 blocked, 41 gaps, 33 frontier);
ec-be 28 (15 done / 13 todo / 0 stale / 0 blocked, 3 gaps, 13 frontier — `place-order` and its
`gap.checkout.live-proof` settled by v9-10). `check-example-derived.mjs`:
"every derived index is fresh" — clean at 22:57 and at the final sweep 22:58:04.

## 3. `deep-baseline.json` seeded — DEP_STALE / NORM_UNRECORDED armed

`node scripts/check-work-deep.mjs --write-baseline` wrote both baselines (first 22:47,
re-seeded 22:57 post-v9-10 so the baseline reflects converged records). Post-baseline deep run:
`0 refused, 2 suspect, 3 info` — the baseline-backed checks execute and report zero drift.

## 4. Final sweep — see `v10-FINAL-STATUS.md` for the full truth table

Headline: **gate clean — 0 refused, 0 warned** (311 records, 2770 refs, 127 evidence files,
43 artifact payloads correctly skipped by v10-1's fix). Derived gate clean. Deep:
0 refused / 2 suspect / 3 info — down from the starting 23 suspects; the remaining pair are
genuine todo-be infra orphans (`/health`, `/webhooks` CAPABILITY_WITHOUT_SPEC).

Residual refused tiers belong to the v8 checks, not the gate: replay 3 (dead `x-session-token`
sed probes — v7-13's known unpinned scripts), surfaces 2 (UI_ROUTE_GHOST `/privacy`,
`/tasks/:taskId/schedule`), history 42 (dominated by `HEAD -> uncommitted` CHANGE_UNRECORDED —
the fleet's edits are not committed yet), consistency 15 (9 AC_NAMING_ASYMMETRY on ec-be br
records + 4 STATE_VOCABULARY_UNKNOWN — schema enums still `[todo,done]` vs the amended
four-state vocabulary), artifacts 38 (32 ASSET_DIGEST + 6 ASSET_MISSING — recaptured bytes vs
un-re-stamped manifests). Structure: `work-layout check` is report-only (517 + 203 findings —
checker doesn't know the example trees' `evidence.yaml`/`contract`/`gap`/`event`/`_derived`
conventions). `scripts/check-code-structure.mjs` (v8-7) **does not exist** — no script, report,
or marker; noted as N/A in the table rather than substituted.

Mid-flight context: a first sweep at 22:13–22:14 (`scratch/v10-5-pre.log`) and a second at
22:46–47 (`scratch/v10-5-final/`) captured the convergence — gate 337→311 records as payload
manifests were reclassified, deep suspects 23→2, gate transiently 1 refused at 22:51 during
v9-10's evidence rebind, back to 0 after it settled.

## 5. Reproduce

```
node scripts/example-derive.mjs   --work examples/todo-app-backend/.starciwork --write
node scripts/example-critique.mjs --work examples/todo-app-backend/.starciwork --write
node scripts/example-derive.mjs   --work examples/ecommerce-app-be/.starciwork --write
node scripts/example-critique.mjs --work examples/ecommerce-app-be/.starciwork --write
node scripts/check-work-deep.mjs --write-baseline
bash ex-testing/lint/scratch/v10-5-sweep.sh <outdir>   # runs all 11 checks
```

## Notes

- Hard rules kept: no fabricated evidence, no `provenBy`, no `stale:true` — this lane wrote
  only generated `_derived` output and lint reports.
- The `_derived` freshness race v7-8 §7 documented happened twice in this lane (v9-10 staled
  ec-be mid-flight); resolved by rebuilding after the last writer's marker — the honest fix is
  still "derived rebuild is the fleet's last step", which is what this lane was.
- **Handoff note:** `briefs/v11/_common.md` gates the v11 format-compression fleet on
  `v10-5.done` (among others). Within ~75 s of this marker posting, v11 lanes began mass-editing
  both trees (bulk `evidence.yaml` re-bind at 22:59:34). This lane's snapshot deliberately
  freezes the v10 convergence; v11-5 owns the post-compression gate update.
- Scratch/support: `scratch/v10-5-wait.{sh,log}`, `v10-5-sweep.sh`, `v10-5-pre/`,
  `v10-5-final/`, `v10-5-final2/`.
