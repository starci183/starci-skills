# Lane v7-11 — REPORT: todo UAT runs

Date: 2026-09-19. Scope: `examples/todo-app-backend/.starciwork/features/**/uat/**` — runs/ artifacts +
uat evidence. Audits read first: `v6-3-REPORT.md` (findings 5, Q2-8, Q4 under-claim) and `v6-4-REPORT.md`
(Q3 item 6: "a done uat-flow needs a settled runs/<runId>/ with screens, videos, and result.md pass").

## Stack: brought up for real, then torn down

The dev compose stack could not be used — `postgres.yaml`/`keycloak.yaml` read sops/age-encrypted secrets
(`.starcistacks/dev/runtime/files/*.key.enc`) and this lane does not decrypt. Instead I booted a
run-owned project `todo-uat-v7` from `src/tests/infra/platform/stack/compose.e2e.yaml` (the same file
`E2EStackService` drives) pinned to the dev-convention ports:

- postgres:16 on 127.0.0.1:5432, db `todo`, schema+seed mounted from `.starcistacks/dev/seeds`
- keycloak 26.0 on 127.0.0.1:8089, realm `todo` imported from `realm-todo.json` (seeds
  `demo@todo.dev`/`todo-demo-pass`, `demo2@todo.dev`/`todo-demo-pass-2` — DEMO-ONLY committed plaintext)
- redis on 6379
- api: this worktree's `npm run build` output, `node -r tsconfig-paths/register dist/main.js` on :3001,
  env exactly as `E2EStackService.startApi` sets it (DATABASE_URL/REDIS_URL/KEYCLOAK_TOKEN_URL/
  KEYCLOAK_CLIENT_ID/SMTP_* pinned loopback). `/health` → `{"status":"ok"}`.
- frontend: `npm run build` (the committed `.next` was stale — src newer than BUILD_ID) then
  `npx next start -p 3000`.

Run invocation env: `UAT_LIVE_LOGIN_AUTHORIZED=true`, `UAT_DEMO_PASSWORD=todo-demo-pass`,
`UAT_PASSWORD_STRANGER=todo-demo-pass-2`, `UAT_BASE_URL=http://localhost:3000`,
`UAT_API_BASE_URL=http://localhost:3001`.

## Runs produced (both real, both kept — runs/ is append-only)

1. `20260919T112508Z-5c10a673` — full suite (`npm run uat`, all 7 specs):
   - `uat.login.sign-in` PASSED (2.3s) — a second settled run now sits under `login/uat/sign-in/runs/`;
     evidence.yaml still settles on the earlier `20260918T174721Z-023dd8d9`, unchanged.
   - `uat.task.create` FAILED at the cleanup step: the app's delete is a two-step inline confirm
     (`Delete "<title>"?` + Delete/Cancel, `task-list/component.tsx` `confirmingId`); the spec only
     clicked once, the walk aborted, and the run-owned task row leaked (I deleted it by hand via psql).
     Its `result.md` still records `Outcome: pass` because run-writer derives outcome from assertions,
     not test status — left untouched per the never-edit-a-run rule; its walk.json honestly shows only
     3 steps and its cleanup.json honestly (if incompletely) shows no recorded resources because the
     spec never emitted `recordResource` events.
   - the other 5 specs skipped themselves (unimplemented `test.skip` stubs) → no run folders written.
2. `20260919T112844Z-5c10a673` — `uat.task.create` alone, PASS (1.8s), all four steps walked,
   screens/ + videos/create.webm (159,113 B, VP8 800x450 25fps, 2.56s), `result.md` `Outcome: pass`,
   `cleanup.json` created/deleted/verified-absent triplet present. Verified the task row is gone in
   Postgres afterward (only `seed-1` remains).

## Harness fix I made (outside `.starciwork`, documented per scope tension)

