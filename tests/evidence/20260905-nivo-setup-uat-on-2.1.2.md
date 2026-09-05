# Proving the Nivo AgentOS Setup journey on StarCi Skills 2.1.3

Session `20260905-130417-nivo-environment.preflight`, run by one processor (bound profile per
operator, ran profile `fable`, recorded on every receipt as `boundProfile`/`ranProfile`) on the
runtime at `e17d79e3` (2.1.3; the dispatch named 2.1.2, the runtime on disk is 2.1.3). Fourth run of
the Setup mission after the reachability repair (`20260905-nivo-reachability-fix.md`); that session
left the deep link reaching Setup and named three open items, one of which — the phone-reach of the
Setup composer at 390x844 (UX-9) — this mission repaired, proved and published.

The confirmed goal is the dispatch prompt as stated (`goal:…:v1`, `selectedBy: user`, `sourceRef` the
prompt). Of the eight done-when lines, five are evidenced and published, one is blocked on the owner,
and two backend-side lines were excluded at plan time with their reasons; the excludes the prompt
named (schema/migration, dark mode, production deploy, a new seed outside each flow's namespace,
`api.verify`, `business.reconcile`, publishing `nivo/be`) held. Two runtime defects stood in the way
and were fixed in place; both are below.

## Mission table

| # | Done-when line | Verdict | Where | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 0 | `library.update` consume `@starci/grammar` 0.4.11 | **BLOCKED → owner** | consumer plan at `step-3/parallel-2` | `DEPENDENCY_PROOF_FAILED`: the consume law needs a consumer regression that FAILS at the installed 0.4.9 and passes at 0.4.11, and nivo-fe has no such existing spec, so the before-proof cannot be shown; the worktree was left untouched | `step-3/parallel-2/` |
| 1 | `runtime.serve` `nivo/be` on 3068 at main `ca60f419` | **DONE** | `nivo/be` served on 3068 under the lease; main `ca60f419` merged into `uat` as `0546d0fb` (61 files), typecheck/lint/handler-spec 18/18 green | entry attested; the control-centre probe answers the seeded workspace with instance null | `step-5/parallel-1/` |
| 2 | `runtime.serve` `nivo/fe` on 3067 at the session head | **DONE** | `nivo/fe` served on 3067; session head `e2f4968f` merged into `uat` as `15f0a4c7` (4 files), gates green | entry generation 19; the served head contains the delivery | `step-6/parallel-1/` |
| 3 | `interface.plan` surface map + units | **DONE** | 14 units: 3 journey (sign-in-return-to, module-setup, workspace-control-centre), 11 secondary with reasons | the 11 secondary surfaces are on the audit-lane unchecked ledger `@worktrees/unchecked/nivo/agentos-module-setup.jsonl` | `step-3/parallel-1/` |
| 4 | `interface.generate` (refine, apply) on the Setup page: the primary action in reach at 390x844 | **DONE** | `e2f4968f`, four files | the Setup chat host gains a column flex chain capped at `max-h-80`, the composer places the field and the send action in one `GAP-3` row with the field in a `MEASURE-2` wrapper, and the Setup page drops the redundant description; 122 specs, tsc 0, eslint 0, sweep clean | `step-4/parallel-1/` |
| 5 | `uat.plan` + units: three flows named | **DONE** | flows `setup-reach`, `module-setup`, `control-centre-unprovisioned`, each with entry, step budget, a distinct account alias and a disjoint seed namespace | `module-setup` keeps its committed folder; the two new flows are drafted from the template by the walk that freezes them | `step-9/parallel-1/` |
| 6 | `quality.verify` green at the session head | **DONE** (gate verdict `pass`; scorecard `blocked`) | `e2f4968f` in the session worktree | six required gates pass in forced runs (format, lint + architecture, typecheck, build of three apps, unit-coverage 742/165, presentation sweep clean over the four delivered paths); patch coverage 99.31/99.31/92.38/94.82 against base `7cff0ea6`, above the 90 floor; the scorecard carries the audit's rows, so it reads `blocked`, not `ship` | `step-8/parallel-1/` |
| 7 | `git.publish` `nivo/fe` into main through the hooks | **DONE** | fast-forward `7cff0ea6 → e2f4968f`, pushed non-force to `origin` (`starci-lab/nivo-fe`) | the `pre-push` hook (`lint:check` + `test:unit`, 742 tests) ran and passed inside the push; no `--no-verify`; session worktree removed and the merged session branch deleted | `step-11/parallel-1/` |

Between the plan and the publish the three journey units were audited (`step-7/parallel-1..3`, mode
`playwright`, at 1441x1000 and 390x844) and the core flow was walked (`step-10/parallel-1`,
`uat.verify`), as the long-flow law requires.

## What the runtime proved on the served mains

- **The audits (`step-7`).** Three journey units on `nivo/fe` served at `15f0a4c7` (which contains
  `e2f4968f`): sign-in return-to (primary-surfaces, 232 claims), module-setup (exhaustive, 593
  claims) and workspace-control-centre (exhaustive, 639 claims). **Every application-owned claim
  passes on all three.** The only failing claims are Grammar-owned family gaps the 0.4.11 consume
  would repair — `OVERFLOW-3` on the family shell everywhere, plus `OVERFLOW-2` and `PADDING-4` on a
  frameless SurfaceCard on the control centre — routed to the family owner, not this delivery. Taste:
  sign-in and control-centre inherited from the reachability session's audits; module-setup scored
  own (mean 3.33, blocked on four states the served surface never renders because its data is present
  at first paint). Each sheet was served on the loopback host and its URL recorded under `## Printed`.

