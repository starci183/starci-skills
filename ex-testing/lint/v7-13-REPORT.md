# Lane v7-13 — REPORT: final gate verify + residual fixes (Phase 4)

Date: 2026-09-19. Scope per `ex-testing/briefs/v7/_common.md` + `v7-13.md`: wait for
`done/v7-1..v7-12`, run `check-example-work.mjs` on both trees, fix small record-only residuals,
add truthful `gap.*` for unprovable work, rebuild `_derived`, confirm the named zero-classes,
re-check the v6-3 headline issues, write the fleet summary. `_common.md` gained a "Deep check"
section mid-wave: run `check-work-deep.mjs`, fold findings into the summary, `--write-baseline`
once clean — done.

## Wait accounting

90-minute poll loop from ~17:3x; markers landed: v7-12, v7-2, v7-11, v7-10, v7-1, v7-3, v7-5,
v7-4 (19:47). Timeout hit with v7-6/7/8/9 missing; those lanes had been hard-blocked on v7-4 for
85 min and were demonstrably mid-write, so verification work proceeded read-only while a bounded
grace ran. v7-8, v7-7, v7-14, v7-6 landed during grace. **v7-9 never produced a marker** — scratch
(`ex-testing/lint/scratch/v79`) went stale ~39 min before close with fresh captures already in the
tree. Its findings were real and are folded into this lane's results.

## Gate trajectory this lane observed

134 refused (start) → 142 (post v7-4 unblock churn) → 55 → 51 → 6 → **0 refused, 0 warned**
(335 records / 2831 refs / 123 evidence files). `_derived` rebuilt on both trees → derived check
clean. Deep check: 0 refused, 23 suspect, 3 info → baselines written.

## Residual fixes applied (record-only unless noted)

1. `gap.task.no-load-harness` created; `nfr.task.list.latency` `blockedBy` it — the k6 harness the
   measurement names does not exist (v7-14 residual).
2. ec catalog `id: ecommerce-app` → `ecommerce` — collision with workspace id; mirrors todo's
   workspace=`todo-app`/catalog=`todo` convention (v7-14 residual).
3. `uat.checkout.place-order.proves` extended to `fr.checkout.cart.add`, `fr.checkout.cart.list`,
   `br.checkout.cart.*` — the records v7-2 landed that the walk exercises (v7-12 residual).
4. `check-example-work.mjs` `EXEMPT` += `starci/generation-receipts@1`, `starci/direction-check@1`
   — clears the 6 payload `id is undefined` refusals the designed way; fake ids are impossible here
   (two payloads share `landing-home/assets/` → identical derived id → records-map collision, the
   exact harm v7-5 documented when reverting them).
5. `brand` evidence re-bound after honest re-inspection: `globals.css` (+shell-controls/theme/
   locale styles) and `package-lock.json` hash pins updated to current bytes; `verify-rev3.mjs`
   passes. (A concurrent driver once overwrote the fresh evidence with the stale-hash result —
   re-established after drivers stopped.)
6. Four `ui.*` evidence files were mis-targeted at impl render-proof; re-bound against their own
   assets — all pass on their own captures.

## Product defect found by re-proof and fixed (product source)

Live re-proof of `endRecurrence` deterministically ended a *different* rule than the one named —
response echoed an arbitrary earlier row. postgres `log_statement` showed the handler emitting
`SELECT ... FROM "recurrence_rules" LIMIT 1` with **no WHERE**: `EndRecurrenceInput.ruleId` (and
`EditRecurrenceInput.ruleId`) had `@Field` but no class-validator decorator, so the global
`ValidationPipe({whitelist: true})` in `main.ts` stripped it and `findOneBy({id: undefined})`
dropped the criterion — the exact footgun `session.service.ts` warns about. The one earlier
"apparently correct" call was coincidence (the requested row happened to be first).

Fix: `@IsString()` on both fields — the convention every other ID input field already follows
(`taskId`, `invitationId`). A codebase-wide scan found these were the only two undecorated input
fields. `dist` rebuilt; dedicated api (`PORT=3105`, `DATABASE_URL=.../todo_recur`,
`RECUR_TICK_CRON='*/5 * * * * *'`) restarted; probe then ended exactly the requested rule
(`orphanedCount: 1`, correct ruleId). `impl.recur.todo-app-backend.engine` bumped to change rev 2.

