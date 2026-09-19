# v7-1 lane report — todo-app-backend record content (Phase 1)

Scope: `examples/todo-app-backend/.starciwork`, all record families except `ui/**`, `uat/**`,
`assets/**`, `evidence.yaml`, `_derived/`, `_resources/`, root `index.yaml`. No product source
(`src/**`) was touched. Vietnamese product copy untouched (none occurs in the records edited).

## What changed

### 1. Missing FRs for shipped capability — created

Code shipped `deleteTask` and `listTasks`/`taskCounts` doors with no `fr` records (v6-3 Q1).
Created, both `state: todo`:

- `fr.task.delete` (`features/task/fr/delete/`) — `DeleteTaskResolver` → `DeleteTaskHandler` →
  `TaskService.delete`: `findOwnedRow` applies `OwnershipGuard` unconditionally (owner-only,
  collaborators refused the same as strangers), a missing row throws `TaskNotFoundException`,
  and `TaskDeletedEvent` is published only after the row is gone.
  `composes`: `br.task.delete.final` + `br.task.single-owner`. `refs`: `event.task.deleted`.
  `blockedBy`: `br.task.single-owner` rev 3 — the same edge `fr.task.complete` carries, since a
  composed flow does not outrun a rule that is not yet done.
- `fr.task.list` (`features/task/fr/list/`) — `listTasks` + `taskCounts` queries →
  `ListTasksHandler`/`TaskCountsHandler` → `TaskService.listOwnedBy`: the owned read is the only
  source on both paths; dead sessions refused `SESSION_NOT_FOUND` before any row is touched.
  `composes`: `br.task.list.owned`. `refs`: `decision.task.list.scope`,
  `contract.task.list-for-dashboard`.

No `ac/` children were authored. `ac` records attach under `br/` rules (`rule:` must name a
`br.*`), and the checkable enforcements these flows rely on are already named and spec-backed:
`ac.task.delete.final.stays-gone`, `ac.task.single-owner.refuses-stranger`,
`ac.task.share.editor.no-delete.delete-refused-for-editor`, `ac.task.list.owned.excludes-others`
(all asserted by named tests in the module spec files). Inventing duplicates would restate them.

`event.task.deleted`'s `producer` was re-pointed `br.task.delete.final` → `fr.task.delete` (the
flow record now exists and is what publishes; the rule stays in `refs`), rev 3.

### 2. `composes[].module` / `module:` dangling paths — swept and fixed

Every `module:` field and `composes[].module` in scope was verified against the disk. Fixed:

- `fr.task.complete`: `src/modules/domain/task/**`, `src/features/complete-task/**`,
  `src/share/access.service.ts` → `src/modules/bussiness/task`, `src/modules/bussiness/share`.
- `fr.task.create`: `src/modules/domain/task/**`, `src/features/create-task/**` →
  `src/modules/bussiness/task`.
- `fr.task.reopen`: `src/features/reopen-task` → `src/modules/bussiness/task`.
- `fr.notify.on-new-device`: `src/notify/dedupe`, `src/notify/digest` →
  `src/modules/bussiness/notify`.

All remaining `module:`/`composes[].module` values resolve to real directories/files under
`src/modules/bussiness/*`, `src/modules/integrations/*`, `src/modules/platform/*` — verified by
existence check on every distinct value. Zero dangling paths remain in scope.

### 3. `requiresProof` commands — replaced with real targets

- `fr.audit.erasure.request`, `fr.audit.erasure.complete` →
  `npm run test:e2e -- src/tests/e2e/audit/erasure-journey.e2e-spec.ts` (the spec that walks
  request → verify → complete).
- `fr.audit.export`, `fr.audit.log.append`, `fr.audit.log.read` →
  `npm run test:e2e -- src/tests/e2e/audit/export-and-log.e2e-spec.ts`.
- `fr.task.complete`, `fr.task.create`, `fr.task.reopen`, `fr.task.list` (new) →
  `npm run test:e2e -- src/tests/e2e/task/task-lifecycle.e2e-spec.ts` (drives
  sign-in → create → list → complete → reopen → counts → sign-out).
