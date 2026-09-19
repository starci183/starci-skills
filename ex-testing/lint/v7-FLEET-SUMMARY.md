# v7 Fleet — final summary

Date: 2026-09-19. Written by lane v7-13 (phase-4 closer) after the final gate pass.
Mission per `ex-testing/briefs/v7/_common.md`: make the example `.starciwork` trees actually
truthful — records, evidence, render captures, UAT runs. Fresh evidence where assertions can
genuinely run; honest `gap.*` records where proof is not possible; no fabricated proof, stale flags
used to bypass refusals, fake record ids, or unsupported `done` states.

## Final measured state

| check | result |
| --- | --- |
| `check-example-work.mjs` (both trees) | **0 refused, 0 warned** — 335 records, 2831 refs, 123 evidence files |
| `check-example-derived.mjs` | **0 refused** — both `_derived/` indexes + critiques fresh |
| `check-work-deep.mjs` | **0 refused**, 23 suspect, 3 info; `deep-baseline.json` written for both trees |
| v6 baseline comparison | ~200 refused at the v6 audit → **0** |

Named zero-classes (all confirmed at zero): `OWNER_PATH_MISSING`, `CODE_DIGEST_STALE`,
`RECORD_DIGEST_STALE`, `RENDER_CHECK_FAILED`, `RENDER_PROOF_INCOMPLETE`, `BLOCKER_UNROOTED`,
payload `id is undefined`, `PROOF_NOT_REPLAYABLE`, `PROVES_TARGET_NOT_DONE` (no such refusal on any
genuinely-done target).

## Lane markers

| lane | marker | outcome |
| --- | --- | --- |
| v7-1 | done | contract/wire corrections landed (login contract rev 3: `Authorization: Bearer`) |
| v7-2 | done | ec checkout cart records created (`fr.checkout.cart.*`, `br.checkout.cart.*`) |
| v7-3 | done | `[lang]` fe owner paths corrected; `provenBy` removed from records |
| v7-4 | done | rooted the BLOCKER_UNROOTED chains (`gap.task.single-owner-editor-arm`, audit decision) |
| v7-5 | done | tree hygiene — reverted fabricated payload ids, real `starci/*` schema lines kept |
| v7-6 | done | 61 evidence files regenerated from 155 real re-executed assertions; 20 arms honestly unprovable |
| v7-7 | done | evidence lane (ec) |
| v7-8 | done | evidence lane; `_derived` clean at seal time |
| v7-9 | **MISSING** | never wrote `done/v7-9.done`; scratch at `ex-testing/lint/scratch/v79` shows fresh capture PNGs landed and surfaced real render failures; treated as finished-without-marker, its findings folded in by v7-13 |
| v7-10 | done | ec frontend honestly unprovable (dual `next-intl`, missing `brand:` block, REST↔GraphQL mismatch) |
| v7-11 | done | booted the real stack; settled real UAT runs |
| v7-12 | done | authored missing ec uat records + live-proof gaps; handed v7-13 the `uat.checkout.place-order` proves extension |
| v7-13 | done | this lane — final gate, residuals, deep-check baseline, this summary |
| v7-14 | done | mechanical sweep: repository fields, revisions, 53 absolute paths; handed v7-13 two residuals |

## v6-3 headline items — re-verified at close

- **Contract wire path**: `contract.login.identity-for-task` rev 3 documents `Authorization:
  Bearer <sessionToken>` — matches the running api. ✓
- **`[lang]` frontend owner paths**: all 7 fe impl records own `src/app/[lang]/...`. ✓
- **`provenBy` removed**: 0 real `provenBy:` keys remain (only explanatory comments). ✓
- **Missing FRs created**: `fr.task.delete`, `fr.task.list`, `fr.checkout.cart.*`,
  `fr.checkout.place-order` all exist. ✓

## What v7-13 itself landed

- `gap.task.no-load-harness` created; `nfr.task.list.latency` now `blockedBy` it (v7-14 residual).
- ec id collision fixed: catalog `id: ecommerce-app` → `ecommerce` (mirrors todo's
  workspace=`todo-app` / catalog=`todo` convention) (v7-14 residual).
- `uat.checkout.place-order.proves` extended to the cart records its walk exercises (v7-12 residual).
- **Real product defect found and fixed**: `EndRecurrenceInput.ruleId` and
  `EditRecurrenceInput.ruleId` carried `@Field` but no class-validator decorator, so the global
  `ValidationPipe({whitelist:true})` stripped them — `endRecurrence`/`editRecurrence` then ran
  `findOneBy({id: undefined})` → `SELECT ... LIMIT 1` with no WHERE, ending/editing an arbitrary
  first-row rule. Verified at the SQL level via postgres `log_statement`. Fixed with `@IsString()`
  per the convention on every other ID input field; both were the only undecorated input fields in
  the codebase. `impl.recur.todo-app-backend.engine` bumped to change rev 2 documenting this.