`examples/todo-app-frontend/uat/flows/uat.task.create.spec.ts`: the cleanup step now clicks the confirm
Delete inside the same row (the app's real two-step delete), and the spec emits `recordResource`
created/deleted/verified-absent for the run-owned task so cleanup.json tells the truth. This is the
same category of mid-lane harness fix prior UAT lanes committed (`flow-records.ts`'s "Fixed in this
lane", `run-writer.ts`'s result.md formatting note). No product `src/**` was touched; the app was
correct, the spec wasn't. New-spec authorship for the 5 stub flows was NOT done — v7-12's parallel
brief calls that "app work".

## Records changed

- `task/uat/create/index.yaml` — `state: done`; dropped the `blockedBy` on `gap.task.live-proof`
  (closed); **narrowed `proves` to `[fr.task.create]`** — the run did observe `br.task.single-owner`'s
  stranger arm (assertion yes, in the run's artifacts) but the rule is still `todo` and the gate
  refuses `PROVES_TARGET_NOT_DONE`; a comment on the record preserves this. `change` rev 1 added.
- `task/uat/create/evidence.yaml` — NEW, hand-written like sign-in's: `run: runs/20260919T112844Z-5c10a673`,
  `outcome: pass`, video asset + sha256, `recordDigest` = sha256 of the final index.yaml
  (`13376ae1…`), provenance describing the stack/authorization honestly.
- `task/gap/live-proof/index.yaml` — closed: `state: done`, `verificationSource: authored-claim`,
  `because` naming the run, `change` rev 2 (same shape as `gap.login.live-proof`'s closure).
- `task/journey/first-task/index.yaml` — removed its `blockedBy` on `gap.task.live-proof`: the target
  is now done (stale-edge refusal otherwise) and its `because` text was already false (v6-3 Q2-8 —
  it claimed no sign-in run exists). Still `state: todo` with no evidence — correct; it needs its own
  proof, not a flip. (Note: a concurrent lane — presumably v7-1 — removed its hand-authored `provenBy`
  while I worked; current file state is consistent.)
- `audit|notify|plan|recur|share/gap/live-proof/index.yaml` (5) — statement appended: the blocker is
  now precisely the unimplemented `test.skip` spec (app work), not "never attempted"; `change` rev 2
  clarifying. All stay `todo` — no run folders exist for them.

## What I could NOT prove, and why

- `uat.{audit.right-to-be-forgotten, notify.digest-and-unsubscribe, plan.upgrade-after-cap,
  recur.make-recurring, share.invite-and-collaborate}` — all five specs are `test.skip(true, …)`
  stubs with no walk implemented. Running them writes nothing (run-writer ignores `skipped`). Their
  records stay `todo` on their `gap.*.live-proof` gaps, which now name the missing capability
  precisely. The app's UI surfaces for several of these DO exist in the build
  (`/[lang]/tasks/[taskId]/share`, `/[lang]/recur`, `/[lang]/notify/preferences`,
  `/[lang]/plan/usage`, `/[lang]/audit/privacy`) — the blocker is the missing spec, not necessarily
  the product.
- `br.task.single-owner` stays `todo` (not mine to close): its own rev-3 note says its evidence never
  exercises the accepted-editor arm; my run only exercised the stranger-delete arm.
- One spec comment is now stale: `uat.recur.make-recurring.spec.ts` says the record "declares no
  blockedBy" — the record gained one (`gap.recur.live-proof`) since. Spec comments weren't edited
  beyond the task.create fix.

## Gate

`node scripts/check-example-work.mjs`: **311 records, 153–154 refused, 3 warned** (count fluctuated
between runs — other lanes are editing concurrently; audit-time baseline was 191). No refusal touches
any uat record, `gap.*.live-proof`, or `journey.task.first-task`.

The one refusal my change produced and then resolved, verbatim:

```
REFUSED examples/todo-app-backend/.starciwork/features/task/uat/create/index.yaml: state is done but
proves br.task.single-owner, which is todo, not done [PROVES_TARGET_NOT_DONE]
```

Remaining refusals observed (all other lanes' families), representative verbatim lines:

```
REFUSED .../recur/impl/todo-app-frontend/schedule/index.yaml: capture .../running-page-active-desktop.png:
  palette-off-brand fails - 19 dominant colours of the capture match no brand token ... [RENDER_CHECK_FAILED]
REFUSED .../share/impl/todo-app-frontend/invite-screen/index.yaml: capture .../running-page-inviting-desktop-1280.png:
  palette-off-brand fails - 2 dominant colours ... [RENDER_CHECK_FAILED]
WARN .../notify/journey/told-about-completion/index.yaml: blockedBy chain reaches br.task.single-owner,
  which is neither a work/gap nor an open work/policy-decision [BLOCKER_UNROOTED]
```

## Record↔code contradictions left unresolved

- Run `20260919T112508Z-5c10a673` (task/create): `result.md` says `Outcome: pass` while `walk.json`
  shows 3 of 4 steps and the test process failed — the harness's assertion-derived verdict vs the
  incomplete walk. Kept as honest append-only history; the settling run is the later one.
- `identity.todo-app.demo` realm mismatch (v6-3 Q2-5: `todo-app` vs `todo`) — untouched, `_resources`
  is not my family. My stack imported the real `realm-todo.json` (`"realm": "todo"`), which is why the
  code default `realms/todo` worked.
- `uat.task.create`'s run manifest `inputDigest` pins the record as it was at run time (`todo`,
  2-entry proves); the record's final bytes differ — the manifest is a point-in-time snapshot, not a
  live ref; the gate does not compare them (evidence's own `recordDigest` covers the record).

## Cleanup

`docker compose -p todo-uat-v7 down -v` — verified zero containers/volumes left; api (:3001) and
next (:3000) processes killed; no stray rows in the disposable DB before teardown.
