# Lane v11-2 — REPORT: collapse `ac/` sub-records on `examples/ecommerce-app-be`

Date: 2026-09-19. Scope: `examples/ecommerce-app-be/.starciwork` only.
Read first: `v11/_common.md` (wait gate, collapse law, ref-remap safety rule), the v11-2 brief,
`scripts/example-ownership.mjs`, `check-example-work.mjs`, `check-work-deep.mjs`,
`check-work-consistency.mjs`, `check-work-history.mjs`, `checks/work-change.mjs`.

## Wait gate

All required markers present before the first tree write: v10-1..v10-5 and v9-1..v9-10
(v10-5 and v9-10 landed last, ~22:42; the gate script `ex-testing/lint/scratch/v11-2-wait.sh`
polled `done/`). No edits were made while markers were missing.

## What was done

Every `ac/` sub-record in the tree was inlined into its owning business-rule record as an
`acceptance:` entry, each entry keeping the criterion's own `ac.*` id plus its `given`/`when`/`then`
verbatim. The parent's `acceptanceCriteria` name list is removed (the inline ids are the names).
Each parent got `change.rev` bumped to 2 with `kind: breaking` — `checks/work-change.mjs` reads a
field removal as breaking even though the wording is identical, and the first pass declaring
`editorial` was correctly flagged `CHANGE_KIND_SUSPECT` by check-work-history; the kind was
relabeled to the honest verdict.

### Counts

| measure | before | after |
| --- | --- | --- |
| `ac/` record files in tree | 11 | 0 |
| `ac/` directories | 11 | 0 |
| parent BR records changed | 0 | 4 |
| other records changed | 0 | 1 (`ui.checkout.stock-refused`) |
| criteria kept separate | — | 0 |

Collapsed criteria (all 11 — `ac.checkout.cart.*` x3 into `br.checkout.cart`;
`ac.checkout.place-order.*` x3 into `br.checkout.place-order`; `ac.identity.account.*` x3 into
`br.identity.account`; `ac.identity.sign-in.*` x2 into `br.identity.sign-in`).

**Kept-separate cases: none.** All 11 are proof units with no lifecycle of their own — the
acceptance-criterion schema carries no `state`, none had its own `evidence.yaml`, and none was
independently scheduled. An inline entry carrying `state`/`change`/`evidence`/`provenBy` would be
refused `AC_LIFECYCLE_INLINE` anyway, and none qualified.

## Reference remapping

Per the safety rule, every ref to a collapsed ac was remapped to canonical `parent#ac-id`
(`resolveRecordRef` accepts full ac id, `name`, or last segment as the fragment; the full id is used):

- `ui.checkout.stock-refused` `refs:`: `ac.checkout.place-order.stock-is-checked-at-confirmation`
  -> `br.checkout.place-order#ac.checkout.place-order.stock-is-checked-at-confirmation`; its
  `provenance.business` entry now points at the parent file with sha256 `c8981a4a…6cb`.
- Evidence assertion ids regenerated in canonical form (below).

`grep -rn "ac\."` after: zero dangling record refs. Remaining `ac.*` strings are non-ref content,
verified by class:

- inline `acceptance[].id` declarations — the declaration trail is exempt by design;
- `command:`/`observation:` strings inside evidence.yaml — `jest -t ac.*` matches **test names in
  the product source**, which are unchanged (evidence.yaml is not ref-collected);
- `ui.checkout.stock-refused` prompt.txt assets — sha256-pinned historical prompt bytes, editing
  them would falsify the stamped provenance;
- uat run manifests + result.md under `runs/` — foreign-schema payloads (`PAYLOAD_SKIPPED`) and
  markdown, historical receipts of what those runs checked, never ref-collected.

## Evidence re-pinning

Re-ran the real assertion commands via `scripts/example-evidence.mjs` after the final record bytes
settled (canonical `parent#ac-id` assertion ids):

