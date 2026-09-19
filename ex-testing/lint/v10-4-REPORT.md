# Lane v10-4 — REPORT: notify manifest dangling assertion + run hygiene

Date: 2026-09-19. Scope: `examples/todo-app-backend/.starciwork/features/notify/uat/digest-and-unsubscribe/runs/*/manifest.yaml`
plus the sibling run-folder hygiene around them. Brief: `ex-testing/briefs/v10/v10-4.md`.

## Precondition: v9-2 finished — no wait needed

The brief's first check: `ex-testing/lint/done/v9-2.done` exists, so lane v9-2 is not still
iterating and no poll/wait was required.

## Verdict: the refusal is already honestly resolved — verified, not re-fixed

The three (in fact four — the settling run `20260919T144517Z-5c10a673` carried it too) run
manifests that asserted `id: uat.notify.digest-and-unsubscribe.inbox-arrival` no longer do.
v9-2 hit this exact refusal mid-flight and performed a disclosed repair
(`ex-testing/lint/v9-2-REPORT.md`, "Disclosed repair — assertion id namespace"): the spec's
generator had emitted an ad-hoc check id inside a *record-ref family* (`uat.*`), which
`check-example-work.mjs` collects as a ref and refuses when no record owns it. v9-2 renamed it
to `ux.notify.inbox-arrival` — the harness's sanctioned namespace for unowned UX observations —
in the spec (`todo-app-frontend/uat/flows/uat.notify.digest-and-unsubscribe.spec.ts:342`) and
in place across each run's `manifest.yaml`, `ux-checks.json`, `readback.json` and `result.md`,
with every `expected`/`observed`/`note` byte-identical and no outcome altered.

This lane verified the repair rather than redoing it:

- `grep` for `digest-and-unsubscribe.inbox-arrival` over `examples/` and `ex-testing/`
  (node_modules/.next/dist excluded): the only remaining hits are this brief and v9-2's own
  report. Zero occurrences in the work tree or the spec.
- The uat record's `index.yaml` (the brief's named source of truth) declares steps with
  `checks: [{id: completion}]` and `proves: [fr.notify.digest, fr.notify.unsubscribe,
  br.notify.digest.window, br.notify.unsubscribe.honored]`. `inbox-arrival` is a step-3/6
  *observation* ("read the owner's inbox"), not a record-owned proof — so the brief's option (a)
  (author a record to own it) would have fabricated ownership, and option (b) (remap to ids the
  record declares) has no target: the record declares no per-assertion ids. The `ux.*` namespace
  is the honest home and matches 20+ sibling usages (`ux.sign-in.validation-feedback` ×7,
  `ux.sign-in.error-feedback` ×6, `ux.notify.preferences.reachable` ×5, `ux.plan.*` ×2).
- The leg stays truthful: `observed: not-run`, a note naming the two real absences (no in-app
  inbox, no reachable SMTP host), and `gap.notify.live-proof` + `integration.notify.smtp` +
  `gap.notify.smtp-host-unreachable` own the pending external-provider leg. The record is
  `inprogress`, not `done` — nothing pretends the leg was proven.

## Run hygiene audit — all 8 runs, programmatic

Checked every run under `runs/` with a script (manifest ↔ disk ↔ result.md):

- Every `assets[]` entry exists on disk with matching sha256 and size — all 8 runs clean.
- Every media file on disk is declared in its manifest's `assets` — nothing undeclared.
- `manifest.yaml` `outcome` equals `result.md` `Outcome:` in all 8 runs.
- Manifest assertion ids match `ux-checks.json` and `readback.json` per run.
- No stray, hidden, temp or backup files anywhere under the flow.

One caveat found and left in place deliberately: run `20260919T144259Z-5c10a673` has an empty
`videos/` dir. `uat/lib/run-writer.ts:69-70` creates `screens/` and `videos/` unconditionally at
run start, so an empty `videos/` is the harness's canonical shape for a run whose video write
failed (v9-2 documents the cause: a concurrent lane's Playwright startup wiped the shared
output dir mid-run; the run honestly settles `fail` and declares no video asset). Removing the
dir would diverge from the writer's own output shape, not improve honesty. No run folder was
deleted or modified.

## Gate

`node scripts/check-example-work.mjs` during this lane: **zero refusals under `notify/**`** —
the four manifests now emit `INFO PAYLOAD_SKIPPED` (v10-1's schema-first payload skip landed
mid-check) and every remaining ref in them resolves. The tree-wide refused count was transient
during my window (observed 9 → 5 → 4 across consecutive runs): all remaining REFUSED lines are
`recordDigest`/`CODE_DIGEST_STALE` mismatches on `plan/impl`, `share/impl`, `audit/fr` and
`task/*` evidence — in-flight churn from the concurrently-running owners-expansion lanes
(v10-2/v10-3), not this lane's scope. v10-5 owns the settled final tally. Captured output:
`ex-testing/lint/scratch/v10-4-gate.txt`.

## Adjacent observations (flagged, not touched — other lanes' scope)

- `features/recur/uat/make-recurring/runs/20260919T143618Z-5c10a673/`: `outcome: pass` with an
  empty `videos/` dir and a manifest that lists `screens/screenshot.png` twice with *different*
  sha256 values. The owning record `uat.recur.make-recurring` is still `todo` with no
  evidence.yaml, so nothing is proven off it — but the duplicate-asset manifest is a data quirk
  worth the recur lane / v10-5 sweep's attention. Left untouched (append-only run records).

## What this lane changed

Nothing in the work tree — the honest fix the brief describes was already v9-2's disclosed
repair, and verification confirmed it complete and consistent. This report + the done marker
are the lane's only writes.
