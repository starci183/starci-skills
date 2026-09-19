# v11-1 — Collapse `ac/` sub-records in `examples/todo-app-backend/.starciwork`

Lane brief: `ex-testing/briefs/v11/v11-1.md`. Shared rules: `ex-testing/briefs/v11/_common.md`.

## Wait gate

Honored. Polled `ex-testing/lint/done/` until `v10-1..v10-5` and `v9-2..v9-10` were all present
(`v10-5` + `v9-10` were the last to land); no tree writes happened before the gate cleared.

## What changed

| | before | after |
|---|---|---|
| `ac` records (`features/**/ac/*/index.yaml`) | 39 | 0 |
| parent `br` records carrying them | 30 | 30 |
| work records in this tree | 260 | 221 |

All 39 `ac` records had the uniform `{id, rule, given, when, then}` shape with no own
`state`/`change`/`evidence` — none qualified for staying separate under the compact-format rule
(`AC_LIFECYCLE_INLINE`). **Kept separate: 0.**

Each criterion was inlined into its parent's **`acceptance:`** list as
`{id: <former full ac id>, given, when, then}` — the field `INLINE_CRITERION_FIELDS` defines in
`scripts/example-ownership.mjs`. The old `acceptanceCriteria: [slug,...]` pointer list was removed
(it is fully derivable from the inline entries — compression, not loss). `change.rev` was bumped on
every touched parent (kind: editorial, reason appended inside the existing scalar).

## Reference remapping — 35 refs in 27 files

Canonical form used everywhere: `parent-id#<former-ac-id>`.

- **28** evidence `assertions.id` entries (e.g. `id: ac.audit.append-only.chain-detects-tamper` →
  `id: br.audit.append-only#ac.audit.append-only.chain-detects-tamper`).
- **6** prose references inside `description:`/`statements:` text across 4 records
  (`data.audit.log-line`, `decision.audit.deleted-task-target` — also rev-bumped 1→2 after the deep
  check flagged NORM_UNRECORDED — `decision.plan.downgrade.policy`, `br.plan.downgrade.freeze`).
- **1** uat run-manifest declared assertion (`plan/uat/upgrade-after-cap/runs/20260919T143402Z`).

Kept verbatim on purpose (not refs — transcripts/test-names):

- `command:`/`observation:` strings in evidence: `npx jest -t "ac.x.y"` — the jest test titles in
  `src/modules/bussiness/**/*.spec.ts` still literally carry the `ac.*` names, so the recorded
  commands stay replayable as written.
- `change.reason` text citing spec-case names, and `#` comments.
- Embedded run artifacts inside the manifest (`readback.json`/`ux-checks.json` payload copies):
  byte-records of what the run checked under the old ids. Note: a concurrent lane re-materialized
  this manifest ~90s after the collapse; the declared assertion kept the compact form.
- `_derived/` was regenerated rather than patched (41 old ac edges canonicalized by the derive
  writer itself).

## Evidence re-pinning

30 sibling `evidence.yaml` `recordDigest` values re-pinned to the sha256 of the post-edit
`index.yaml` bytes — the same digest algorithm `example-evidence.mjs` writes. Assertion commands
and observations were left byte-identical because the behavior they prove did not move (encoding
change only) and the `ac.*` jest filters still match live spec names. No evidence content was
fabricated, and no `state` was touched.

## Derived + baseline

- `example-derive.mjs --write` + `example-critique.mjs --write` on this tree (post-collapse and
  again after the NORM_UNRECORDED rev-bump fix; `check-example-derived` is clean for this tree).
- `check-work-deep.mjs --tree <todo-be> --write-baseline` re-seeded `_derived/deep-baseline.json`
  after the verified-clean pass — required, because the 30 parent norm changes legitimately staled
  68 done dependents (DEP_STALE wave, all explained by the migration). Ecommerce's baseline was
  not touched.

## Verification

- `check-example-work.mjs`: this tree contributes **0 refused / 0 warned**. Final sweep:
  `261 record(s), 2754 ref(s), 127 evidence file(s), 43 artifact payload(s) skipped: every id
  matches its place, every ref resolves`.
- `check-work-deep.mjs --tree examples/todo-app-backend/.starciwork`: **0 refused**, 2 suspect
  (`/health`, `/webhooks` capability findings — pre-existing), 1 info (evidence context stamps —
  pre-existing). Refusal count for this tree: 0 → 0, vs the v10-5 sweep baseline of 0.
- Repo-wide deep check currently shows 10 refused — **all in `ecommerce-app-be`** (DEP_STALE /
  NORM_UNRECORDED left by concurrent v11-2/v9-10 edits still settling); none in this tree.
- `grep -rn "ac\."` audit: zero dangling refs. Remaining occurrences are inline `acceptance.id`
  declarations, verbatim command/observation/comment transcripts, and embedded run artifacts.
- AC kept separate: **0** (none carried own lifecycle/evidence).

## Out of scope, deliberately untouched

`ecommerce-app-be` tree (v11-2), `provenBy` removal (v11-3), evidence/run consolidation (v11-4),
checker internals (v11-5). Scratch tooling used: `ex-testing/lint/scratch/v11-1-collapse.mjs`,
`v11-1-inventory.mjs`.
