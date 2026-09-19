# Lane v9-5 — REPORT: uat.share.invite-and-collaborate

Date: 2026-09-19. Scope: `examples/todo-app-frontend/uat/flows/uat.share.invite-and-collaborate.spec.ts`
(the `test.skip` stub this lane was told to implement) + the share feature's owning records under
`examples/todo-app-backend/.starciwork/features/share/`. Read first: `v9/_common.md`, v7-11-REPORT.md
(stack boot + run-writer contract), v7-12-REPORT.md, the two implemented specs and `uat/lib/*.ts`.

## Verdict: APP_CAPABILITY_MISSING (partial-pass run produced)

The brief's verify-first question was "invite UI + accept flow exist?" — invite UI yes, accept flow
**no**. The product serves exactly half the designed walk:

- **Exists (walked live)**: owner sign-in, task create, `/tasks/<id>/share` via the row's Share link,
  invite form (email + viewer/editor radio + Send invitation), pending collaborator list, Revoke
  behind `window.confirm`, two-step delete.
- **Missing (recorded `not-run`, never faked)**:
  1. *No invitation delivery* — `InviteHandler` publishes no event, no email is sent, there is no
     notifications inbox. The invited person is never told.
  2. *No invitation discovery* — `collaborators(taskId)` returns `[]` to anyone not already bound
     (`InvitationService.listFor` requires owner or bound `personId`), so the invitee cannot learn
     the `invitationId` `acceptInvitation` requires.
  3. *No accept UI* — no `acceptInvitation` call exists anywhere in `src/`; no route serves it.
  4. *No collaborator task surface* — the `tasks` query is ownership-only (`list-tasks.resolver.ts`:
     "sharing never widens this list"), so even a bound collaborator never sees the shared task and
     has nothing to complete or re-read.

Driving `acceptInvitation`/`completeTask` as raw GraphQL inside the Playwright test would have
counterfeited a UX the product does not have — the backend already proves those calls at API level
(`scripts/live-proof-share.sh`). Per `_common.md`'s hard rule, the invitee legs are `not-run` with the
absence named on each assertion, and the run settles `partial-pass` by construction.

Secondary constraint, per the brief's instruction to check `realm-todo.json`: the realm seeds exactly
two accounts (`demo@todo.dev`, `demo2@todo.dev`). The record's "third person" viewer invitation was
sent to a run-namespaced address (`uat-<runId>-viewer@todo.dev`) — a real pending/revocable
invitation row that no account can sign in to. Creating a disposable third Keycloak user is allowed
by `environment.todo-app.dev`'s allowedEffects but was deliberately not done: it unblocks nothing
while the accept surface is absent, and it would add a cleanup burden for zero proof.

## Stack — shared, not rebooted

The already-running stack was used as-is (per `_common.md`): FE :3000 (307 → locale), BE :3001
`/health` ok, Keycloak :8089 realm `todo` 200, postgres `compose-postgres-1` :5432 db `todo`,
redis :6379, minio :9000.

Run env: `_common.md`'s, plus `UAT_PASSWORD_EDITOR=todo-demo-pass-2` (the editor role resolves to the
second seeded user — see harness fix below) and `UAT_PG_CONTAINER=compose-postgres-1` (the run-owned
row cleanup the record's own `cleanup` field names).

## Spec implemented — `uat.share.invite-and-collaborate.spec.ts`

Six walked steps: owner sign-in → task create → share page → invite editor (demo2, real account) +
viewer (run-namespaced address), both Pending → editor sign-in documents the absent surface (run task
absent from their list; share route renders empty state for an unbound invitee) → owner revokes both
pending invitations through the UI → task deleted + invitation rows deleted by recorded id via psql
(`TaskService.delete` does not cascade; `invitations` has no FK) and verified absent.

Assertions: `fr.share.invite` yes, `fr.share.revoke` yes (t-revoke-pending only — scoped note),
`fr.share.accept` / `br.share.role.permissions` / `br.share.revoke.on-read` not-run, each naming the
missing capability. Outcome: **partial-pass**.

## Harness fix (uat/ only, documented per convention)

`uat/lib/flow-records.ts` `ROLE_EMAIL`: `editor` resolved to `demo@todo.dev` — the owner's own
account, which would have signed the "invited person" in as the owner. Now resolves to
`demo2@todo.dev`; comment records that editor and viewer share the second seeded login because the
realm seeds only two accounts.

## Runs produced (append-only, both kept)

1. `20260919T142631Z-5c10a673` — passed the walk but leaked the viewer invitation row: the
   collaborator read-back compared the mixed-case run-id email against `normalizeEmail`'s lowercased
   store, so its id never resolved and psql skipped it. Row deleted by hand
   (`DELETE … WHERE email LIKE 'uat-%'` → 0 remain). Its `cleanup.json` honestly reports the
   unresolved row — kept untouched per the never-edit-a-run rule.
2. `20260919T142709Z-5c10a673` — the settling run: pass-equivalent for the reachable legs
   (`partial-pass`), all three created resources deleted + verified-absent, cleanup.json's note is the
   all-resolved sentence. Verified afterward in Postgres: zero `uat-%` invitations, zero `uat-%`
   tasks. Video verified real: VP8 800x450 25fps 3.84s, 225,538 B.

## Records changed

- `share/uat/invite-and-collaborate/index.yaml` — `state: inprogress` (owner-directive vocabulary:
  partially provable; `done` is reserved for `Outcome: pass`, which this flow cannot produce while
  the invitee surface is missing). `blockedBy` on `gap.share.live-proof` kept with an updated
  `because`; `change` rev 1 added. `proves` left as the designed five — it is what the flow proves
  when the product can be walked, and the gate only binds `proves` on `done` records.
- `share/uat/invite-and-collaborate/evidence.yaml` — NEW, hand-written like sign-in's, but honestly
  marked `outcome: partial-pass` and carrying a comment that it does not settle the record.
- `share/gap/live-proof/index.yaml` — stays `todo` (gaps are todo|done only); title + statement now
  name the precise absence (items 1–4 above + the two-account constraint); `change` rev 3.

## Gate

`node scripts/check-example-work.mjs`: **324 records, 11 refused** — all in other lanes' families
(ec `ui/*/assets` id-less files, notify impl evidence digest staleness, and
`share/impl/todo-app-frontend/invite-screen`'s recordDigest, stale since a prior lane edited that
index). Zero refusals/warnings touch `uat.share.invite-and-collaborate`, `gap.share.live-proof`, or
any record this lane edited. `node scripts/check-example-yaml.mjs`: 876 yaml files, all accepted —
`state: inprogress` on a uat-flow passes the authored vocabulary.

## What remains for a future lane

The gap is product capability, not test coverage: to settle this flow `done` the app needs (a)
invitation delivery + discovery for the invitee, (b) an accept surface, (c) a collaborator-visible
task surface — all Business/SRS-level scope questions, and (d) a third seeded or disposable account
for the record's literal "third person". Until then `uat.share.invite-and-collaborate` stays
`inprogress` and `gap.share.live-proof` stays `todo`, both naming exactly that.
