# Lane v9-1 — REPORT: `uat.audit.right-to-be-forgotten` → APP_CAPABILITY_MISSING

Date: 2026-09-19. Scope: implement + run `examples/todo-app-frontend/uat/flows/uat.audit.right-to-be-forgotten.spec.ts`
against the already-running fleet stack (todo BE :3001, FE :3000, keycloak :8089, postgres :5432).
Read first per brief: `v9/_common.md`, `v7-11-REPORT.md`, `v7-12-REPORT.md`, `uat/lib/*.ts`.

## Verdict: APP_CAPABILITY_MISSING — the operator audit-log surface does not exist in this deployment

The brief's own decision tree applied: verify the surfaces first, and if any is missing do not fake the
walk — name the absence on the owning gap and leave the record `todo`. Step 4 ("As the seeded operator,
read the log for the same window and see the lines, unnamed") fails that check twice over:

1. **No operator-facing audit-log UI exists.** The frontend serves exactly one audit route,
   `/[lang]/audit/privacy` (erasure request + export only — `src/components/audit/privacy/`). No
   `ui.audit.*` operator screen was ever designed (the audit feature tree has only `ui/privacy`), and the
   `auditLog` resolver's own comment says its action/target filter args "remain the transport's to expose
   when the operator-facing UI lands" — the product declares the surface unbuilt.
2. **The running deployment names no operator subject.** `decision.audit.operator-role` (decided:
   audit-verified-roster) makes the whole-chain read reachable only for subjects listed in
   `AUDIT_OPERATOR_SUBJECTS`, read once at API process start. Verified live: signed in as
   `demo@todo.dev` (personId `26494826-69b8-4c1e-a854-d047e0f88264`), `auditLog` returned exactly the
   106 lines under demo's own keyId — while a second subject's keyId holds 10 lines in the same chain.
   106 ≠ 116 → the own-lines fallback, not the operator branch. The roster env is not set on the running
   ts-node-dev API, and the stack is other-lane-owned ("do NOT re-boot").

Consequence: even with a written spec, step 4 cannot be observed truthfully here. Post-erasure the
seeded person's own-lines `auditLog`/`exportMyData` return `[]` — the opposite of "the lines exist".
The only whole-chain view available would be raw Postgres, which is not "as the operator through the
app". Faking either half (a DB read dressed as an operator read, or simulating a roster) is exactly
what the brief forbids.

## What IS present (verified, not walked)

- `ui.audit.privacy` at `/audit/privacy` (route deviation already recorded on impl.audit.todo-app-frontend.privacy):
  six-state vocabulary `idle | exporting | requesting-erasure | erasure-pending | erasure-complete |
  erasure-refused`; the request→confirm pair drives `requestErasure` then `completeErasure`
  (`src/components/audit/privacy/index.tsx`); `exportMyData` feeds a real `todo-app-export.json` download.
- Backend serves all four doors the record's `proves` names: `requestErasure` (request+verify chained,
  state `verified`), `completeErasure` (crypto-shreds the subject's key; `ErasureNotConfirmed` if any line
  stays readable), `exportMyData` (own lines, `[]` post-erasure), `auditLog` (own-lines default, whole-chain
  under a verified roster claim). Each is `state: done` with its own evidence — only the uat leg is open.

## Why no partial walk was run anyway

Two reasons. (a) The brief's missing-surface branch is explicit: report, update the gap, leave `todo`.
The `inprogress` settlement in `_common.md`'s amendment is scoped to external-provider legs (sepay/oauth/
email) — a first-party surface that was never built is not that case. (b) `completeErasure` is an
irreversible crypto-shred of the shared demo subject's audit key (permanent tombstoning of its 106
existing lines; the e2e spec itself notes the key is gone "for the rest of this stack's lifetime").
Spending that shared-state mutation on a run that cannot settle `done` — while other v9 lanes drive the
same account concurrently — is the wrong trade, and the run would still record step 4 as not-run.

## Records changed

- `audit/gap/live-proof/index.yaml` — rev 3 (`clarifying`), still `state: todo`, `closedBy` unchanged.
  The statement now names the two stacked absences precisely (no operator-facing audit-log screen; empty
  `AUDIT_OPERATOR_SUBJECTS` on the running API, verified live via the 106-of-116 line split) instead of
  the rev-2 "missing spec implementation" framing, which was no longer the whole blocker.
- `uat/flows/uat.audit.right-to-be-forgotten.spec.ts` — doc comment now records the v9-1 surface check
  (steps 1–3 servable, step 4 unwalkable and why); the spec stays a `test.skip` stub.
- `uat/right-to-be-forgotten/index.yaml` — untouched: still `state: todo` on `blockedBy:
  gap.audit.live-proof`, which is now the true blocker.

## Gate

`node scripts/check-example-work.mjs`: `315 record(s), 2664 ref(s), 120 evidence file(s): 41 refused`.
Zero refusals/warnings touch `audit/**`, `gap.audit.live-proof`, or `uat.audit.right-to-be-forgotten` —
all 41 are other lanes' families (ec generation-receipt ids, notify/plan/recur/share RENDER_CHECK_FAILED
captures, notify evidence digests staled by concurrent edits).

## To unblock (named for the next lane, not silently assumed)

Step 4 needs one of: (a) an operator-facing log surface designed and built (a `ui.audit.*` screen +
route — real app work, outside this lane), then a walk through it; or (b) a deployment decision that the
UAT environment configures `AUDIT_OPERATOR_SUBJECTS` with the seeded operator's subject id
(`26494826-69b8-4c1e-a854-d047e0f88264` for demo@todo.dev under this stack's imported realm), after
which a correctly-headed `auditLog` read is a legitimate operator leg in this harness's style — at which
point the spec's remaining steps can be written and the record settled.

## Cleanup

The only write this lane made to the shared stack was the probe `signIn` for demo@todo.dev; that session
was destroyed via `signOut` (`signedOut: true`) and no other rows were touched. No run folders were
written (the spec skipped; run-writer ignores `skipped`).