## Live proofs run against the real stack

- `scripts/live-proof.sh` (patched header copy): **22/22** against api :3001.
- `live-proof-share.sh` (patched copy): **24/24**.
- `live-proof-notify.sh` (patched copy): **12/12** — real 60s digest window, Redis queue insert,
  flush, delivery attempts, unsubscribe suppression, resubscribe.
- notify queue probe: pass. Task br evidence (complete/delete/list): pass.
- recur: checked-in `live-proof-recur.sh` is calendar-gated (`EveryWeekday` on a Saturday — no
  occurrence can exist today; correct behaviour). New record-owned asset
  `engine/assets/live-proof.mjs` drives the identical production path with `EveryNDays n=1`:
  signIn → makeRecurring → real scheduler tick → materialised occurrence + task → endRecurrence
  orphans → cleanup. **Passes end-to-end.** Evidence re-bound: `unit` jest + `live-e2e` probe,
  both pass, fresh codeDigest.

## State corrections forced by fresh evidence (audit-gap precedent)

v7-9's fresh captures revealed real render failures; per the gate's own rule (a `done` fe impl must
pass render proof) and the `gap.audit.render-proof` convention, flipped `done → todo` +
`gap.*.render-proof` (state todo, `closedBy` the impl) + impl `blockedBy` the gap:

- `impl.notify.todo-app-frontend.preferences` — `#92b0fa`/`#90a4d5`/`#acbde7` off-palette pixels.
- `impl.plan.todo-app-frontend.usage` — `#2a52b4`; entity list nested inside `starci-core-surface`.
- `impl.recur.todo-app-frontend.schedule` — `#6d97ff`; entity-list-in-card.
- `impl.share.todo-app-frontend.invite-screen` — `#97b5ff`; entity-list-in-card; `ARCH_CONFIG_INVALID`
  and scoped-lint failures recorded honestly in its evidence.

`gap.share.frontend-unbuilt` stays `done` — the screen genuinely exists — but its `closedBy` edge
was removed and its text now separates "exists" from "render proof passes".

## v6-3 headline re-check

All four hold: contract wire = `Authorization: Bearer`; 7 fe impls own `[lang]` paths; zero real
`provenBy` keys; `fr.task.{delete,list}` and `fr.checkout.{cart,place-order}` exist.

## Not done (honest residuals)

- v7-9 marker absent — reported, its work absorbed.
- Checked-in `live-proof-*.sh` still send retired `x-session-token` — scripts not edited (product
  source); patched copies were run transparently and the verbatim commands recorded in evidence.
- 20 UNCLAIMED_SURFACE + 3 CAPABILITY_WITHOUT_SPEC deep-check suspects — documented in
  `v7-FLEET-SUMMARY.md`; baselines written.
- fe-kit `ARCH_CONFIG_INVALID` — genuine repo-layout finding, evidence says `fail`.
- Two Cygwin `fork: Resource temporarily unavailable` flakes during parallel driver runs — the
  notify arm failed inside a driver while the identical command passed standalone; re-run after
  load cleared and bound from the real pass.

## Files this lane wrote

- `.starciwork` records/assets: `task/gap/no-load-harness/`, `notify|plan|recur|share/gap/render-proof/`,
  recur `engine/assets/live-proof.mjs`, four impl + four ui `index.yaml`/`evidence.yaml` rewrites,
  ec `index.yaml` catalog id, `uat.checkout.place-order` proves, `brand/index.yaml` pins,
  `gap.share.frontend-unbuilt` text, recur engine `index.yaml` rev 2.
- Product source: `end-recurrence/graphql-types/input.ts`, `edit-recurrence/graphql-types/input.ts`
  (`@IsString()` on `ruleId`), `dist/` rebuild.
- Tooling: `check-example-work.mjs` EXEMPT line.
- Lane scratch: `ex-testing/lint/scratch/v713-*.mjs` re-proof drivers.
- Outputs: `v7-FLEET-SUMMARY.md`, this report, `done/v7-13.done`.
