# Lane v11-4 — REPORT: evidence/run consolidation audit (both trees)

Date: 2026-09-19. Scope: `evidence.yaml` + `runs/` layout in
`examples/todo-app-backend/.starciwork` and `examples/ecommerce-app-be/.starciwork`.
Read first: `v11/_common.md` (WAIT GATE), `v11-4` brief.

## Wait gate

Cleared in full — no timeout. Polled `ex-testing/lint/done/` every ~3min from 22:13;
markers landed progressively (v9-4 22:14 → v10-5 ~22:55 → v9-10 ~22:58). All required
markers (v10-1..5, v9-2..10) present before first tree write at ~23:05. Sibling lanes
v11-1/v11-2/v11-3 were in flight during this lane; their churn is attributed below, not
claimed.

## What was done

Every `runs/<id>/` was brought to the target set `{manifest.yaml, result.md, screens/,
videos/}` + nothing stray. The six JSON sidecars and the two `.md` annotations were folded
**into the run's own manifest.yaml** under a `files:` map keyed by the original filename —
e.g. `manifest.yaml → files."cleanup.json".verifiedAbsent`. Original filename keys keep
every existing prose reference truthful: "cleanup.json's created/deleted/verified-absent
triplet" in evidence.yaml/index.yaml/gap records still names a real, locatable thing
(it is now a manifest section, not a loose file). Zero index.yaml/evidence.yaml edits were
needed → zero recordDigest churn attributable to this lane.

### Consolidation map (uniform across all runs)

| stray file | now at |
|---|---|
| `run-ledger.json` | `manifest.yaml files."run-ledger.json"` (schema `starci/uat-run-ledger@1` preserved inside) |
| `flows.json` | `files."flows.json"` (`starci/uat-flows@1`) |
| `ux-checks.json` | `files."ux-checks.json"` (`starci/uat-ux-checks@1`) |
| `walk.json` | `files."walk.json"` (`starci/uat-walk@1`) |
| `readback.json` | `files."readback.json"` (`starci/uat-readback@1`) |
| `cleanup.json` | `files."cleanup.json"` (`starci/uat-cleanup@1`) |
| `_VOID.md` / `_NOTE.md` (recur runs …43618Z, …44405Z) | `files."_VOID.md"` / `files."_NOTE.md"` as LF-normalized text |

## Numbers

- **Runs audited: 37** — todo tree 26 (login 7, notify 8, plan 1, recur 3, share 2, task 5),
  ec tree 11 (checkout/place-order 8, identity/sign-in 3; v9-9/v9-10 landed these mid-gate).
- **Strays fixed: 224 files** folded into 37 manifests, then deleted (222 `.json` + 2 `.md`).
  Post-apply re-audit: **0 runs with strays**.
- **Lossless check** (`scratch/_v114-lossless.mjs`): folded content deep-equals the original
  file bytes for every fold verifiable against git HEAD (6/6 committed sidecars exact, 0
  mismatches); uncommitted runs were folded at read time by the same strict YAML loader the
  gate uses.
- **evidence↔run link integrity: 7/7 resolve.** evidence.yaml files with a `run:` field:
  todo login→`…174721Z`, notify→`…144517Z`, plan→`…143402Z`, share→`…142709Z`,
  task→`…112844Z`; ec checkout→`…155312Z`, identity→`…152145Z` (v9-10's). All exist, all
  `assets[].path` under them resolve. 127 evidence.yaml files total; the other 120 carry no
  `run:` (assert/digest evidence — not in this link class).

## Reported, not fixed (cannot be solved by consolidation)

- **6 unsettled Sep-18 runs lack `videos/`** (login ×4: …061141Z/…070052Z/…080854Z/…090054Z;
  task ×2: …080854Z/…090054Z) — pre-video-harness history, append-only, none referenced by
  any evidence.yaml. Their manifests still *declare* `videos/*.webm` with a stamped sha256,
  producing the pre-existing ASSET_MISSING ×6. Dropping the declared-but-absent asset is a
  claim edit, not consolidation — left for the owning evidence lanes.
- `flows.json` steps serialize as `"[object Object]"` in the older runs — a harness bug
  frozen into historical evidence; preserved verbatim, flagged.

## Gate delta (my edits added zero refusals)

| check | before (this lane, ~23:00) | after | note |
|---|---|---|---|
| `check-example-work.mjs` | 15 refused | **3 refused** | remaining 3 are ec `recordDigest` stales on `br.checkout.place-order`, `ui.checkout.stock-refused`, `br.identity.sign-in` evidence — sibling-lane record edits, not this scope |
| `check-work-deep.mjs` | 79 refused | **78 refused** | strict subset (one NORM_UNRECORDED resolved by a sibling); DEP_STALE cascade is the post-baseline ac-collapse churn v11-5 re-verifies |
| `check-example-yaml.mjs` | — | **856/856 parse** | all rewritten manifests load under the strict runtime parser |
| `check-work-artifacts.mjs` | — | 38 refused | all media-level ASSET_DIGEST/ASSET_MISSING predating this lane (v10-5 recorded the same class at 37); none on `files:` content or sidecars |
| `check-work-history.mjs` | — | 40 refused | zero findings touch run manifests |

vs the v10-5 baseline (gate 0 / deep 0 at its sweep): the current counts are higher because
v9-10 landed and v11-1/2/3 edited records after the baseline was seeded — not because of
this lane. Refusal *sets* were diffed before/after apply: this lane added none.

`grep ac\.` both trees: 301 → 208 matching lines during this lane — entirely sibling lanes'
collapse/remap work; this lane created no ac references.

## Follow-ups named for the fleet

1. `schemas/work-layout.yaml` `uatRun:` still declares the retired file set
   (`run-ledger.json,flows.json,…`) — should now read `{manifest.yaml,result.md,screens/,
   videos/}` with sidecars as `manifest.files.*` (same for the `--help/_schema` copy and a
   `.dist` rebuild). v11-5 or the docs pass owns it.
2. Both `uat/lib/run-writer.ts` harnesses still *emit* the six sidecars — new runs will
   reintroduce strays until the writer folds them into the manifest itself.
3. evidence.yaml is intentionally NOT merged into index.yaml (per brief — digest churn).

## Reproduce

```
node ex-testing/lint/scratch/_v114-consolidate.mjs          # audit (0 strays expected)
node ex-testing/lint/scratch/_v114-lossless.mjs             # fold fidelity vs git HEAD
node scripts/check-example-yaml.mjs
node scripts/check-example-work.mjs && node scripts/check-work-deep.mjs
```