- `fr.recur.make-recurring`, `edit-rule`, `end-rule`, `see-upcoming` →
  `npm run test:e2e -- src/tests/e2e/recur/recurrence-lifecycle.e2e-spec.ts`; their `blockedBy`
  `because` texts were corrected — they claimed `npm run test:e2e` does not exist, but
  `package.json` carries `"test:e2e": "jest --config src/tests/e2e/jest.config.ts"`.
- `fr.login.sign-in` → `npm run test:e2e -- src/tests/e2e/auth/sign-in.e2e-spec.ts`; the
  `perf.command` (`node scripts/load/sign-in-timing.mjs`) was removed — no `scripts/load/`
  exists, the optional demand stands without a fabricated command.
- `fr.login.sign-out` → `npm run test:e2e -- src/tests/e2e/session/sign-out.e2e-spec.ts`.
- `fr.task.delete` (new) uses `bash scripts/live-proof.sh`, not a jest spec: no spec under
  `src/tests/e2e/task/` performs an owner's delete — `task-isolation.e2e-spec.ts` exercises only
  the stranger-refusal arm (`deleteTask` → `TASK_FORBIDDEN`); the live-proof script runs the real
  `deleteTask → deleted:true → absent-from-list` sequence. The comment on the record says so.
- `fr.notify.digest` / `fr.notify.unsubscribe` already named the real
  `scripts/live-proof-notify.sh` — verified present, left untouched.

Every `command:` value in scope now resolves to a file that exists (verified on disk). All
`unit.forEach` / `requirements.forEach` / `stateMachine.transitions` forEach usages are
schema-shaped correctly — no spec globs needed fixing.

### 4. Event records — wired, state left for the evidence lane

