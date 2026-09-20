# v11-FINAL-STATUS — compact-format check battery

Closes the v11-5 deliverable: every check still runs and reports on the compacted
tree (inline `acceptance:`/`statements:` criteria, `parent#ac-id` refs, no authored
`provenBy`). Raw runs: `v11-5-runs/<check>.{before,after,final}.txt`.

- **before** — updated scripts against the pre-compaction tree (recorded by v11-5).
- **after** — updated scripts after the v11-1..4 collapse landed (recorded by v11-5).
- **final** — this lane's re-run on the current tree (w6, 2026-09-20); the examples
  trees have moved since `after` because in-flight lanes keep editing them.

## Battery (both trees: todo-app-backend + ecommerce-app-be `.starciwork`)

| Check | before | after | final | silent? |
|---|---|---|---|---|
| `check-example-work` (gate) | 311 records / 2783 refs / 127 evidence / 42 payloads skipped — exit 0 | 261 / 3138 / 127 / 43 — exit 0 | 261 / 3138 / 127 / 44 — exit 0 | no |
| `check-work-deep` | 0 refused / 2 suspect / 3 info — exit 0 | identical | identical | no |
| `check-work-artifacts` | 311 rec, 938 declared paths, 37r/58s/6i | 261 rec, 948 paths, 38r/61s/6i | 261 rec, 953 paths, 38r/61s/6i | no |
| `check-work-surfaces` | 2r/10s/6i | identical | identical | no |
| `check-work-consistency` | 311 rec, 5r/23s/10i | 261 rec, 4r/23s/10i | identical to after | no |
| `check-work-history` | 311 rec, 42r/53s/5i | 261 rec, 40r/83s/5i | 261 rec, 40r/83s/10i | no |
| `check-work-replay` | 266 replayable / 32 dead, 3r/123s/268i | identical | 265/33 dead, 4r/123s/267i | no |
| `check-example-derived` | pass (2 trees fresh) | pass | **1 refused** — todo `_derived/index.yaml` stale | no |
| `check-example-yaml` | 905 files accepted — exit 0 | 856 accepted — exit 0 | 857 accepted — exit 0 | no |

## What changed between `after` and `final` (not caused by the check scripts)

1. `check-example-derived` now refuses: records under
   `examples/todo-app-backend/.starciwork` moved after its `_derived/index.yaml`
   was generated. Refresh is `node scripts/example-derive.mjs --work <tree> --write`;
   that write is owned by the example lanes (w8/w10), not this lane. Flagged.
2. `check-work-replay` gained one refusal:
   `share/impl/todo-app-frontend/invite-screen/evidence.yaml` records the assertion
   command `../../scripts/check-scoped-lint.mjs` — the pre-tinkle-4 path; the script
   now lives at `scripts/checks/check-scoped-lint.mjs`. The evidence needs
   re-recording under the new path (example-evidence scope, not the check).
3. Benign drift: +1 artifact payload (44), +5 declared artifact paths / +5 run media
   (assets added by in-flight example lanes), +1 yaml file (857), history stats
   reshuffled as records churned (239→261 with history, 541→530 transitions).

## Compact-format behavior verified

- `parent#ac-id` refs resolve to the carrying record (gate tests:
  `tests/example-work-gate.spec.mjs` 29/29 pass, incl. five v11-compact cases).
- Inline `acceptance:` entries are walked by the gate's `AC_ID_MISMATCH` /
  `AC_ID_COLLISION` / `AC_LIFECYCLE_INLINE` rules; bare collapsed `ac.*` refs warn
  `AC_UNREMAPPED_REF` instead of dangling.
- `provenBy` absence is never flagged; authored `provenBy`/`derived` fields are
  still refused (`PROVENBY_AUTHORED`, check-example-derived). A grep of both
  example trees finds no authored `provenBy`.
- Record-count expectations are dynamic everywhere: 311 → 261 records with zero
  gate regressions (gate and deep are both clean at 0 refused).