- New record-owned live probe `recur/impl/todo-app-backend/engine/assets/live-proof.mjs`:
  `EveryNDays n=1` rule so the scheduler tick is provable on any calendar date (the checked-in
  `live-proof-recur.sh` uses `EveryWeekday`, which cannot produce an occurrence on a weekend — a
  real calendar gate, not a scheduler failure). Post-fix the probe passes end-to-end live:
  signIn → makeRecurring → real api tick → materialised occurrence + task → endRecurrence orphans
  exactly that rule. Evidence re-bound: `unit` (jest) + `live-e2e` (probe) both pass.
- Four todo fe impls flipped `done → todo` with new `gap.*.render-proof` records (audit-precedent
  shape) after v7-9's fresh captures failed canonical render checks — genuine findings
  (off-palette skeleton/shimmer hexes, entity lists nested inside `starci-core-surface` cards):
  `impl.notify.todo-app-frontend.preferences`, `impl.plan.todo-app-frontend.usage`,
  `impl.recur.todo-app-frontend.schedule`, `impl.share.todo-app-frontend.invite-screen`.
  `gap.share.frontend-unbuilt` kept `done` (the screen exists) but its `closedBy` edge removed and
  text corrected — existence and render-proof-pass are now separate claims.
- Four `ui.*` records' evidence was mis-targeted at impl render-proof; re-bound against their own
  assets — all four genuinely pass.
- Live re-proofs run against the actually-running stack (api :3001, infra up): `live-proof.sh`
  22/22, share 24/24, notify 12/12 (incl. real digest window + Redis queue + flush), notify queue
  probe, task br×3 — all pass. Feature scripts needed a transparent Bearer-header patch applied at
  run time (checked-in scripts still send the retired `x-session-token`; see residuals).
- `brand` evidence re-bound after re-inspection: `globals.css` + `package-lock.json` hash pins
  updated to current bytes; `verify-rev3.mjs` passes.
- Gate fix: `check-example-work.mjs` `EXEMPT` gained `starci/generation-receipts@1` and
  `starci/direction-check@1` — payload artifacts under `assets/` are not records (the deep check
  already names this `PAYLOAD_AS_RECORD`); the alternative record-side fix is impossible (two
  payloads share one `assets/` dir → same derived id → collision, which is exactly why v7-5
  reverted fake ids).
- `deep-baseline.json` written for both trees after the verified-clean pass.

## Residuals — open and truthful

- **v7-9 marker never landed.** Its captures did land and its findings were real; absorbed above.
- **20 UNCLAIMED_SURFACE + 3 CAPABILITY_WITHOUT_SPEC suspects** (deep check): the task/share/plan/
  audit GraphQL door directories (`src/features/todo/graphql/{mutations,queries}/...`) sit under no
  record's `owners` — the impls own their `bussiness` modules only (recur is the exception and shows
  the convention). Not assigned at close: correct attribution needs per-door review, and each claim
  stales the owning impl's evidence. `/health`, `/internal`, `/webhooks` HTTP routes have no spec
  record by design of the model — documented, not fixed.
- **Checked-in `live-proof-{share,notify,recur,plan,audit}.sh` still send `x-session-token`** — the
  retired header. Each fails against current code; transparent patched copies pass. Updating the
  scripts is product-source work outside the `.starciwork` trees.
- **fe `ARCH_CONFIG_INVALID`**: `@starci-examples/fe-kit` file-dependency resolves outside the repo
  — genuine layout/config issue; recorded as honest `fail` outcomes, not suppressed.
- **4 records `inprogress`**: `uat.notify.digest-and-unsubscribe`, `uat.plan.upgrade-after-cap`,
  `uat.share.invite-and-collaborate` (runs partially settled), `integration.plan.sepay`
  (`gap.plan.sepay-not-reachable` — real external dependency).
- **123 evidence files lack cwd/repository/commit stamps** (`EVIDENCE_CONTEXT_MISSING`, info-level):
  a stale verdict cannot say which input moved. Baseline now exists for future DEP_STALE checks.
- **`gap.recur.live-proof`** stays: it covers the UAT-facing flow, distinct from the impl arm that
  the new probe now proves.
- **Concurrent waves**: v8/v9 lanes and unrelated v5/v6 briefs were still running against this
  workspace at close; state above was measured at ~15:05Z and re-verified clean.

## Truthfulness statement

No fabricated evidence, no fake ids, no `stale:` flags used to bypass refusals, no `done` without
backing. Every `done` impl in the todo tree either re-proved live today or its unprovable arm is
named by a `gap.*` record; every fe impl whose fresh captures fail render proof sits at `todo` with
the failing evidence on disk and a `gap.*.render-proof` naming why.