`event.login.signed-in` / `event.login.signed-out` were already wired correctly
(`producer` resolves, `payload` matches `SignedInEvent`/`SignedOutEvent` exactly — personId,
signedInAt/signedOutAt, sourceEventId — and `fr.audit.log.append`'s `subscribes` names both;
`AuditEventSubscriber` handles them in code). What the records lacked was the verification trail:
both now carry a rev-3 `editorial` change entry documenting that `sign-in.handler.spec.ts`
("event.login.signed-in: publishes on the PlatformEventBus after a successful sign-in" + "a
refused sign-in publishes nothing") and `sign-out.handler.spec.ts` ("event.login.signed-out:
publishes on the PlatformEventBus after the session is revoked") assert emission. State stays
`todo`: promotion needs a sibling `evidence.yaml`, which the evidence lane owns (v7-1 may not
author one).

### 5. `provenBy` — all hand-authored blocks removed

Removed from six records (each retains a comment noting what was removed and that the kernel
derives the real one):

- `features/login/sds/session-store` — had `implementation:` + `transitions:` list.
- `features/login/journey/first-sign-in` — had `requirements:` + `uat:`.
- `features/login/contract/identity-for-task` — had `provider:`.
- `features/task/journey/first-task` — had `requirements:`.
- `features/login/fr/sign-in` — had `unit`/`e2e` (a captured run at `6f1e4b7d`)/`uat`/`perf`.
- `features/task/fr/create` — had a block claiming `uat.task.create` as uat proof at a time when
  that flow had no settled run (v6-3 finding 5).

Verified afterward: zero `provenBy:` YAML keys remain anywhere in the tree outside `_derived/`
(the kernel-generated `_derived/index.yaml` provenBy sections are derived output, not authored
record content, and belong to v7-8).

### Extra truthful-record fixes found during the sweep

- `fr.login.sign-out`: dropped the `composes` of `br.login.session.single-device` and the
  `blockedBy` edge that existed only because of it. That rule governs a *new* sign-in ending a
  prior session (`ac.login.session.single-device.second-sign-in-ends-the-first`); `SignOutHandler`
  revokes the row and publishes the event and touches no device logic — the compose made this
  flow wait on a rule its own steps never exercise (v6-3 Q2-10).
- `nfr.task.list.latency`: added a comment — `measurement.how` names
  `k6 run scripts/load/list.js`, but no `scripts/load/` exists. Plan's and share's nfrs record
  the same absence through `gap.plan.no-load-harness` / `gap.share.load-proof`; naming a gap for
  task is the gaps lane's, so the fact is documented in a comment and the record stays `todo`.
- Stale prose refreshed where my earlier edits had frozen it: `fr.task.complete`'s comment still
  said `uat.task.create` "is itself blocked by gap.task.live-proof" — that gap closed at rev 2
  (v7-11 ran `runs/20260919T112844Z-5c10a673`, pass). Same correction in `fr.task.create`'s
  provenBy-removal comment and precise uat wording in the two new fr records.

## What could not be proven, and why

- `fr.task.delete`, `fr.task.list` stay `todo`: this lane may not run or author evidence; no
  evidence.yaml may be created here, and `fr.task.delete` additionally composes
  `br.task.single-owner`, which is itself `todo` (held by stale evidence on the accepted-editor
  arm — the delete half this flow needs is already proven).
- `event.login.signed-in` / `signed-out` stay `todo` despite code-verified emission: promotion
  requires a sibling `evidence.yaml` — the evidence lane's to create.
- No proof was run, captured, or claimed by this lane; no `stale: true` was set anywhere.

## Remaining gate refusals observed (verbatim)

Command: `node scripts/check-example-work.mjs` →
`311 record(s), 2505 ref(s), 115 evidence file(s): 154 refused, 4 warned`.

**Expected — caused by this lane's record edits; the sibling `evidence.yaml` files need
re-capture by the evidence lane (`stale: true` was NOT set):**

    REFUSED examples/todo-app-backend/.starciwork/features/audit/fr/erasure/complete/evidence.yaml: recordDigest a0a77ae67d2bb1c16366e08d33128aaca30a0982e1aea83b1348de51a84d3eca no longer matches fr.audit.erasure.complete's current digest a43f20f6084ddd77ededc80f2ae89acad61236398995b61dff56c6f961a9dc90; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/audit/fr/erasure/request/evidence.yaml: recordDigest 86cf9050feac74382e735dfa7ba5161924b3c9a9fa30078b49e4c437ae09863b no longer matches fr.audit.erasure.request's current digest 1377779ef98865cfb152613ed0c5f1e8575180d9f179d5f0847513e681164bfc; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/audit/fr/export/evidence.yaml: recordDigest eb58436b6c6f3ba08a6d8d50e134a0c62d01df5b5d62814d37dd96b3b1715c21 no longer matches fr.audit.export's current digest 04056401773a98f28c7ecf2e9d8e2b8c5057656f78c1dd61eeb7eb079683d5e8; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/audit/fr/log/append/evidence.yaml: recordDigest 1ed6662288f937eab7875a30622e7c9ee64a6579bd21a03d20ffee1c86e8d285 no longer matches fr.audit.log.append's current digest 6cb3b1bdf7c96a130cfe218d51e001312af0396a3d679b4c3fdbcaa9ddef6c92; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/audit/fr/log/read/evidence.yaml: recordDigest 7692e4ca2d08703a3e3249fad6888a25ebc1aa385e44ea29457604b4e152904b no longer matches fr.audit.log.read's current digest fd772483b8ce58bea47919f3192deb4b78d04cf9c0f4e0ce40735fba58a06b9e; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/login/fr/sign-in/evidence.yaml: recordDigest 816e6e9a72d5f6dd93e689bc371320c98f61cc477becc5c0db737234a0139ee8 no longer matches fr.login.sign-in's current digest 644c0139cbfb65e219ba8bed7a86b9ce3db0c923a3bb3b28dc0cdf6a93132b53; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/login/sds/session-store/evidence.yaml: recordDigest f36314797203fcb30e7a12912c8dd6d1c1db820ed26f0c7dad890027a3ca7a31 no longer matches sds.login.session-store's current digest e642df2d20d179a85c792ddf25a2ed19485543b0f7f3df883a26879dd0f5b921; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/task/event/deleted/evidence.yaml: recordDigest 8545aad6f0e16b59ae4f0b591555280cd9eb135378dabf6a8055018bfbfa03ef no longer matches event.task.deleted's current digest 8308f57cbbbc69b1e567f7137d84cc737b18ce9d15e8b1bb3c088a96e354011c; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/task/fr/complete/evidence.yaml: recordDigest ecfbfcfd1dc5e985b93463c6c774852ea9e5d8b2a53dfbfac84221afc75649c5 no longer matches fr.task.complete's current digest 8f9a30401c8c6bf15ede72a8bb3f47942387d0478d7d89b5e4c8741896cde8f5; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/task/fr/create/evidence.yaml: recordDigest 45818e4d4d72c387739eaa8e551509671ea00ad26be3a58e5cb15b8865cd08b6 no longer matches fr.task.create's current digest f92f8be1884c4464617f4817d5090ef6394b02643a898ac65f9a8f1ba6834077; refused unless it carries stale: true
    REFUSED examples/todo-app-backend/.starciwork/features/task/fr/reopen/evidence.yaml: recordDigest 4fc37ed8510080f5d37ba858d1ce4174718d6e532894ff4713fac77fdb32e679 no longer matches fr.task.reopen's current digest c7fbb447977e09d38ce3027d268c6a39f1f9c2772a4899e763115e8eba3ad30b; refused unless it carries stale: true

**Warnings (one added by this lane — `fr.task.delete` carries the same `blockedBy` edge
`fr.task.complete` already had; the unrooted chain is pre-existing):**

    WARN examples/todo-app-backend/.starciwork/features/notify/journey/told-about-completion/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]
    WARN examples/todo-app-backend/.starciwork/features/share/contract/completion-guard-for-task/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]
    WARN examples/todo-app-backend/.starciwork/features/task/fr/complete/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]
    WARN examples/todo-app-backend/.starciwork/features/task/fr/delete/index.yaml: blockedBy chain reaches br.task.single-owner, which is neither a work/gap nor an open work/policy-decision - the chain's real root is unnamed [BLOCKER_UNROOTED]