- `br.identity.sign-in`: 2/2 PASS (jest `-t` on both criteria)
- `br.checkout.place-order`: 3/3 PASS — including the live docker-compose e2e `order-lifecycle`
- `ui.checkout.stock-refused`: outcome `fail`, same as before the lane — custody PASS,
  captures/render FAIL; the record is `todo` and the failing checks are its honest state
- `br.checkout.cart`, `br.identity.account`: no evidence.yaml (state `todo`, none required)

## Validation (final, post-all-edits; raw runs in `ex-testing/lint/v11-2-runs/`)

| check | result |
| --- | --- |
| `check-example-work.mjs` (both trees) | **0 refused, 0 warned** — 261 records, 3138 refs, 127 evidence files, 43 payloads skipped |
| `check-work-deep.mjs --tree ec-be` | **0 refused, 0 suspect, 2 info** — equals the v10-5 baseline (0 refused) |
| `check-work-consistency.mjs --tree ec-be` | 1 refused, 2 suspect, 1 info — all pre-existing (below) |
| `check-work-artifacts.mjs --tree ec-be` | 4 refused, 34 suspect, 3 info — all 4 pre-existing (below) |
| `check-work-surfaces.mjs --tree ec-be` | 0 refused, 3 suspect (pre-existing fe-route drift) |
| `check-work-replay.mjs --tree ec-be` | 0 refused, 28 suspect, 28 info; all 3 re-pinned evidence files REPLAYABLE |
| `check-work-history.mjs --tree ec-be` | 0 refused, 0 suspect, 2 info |
| `check-example-derived.mjs` (both trees) | clean — indexes fresh, no authored derived vocabulary |
| `check-example-yaml.mjs` | 856 yaml accepted |

**Refusal-count gate vs v10-5 baseline:** gate 0 refused (unchanged); deep 0 refused (unchanged).

Mid-lane the deep check fired 9 `DEP_STALE` (done dependents of the four moved BRs) plus
1 `NORM_UNRECORDED` on `ui.checkout.stock-refused` (first-pass edit missed the rev bump). The rev
bumps cleared NORM_UNRECORDED; after a verified-clean gate pass the deep baseline was re-seeded
with `--write-baseline` — the documented procedure, same as v10-3 used. The BRs' own evidence was
genuinely re-run (all pass), so the dependents' proofs still rest on the same semantic premises.

**Pre-existing findings (not this lane, verified against `v11-5-runs/*.before.txt` and HEAD):**
`ui.checkout.landing-home` carries `state: uninvestigate` while `work-ui-screen.schema.yaml`'s enum
is `[todo, done]` (refused identically in v11-5's before run; the record is unmodified at HEAD);
4 `ASSET_DIGEST` refusals on historical `uat.checkout.place-order` video manifests; the
`EVIDENCE_ARTIFACT_GHOST`/`INPUT_BYTES_MOVED`/`CATALOG_TITLE_DRIFT`/`UI_ROUTE_*` suspects; the 2
standing INFO advisories (`EVIDENCE_CONTEXT_MISSING` x17, `PAYLOAD_AS_RECORD` x6).

## Concurrent-fleet notes

- v11-5 (compact-format checks) landed mid-lane; the migration was conformed to its live
  resolution layer — full `ac.*` ids on inline entries and canonical `parent#ac-id` refs.
- `ui.checkout.stock-refused`'s `state` was flipped to `todo` by v9-7's evidence while this lane
  ran; preserved untouched, and the rev-1 reason text was carried into the rev-2 entry.
- `.starciwork/DIRECTIONS.md` and other files outside this lane's scope were deleted/modified by
  sibling lanes during execution; none of my edits touched them.
- Derived outputs (`_derived/index.yaml`, `frontier.md`, `critique.yaml`, `critique.md`) were
  regenerated twice (post-collapse, post-kind-relabel) and `deep-baseline.json` was re-seeded once.
