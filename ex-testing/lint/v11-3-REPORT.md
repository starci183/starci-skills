# Lane v11-3 — REPORT: strip authored derived-fields (both trees)

Date: 2026-09-19. Scope: `examples/todo-app-backend/.starciwork` + `examples/ecommerce-app-be/.starciwork`,
all `index.yaml` files. Brief: `ex-testing/briefs/v11/v11-3.md` + `v11/_common.md` (WAIT GATE).

## Wait gate — honored, all markers landed inside the window

Polled `ex-testing/lint/done/` every ~3 min. At lane start the following were absent:
`v10-1..v10-5` (all five) and `v9-4, v9-7, v9-9, v9-10`. Arrival order observed during the
window: `v9-4` (already present at first poll), `v10-4`, `v10-2`, `v10-1`, `v9-9`, `v10-3`,
`v9-7`, `v10-5` (~22:5x, produced `v10-FINAL-STATUS.md`), `v9-10` (~22:56, report declares a
real passing run, not blocked). Gate satisfied in full — nothing proceeded "anyway".

## Verdict: the invariant was already established — verified, not re-stripped

The same shape as v10-4's outcome: the target condition was reached by earlier fleet work in
this same uncommitted working tree, and this lane's job became to prove it holds and to leave
no new damage.

### Field sweep (both trees, every `*.yaml` outside `_derived/`)

| field | todo-app-backend | ecommerce-app-be |
| --- | --- | --- |
| authored `provenBy:` key | 0 | 0 |
| `derived:` block | 0 | 0 |
| `usedBy:` / `effectiveState:` / `frontier:` (derived-only vocabulary) | 0 | 0 |
| `state:` values outside `todo\|inprogress\|done\|uninvestigate` | 0 | 0 |

Full top-level key inventory of all 261 `index.yaml` files was taken; every key is authored
content (`schema/id/title/state/change/refs/requiresProof/proves/...`), no derived-shaped field
survives. `revision:` on impl records is an authored commit pin — kept. `verificationSource:
authored-claim` (29 records) is gate-required for done-without-evidence — kept by design.

### Delta vs HEAD (what the fleet already stripped)

At `HEAD`, 7 `index.yaml` files under `examples/todo-app-backend/.starciwork` carried
`provenBy:` keys — 6 records (`contract.login.identity-for-task`, `fr.login.sign-in`,
`journey.login.first-sign-in`, `sds.login.session-store`, `fr.task.create`,
`journey.task.first-task`) plus the generated `_derived/index.yaml`. The working tree now
carries **zero**; the 6 records keep the two-line pointer comment ("provenBy is written by
starci-kernel from requiresProof and the provers' own proves edges / An agent-authored
provenBy is refused"), which is exactly the `# derived — do not author` marker the brief
prescribes. ecommerce-app-be carried none at HEAD and carries none now.

### Stripped this lane vs comment-marked

- todo-app-backend: **0 stripped, 0 comment-marked** (pre-satisfied; 6 pointer comments retained).
- ecommerce-app-be: **0 stripped, 0 comment-marked** (never had the fields).
- Zero records edited by this lane → zero evidence `recordDigest` re-pins owed.

### Gate required-field check (per the brief)

`check-example-work.mjs` never reads `provenBy`/`derived` as required fields. Post-v11-5 it
refuses `provenBy` only when an *inline criterion* carries it (`AC_LIFECYCLE_INLINE`);
`check-work-deep.mjs` refuses any authored `provenBy` (`PROVENBY_AUTHORED`);
`check-example-derived.mjs` refuses authored `usedBy`/`effectiveState`/`frontier`. Nothing
needs a `# derived — do not author` comment that does not already have the equivalent pointer.

## Checks (post-gate snapshot)

| check | refused | notes |
| --- | --- | --- |
| `check-example-work.mjs` | **0** — "every id matches its place, every ref resolves" (261 recs, 2754 refs, 127 evidence, 43 payloads skipped) | equals v10-5 baseline (0) |
| `check-work-deep.mjs` | **10** (all ecommerce-app-be) | baseline was 0; see attribution |

The 10 deep refusals are sibling-lane artifacts, none in this lane's scope: 9 `DEP_STALE`
(done records whose deps `br.checkout.place-order` / `br.identity.sign-in` / `br.identity.account`
moved after v10-5 seeded `deep-baseline.json` at 22:47 — v9-10's record repairs + the ec-tree
collapse) and 1 `NORM_UNRECORDED` (`ui.checkout.stock-refused` normative edit without rev bump).
Re-seeding the baseline after fleet convergence is v11-5's declared job; doing it mid-flight
would bake a half-moved tree in as truth, so it was left alone. The todo-app-backend tree is
at 0 deep refusals. Mid-window transient peaks (gate 14, deep 79) came from the same in-flight
collapse and settled on their own as the owning lanes refreshed `_derived/` and evidence.

## Out-of-scope observations (honest, non-blocking)

- `.dist/examples/todo-app/.starciwork` (gitignored build output) still shows `provenBy:` keys
  in 10 files — a stale copy of the pre-strip source. It regenerates from `examples/` on the
  next successful build; no check walks it.
- `node scripts/ensure-build.mjs` currently fails on
  `Runtime reference cannot be a symlink: examples/ecommerce-app-be/node_modules/@ecommerce-app-be/identity`
  — a pre-existing environment constraint, unrelated to this lane.