**Outside this lane (representative; not quoted in full):** pervasive `[CODE_DIGEST_STALE]`
refusals on evidence across every feature (product code moved since capture — evidence lane's
regeneration), `recordDigest` refusals on fe-impl/ui/uat records edited by other lanes,
`[RENDER_CHECK_FAILED]` palette-off-brand refusals on frontend captures (render lane), and the
ecommerce tree's refusals (v7-2's scope).

No `id is …, but its place says …`, dangling-ref (`points at …, which no record owns`),
`[PROVES_TARGET_NOT_DONE]`, or shape refusals exist on any record this lane touched or created.

## Unresolved record↔code contradictions

- `features/task/fr/complete/evidence.yaml` and `features/task/fr/reopen/evidence.yaml` still
  record `npm run test:e2e -- tasks/complete` / `tasks/reopen` as the commands their assertions
  ran — the dead logical-name commands this lane removed from the records. `evidence.yaml` is
  out of scope; the evidence lane's re-capture will replace them.
- `fr.task.create` is `done` while composing `br.task.single-owner` (todo), while
  `fr.task.complete` stays `todo` on the same compose ("a composed flow does not outrun a rule
  that is not yet done"). One of the two conventions has to give; resolving it needs the evidence
  lane's verdict on `br.task.single-owner`'s stale evidence, so it is reported, not picked here.
- `fr.notify.digest` / `fr.notify.unsubscribe` rev-2 `change.reason` strings still claim
  "this repository's package.json has no test:e2e script" — false today
  (`"test:e2e": "jest --config src/tests/e2e/jest.config.ts"` exists). The commands they set are
  real (`scripts/live-proof-notify.sh`), so only the historical reason text is stale; rewriting
  another lane's change history was left alone.
- `nfr.task.list.latency`'s `measurement.how` names `scripts/load/list.js`, which does not exist;
  no `gap` record names the missing harness for task (gaps lane).
- `blockedBy` chains in four records root at `br.task.single-owner`, a todo rule rather than a
  gap/decision — the `[BLOCKER_UNROOTED]` warnings above. Naming the real root (the stale
  evidence holding that rule's flag) is the edges/gaps lane's call.