- **UX-9, measured fixed.** On the served module-setup surface at 390x844 the setup conversation's
  send action `Gửi` sits at y=764 of the 844px frame (bottom 804), inside the fold and reachable
  without a scroll. The reachability session measured the same control at y=972.63, below the fold.
  The secondary `Rà soát điều kiện` action at y=1057 is still below the fold — a note for the flow
  owner, not a gate, since UX-9 measures the primary action.

- **The walk (`step-10`, `uat.verify` flow `module-setup`).** Run `20260905-155900-e2f4968` at
  `e2f4968f` on served `15f0a4c7` (backend `ca60f419` inside the `26e18b5e` served on 3068). Two
  cases pressed from the Setup deep link and signed in as `owner` with the credential resolved by
  name: `setup-loads-owned-fixture` (1441x1000) and `setup-compact-390` (390x844), both reaching the
  one seeded generic-agent installation by its display name. **Behaviour passes**; **ui fails**,
  carried from the audit (the Grammar family gaps); **experience is fix-first at mean 3.9091** — UX-9
  now passes, and the lens sits below four only because two criteria (a wrong input and sub-second
  feedback) are unobservable in a bounded run and hold the neutral midpoint. The run seeded nothing
  (the twelve rows are the flow's retained precondition), so cleanup had nothing to remove. Appended
  to the flow folder as `runs/20260905-155900-e2f4968/`, `latest.json` and a `history.md` line.

## Two runtime defects, fixed in place

1. **`interface.audit` declared no `feature` field, so a done audit that deferred coverage had no
   ledger to address.** On 2.1.3 the audit's Requirements table carried `auditScope`, `matrix`,
   `readinessProbe`, `account`, `env`, `resume` — but not `feature`, which `scripts/record-unchecked.mjs`
   and `scripts/validate-session.mjs#uncheckedLedgerErrors` read to key the unchecked ledger
   `@worktrees/unchecked/<product>/<feature>.jsonl`. The exhaustive module-setup audit deferred four
   states (empty, pending, refused, unconfirmed) and had nowhere to write them; `record-unchecked`
   threw "names no ledger". Fixed by declaring `feature` in `operators/interface-audit/operator.md`
   and its Vietnamese mirror (step 3's Params gained it), with the self-test fixture and the derived
   docs regenerated; `npm run test` for the runtime passes. The three audit requests were re-issued
   with `requirements.feature = agentos-module-setup`, re-validated, and their deferred states landed
   on the ledger (now 15 lines).

2. **The `verdicts` schema required at least one calibration anchor, contradicting the inherited-lens
   law.** `templates/kinds/verdicts.schema.json` set `calibration.minItems: 1`, but
   `operators/interface-audit/validate.mjs` refuses any anchor score on a receipt whose direction
   declares a presentation delta of `none` (TASTE-13 Case 9 / the inherited-lens law): "an inherited
   lens took no anchors of its own". A sign-in or control-centre audit that inherits its taste from an
   earlier round therefore could satisfy neither rule at once. Fixed by relaxing `minItems` to 0 with
   a description saying an inherited-lens receipt carries an empty calibration; the two inherited
   audits carry `calibration: []` and the module-setup audit carries its three anchors.

Both fixes are in the runtime repo's own commit alongside this note.

## Blocked, deferred and excluded, with reasons

- **`library.update` consume 0.4.11 (line 0) — blocked on the owner.** The consume law's before-proof
  needs a consumer regression that fails at the installed version; nivo-fe has none. Routed to the
  person; the worktree was not touched. `@starci/grammar` 0.4.11 is published (owner main `0564837`)
  and repairs the three family gaps the audits name.
- **The wrong-password / refused sign-in case (flow `setup-reach`) — uncapturable by the runner.** The
  sign-in form still holds the sealed credential in its accessibility tree when the refusal renders,
  so `scripts/browser-walk.mjs` refuses to write the frame (`OUTPUT_SECRET_DETECTED`), even when the
  wrong value is carried on the non-secret email field; clearing the field by key presses does not
  clear the record. The reachability session hit the same wall. The `reload-keeps-session` case has no
  walkable action either — the runner navigates once, at step 1, and has no reload action. So of the
  three planned journey flows, `module-setup` was walked in full; `setup-reach` reduces to its one
  capturable case (deep-link-signed-out) and `control-centre-unprovisioned` remains walkable but was
  not walked in this session. These are coverage this run did not take, not defects in the delivery.
- **`api.verify` (excluded at plan time).** `scripts/plan-chain.mjs` refuses a chain carrying both
  `uat.plan` and `api.verify`: `uat.plan`'s Next table does not hand to `api.verify`, and
  `api.verify`'s optional `units` input orders it after `uat.plan`, so no lawful chain places it. A
  tree defect, recorded here.
- **`business.reconcile` (excluded).** No business head exists for `agentos-module-setup` under
  `@worktrees/businesses`, so `HEAD_NOT_RECONCILABLE` would block it with certainty.
- **`git.publish nivo/be` (excluded).** Main `ca60f419` is already the backend publish head and this
  mission wrote nothing to the backend, so there is nothing to merge; the backend is served, not
  published, here.

## Where the evidence lives

Session `20260905-130417-nivo-environment.preflight` under `.worktrees/sessions/`: the step ledgers,
the served-sheet host receipts, the audit verdicts, the walk records and captures, and the publish
receipt. Flow folder `.worktrees/uat/agentos-modules/module-setup/runs/20260905-155900-e2f4968/`. The
unchecked ledger `.worktrees/unchecked/nivo/agentos-module-setup.jsonl`. The findings ledgers
`knowledge/findings/core.jsonl` and `starci.jsonl`. Published head: `nivo-fe` `main` at
`e2f4968fcee02afd81ccf99aa3f691af4c9bc625` on `github.com/starci-lab/nivo-fe`.
