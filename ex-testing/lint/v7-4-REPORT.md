# Lane v7-4 — edges, blockers, decisions (Phase 1)

Date: 2026-09-19. Scope per `briefs/v7/_common.md` + `v7-4.md`: `blockedBy`, `conflictsWith`,
`refs`, `gap/`, `decision/` records in BOTH trees. Only `index.yaml` files were edited or created;
no `evidence.yaml` was touched, nothing was marked `stale: true`, no product source changed.
Concurrent-lane note: v7-1/v7-2/v7-3/v7-5 had already landed before this lane ran; their deltas are
quoted where they intersect mine.

## Baseline → end state (verbatim)

```text
311 record(s), 2504 ref(s), 115 evidence file(s): 154 refused, 3 warned     # v7-5's final run (my baseline)
313 record(s), 2510 ref(s), 120 evidence file(s): 128 refused               # after this lane (+2 records = my two new files; +5 evidence files appeared from a concurrent uat lane; refusal total fell for reasons in other lanes' scopes - zero warnings now)
```

The warning count went 3 → 0: **all `BLOCKER_UNROOTED` warnings are cleared** (see §1).

## 1. BLOCKER_UNROOTED — fixed by rooting, not repointing

Four chains dead-ended at `br.task.single-owner` (the brief said 3; `fr.task.delete`, authored by
v7-1 mid-flight, carried the same edge and warned too):

```
fr.task.complete                          -> br.task.single-owner (todo, no blockedBy, no gap)
fr.task.delete                            -> br.task.single-owner
contract.share.completion-guard-for-task  -> fr.task.complete -> br.task.single-owner  (+ direct edge)
journey.notify.told-about-completion      -> fr.task.complete -> br.task.single-owner
```

The real root was already written down, just in the wrong place: `br.task.single-owner`'s
`evidence.yaml` carries `stale: true` with a `staleReason` that measures exactly why the rule is
held — its one captured run is a `jest -t "ac.task.single-owner.refuses-stranger"` filter that
selects three stranger-negatives and skips all of `completion-authority.spec.ts`, i.e. **the
accepted-editor complete arm has no proof bound to this rule**. The capability itself is proven
(`impl.share.todo-app-backend.access` is done; `completion-authority.spec.ts` asserts the seam).

**Edges added / authored:**

- **NEW `gap.task.single-owner-editor-arm`** (`features/task/gap/single-owner-editor-arm/`) — names
  that absence verbatim from the evidence's own staleReason; `state: todo`,
  `verificationSource: authored-claim`. Closing it = evidence lane re-capture +
  `contract.share.completion-guard-for-task`'s provider/consumer proof settling.
- **`br.task.single-owner` gained `blockedBy: [gap.task.single-owner-editor-arm]`** (rev 3 → 4,
  editorial, all three statements retained verbatim). Rev 3 had deliberately left the wait unedged
  because the only targets then were the contract and the fr, both of which already point back here
  — an edge to either is the `BLOCKER_CYCLE` the gate refuses. An edge to a terminal gap cannot
  cycle, so all four chains now root at the gap transitively.

**Rerooted/re-pinned edge details (because-text and rev-pin rot cleared, v6-3 findings 11–12):**

- `fr.task.complete.blockedBy`: pin rev 2 → rev 4; because rewritten (old text repeated
  share-edge-hold's stale "proof is captured and passing" premise).
- `fr.task.delete.blockedBy`: pin rev 3 → rev 4; because names the gap.
- `contract.share.completion-guard-for-task.blockedBy`: both entries' "Neither side exists yet"
  was false (the provider guard exists and is done); the `rev: 2` pin on `fr.task.complete` was
  dropped because that record carries no `change.rev` — a pin against a rev-less target can never
  fire the stale rule, which is exactly the v6-3 finding-11 hole. The `br.task.single-owner` edge is
  re-pinned at rev 4.
- `journey.notify.told-about-completion.blockedBy`: because text updated (v6-3 #12 — it still
  described the pre-cleanup edge set `complete.once` + `collaborator-completion`); rev 2 clarifying.
- **`gap.task.share-edge-hold` rewritten** (rev 2 clarifying): its statement's premise — "the
  record's evidence.yaml carries a fresh passing capture" — was stale, and its tail claim
  "fr.task.complete's chain now terminates here" was never true (nothing ever pointed at it). The
  record now names the residual truth only: when `br.task.single-owner` flips done at rev ≥4, the
  contract's pinned edge refuses the contract until the share side retires it. `closedBy` unchanged.
- **`event.login.new-device-signin`**: because said "until decision.login.session.devices is
  settled" — it is decided (single-device); the remaining absence is the field itself. rev 2.
- **`impl.audit.todo-app-frontend.privacy`**: `blockedBy: gap.audit.render-proof` was a bare scalar
  string — `Array.isArray` fails, so the edge was invisible to every gate check (no resolve, no
  rooting). Normalized to `{record, because}` list form; it roots at the gap correctly.

Chains not touched because they already root correctly (verified by walking every `blockedBy` in
both trees): all recur frs/journey/uat → `gap.recur.live-proof`; plan frs/nfr/uat/journey/sds →
`gap.plan.*` or via `integration.plan.sepay` → `gap.plan.sepay-not-reachable`; share
journey/nfr/uat → `gap.share.*`; audit journey/uat → `gap.audit.live-proof`; notify
nfr/uat → `gap.notify.*` via `fr.notify.on-new-device`; both ec-be uat flows → `gap.*.live-proof`.
`br.login.session.single-device` → `gap.login.device-field`, `event.login.new-device-signin` → same,
`contract.notify.new-device-signal` → same, `fr.notify.on-new-device` → `gap.notify.new-device-event`.
Zero `BLOCKER_CYCLE` found anywhere.

## 2. `conflictsWith` tensions — decision authored

- **NEW `decision.audit.deleted-task-target`** (`features/audit/decision/deleted-task-target/`,
  `state: done`, `outcome: decided`, `chosen: history-not-resolution`) resolves
  `data.audit.log-line` vs `br.task.delete.final`. Grounded in code, not prose:
  `AuditLogService` never issues UPDATE/DELETE against `audit_log_lines` and `hashContent` covers
  `target` (so scrubbing breaks `ac.audit.append-only.chain-detects-tamper`); `readLine` returns
  `target` verbatim even on tombstoned lines; sealing `target` like `actor` would contradict
  `br.audit.erasure.right`'s second statement. `DeleteTaskHandler`/`TaskService.delete` removes the
  row outright, so "resolves to nothing" holds on every *task* read path. Decided reading: the
  criterion scopes to the task domain; the log's `target` is the record of the deletion, not a
  resolution of the task.
- `data.audit.log-line`: `conflictsWith` edge retired (the records no longer contradict under the
  decided reading), decision linked via `refs`; rev 3 clarifying.
- `ac.task.delete.final.stays-gone`: `when`/`then` narrowed to the decided reading
  ("any read for the task … resolves to no task"), comment names the decision.
- `br.task.delete.final`: comment updated — "recorded and accepted … not resolved here" was true
  when written; now points at the decision.
- `br.audit.erasure.right` → `br.audit.retention` edge **dropped** (a resolved tension still
  recorded as live conflict): `decision.audit.erasure-method` already settled it and retention
  rev 2's text ("readable-or-tombstoned … never dropped early") no longer makes the claim the
  edge's `because` quoted. Both linked via `refs`; rev 3 clarifying.
- **Plan-cap tension (`contract.plan.create-precondition` vs `fr.task.create`) — resolved without a
  decision record.** The brief said "author the decision if one is needed"; none was: code and
  contract already agreed (`create-precondition.contract.spec.ts` proves the real
  `CreateTaskHandler` calls `TaskCreationPolicy.assertMayCreate` and propagates
  `PlanCapExceededException`), only the fr lagged. `fr.task.create` now states it: new
  exceptionFlow for the cap refusal, `composes` += `{rule: br.plan.caps.limit, module:
  src/modules/bussiness/plan}` (dir verified on disk; cross-feature compose has precedent in
  `fr.task.complete` → `br.share.role.permissions`), `refs` += `contract.plan.create-precondition`,
  rev 1 clarifying. The contract's `conflictsWith` is dropped and its stale comment corrected
  (rev 3). **ec-be needed nothing**: v7-2's sweep already corrected its FR/contract pairs and the
  tree carries zero `conflictsWith` edges.

## 3. `conflictsWith` misuse — each converted or dropped

| record | edge | disposition |
|---|---|---|
| `contract.notify.new-device-signal` | → `br.login.session.single-device` rev 1 | **Dropped.** Described "device field not built" — an absence, not a contradiction. The absence is already named by its `blockedBy` → `gap.login.device-field`. (v6-3 Q2-9) |
| `fr.notify.on-new-device` | → `br.login.session.single-device` rev 1 | **Dropped.** Same misuse, plus factually stale — claimed `decision.login.session.devices` "is still open"; it is decided. Absence already named by `blockedBy` → `gap.notify.new-device-event` → `event.login.new-device-signin` → `gap.login.device-field`. |
| `data.recur.occurrence` | → `sds.task.completion-state` | **Dropped → moved to `refs`.** A difference, not a contradiction: the record's own text concedes a five-state occurrence lifecycle and a two-state task machine govern different entities (`extends` pulls fields, not the state machine). |
| `br.audit.erasure.right` | → `br.audit.retention` rev 2 | **Dropped** — resolved tension; see §2. |
| `data.audit.log-line` | → `br.task.delete.final` rev 1 | **Dropped** — resolved by the new decision; see §2. |
| `contract.plan.create-precondition` | → `fr.task.create` | **Dropped** — fr corrected to the enforced reality; see §2. |

No new `conflictsWith` edges were authored; none remain in either tree (the five `_derived/`
occurrences are generated output, v7-8's scope).

## 4. `fr.login.sign-out` compose — already fixed by v7-1, verified here

v7-1 dropped the `br.login.session.single-device` compose and repointed to
`br.login.session.restores`. Verified semantically right rather than merely resolvable: sign-out's
postcondition ("the session ends and the next request is unauthenticated") is exactly the negative
of restores's statement ("a signed-in person who returns … is still signed in") — a revoked session
is precisely a session that must not restore. `SignOutHandler` revokes the row and publishes the
event, touching no device logic. No further repoint needed; no missing rule to author.

## 5. `proves`/`refs` sanity on every edge this lane touched

- `gap.task.single-owner-editor-arm` — terminal by construction (no outbound edges).
- `decision.audit.deleted-task-target.tension.records` — `[data.audit.log-line, br.task.delete.final]`,
  both exist and are the actual parties; `chosen` ∈ `options[].id` (gate-checked).
- `fr.task.create` — `composes[].rule` all exist and are `work/business-rule`; the new
  `br.plan.caps.limit` compose's `module: src/modules/bussiness/plan` exists on disk (the cap guard
  lives in `cap-guard.policy.ts` there). `refs` → the contract whose obligation the flow now states.
- `data.audit.log-line.refs`, `br.audit.erasure.right.refs`, `data.recur.occurrence.refs` — every
  new entry resolves to the semantically intended record (the decision that settled the tension, or
  the related-model sds).
- `blockedBy` targets added/re-pinned — all `work/gap` or a todo record that itself roots at a gap.
- Gate output confirms: zero "points at … which no record owns", zero `closedBy names … which no
  record owns", zero `conflictsWith … rev` mismatches, zero `PROVES_TARGET_NOT_DONE`, zero
  `BLOCKER_CYCLE`/`BLOCKER_UNROOTED`.

## What could NOT be proven, and why

- `gap.task.single-owner-editor-arm` and `decision.audit.deleted-task-target` are authored-claim
  records; no proof was run, captured or claimed by this lane (lane rules forbid it). The gap's
  claim is inspection-verifiable against `br.task.single-owner/evidence.yaml`'s own `staleReason`.
- Every record I edited now stales its sibling `evidence.yaml` (`recordDigest` mismatch) — expected
  per the brief; the evidence lanes re-capture.

## Remaining gate refusals observed on records this lane touched (verbatim)

```text
REFUSED examples/todo-app-backend/.starciwork/features/audit/br/erasure/right/evidence.yaml: recordDigest 262b91f2444d4480e1c6f4b6d6c9a7c155461a7f29efa8bf10e4a43fce053ca2 no longer matches br.audit.erasure.right's current digest ce298864e5142e60696953af4a7abbac84e82f45380e61cda33a7e50b084faf6; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/audit/data/log-line/evidence.yaml: recordDigest f87d7f3f9cecd8eb7d74fec6dc123cf349772a641c0ef0e06f217ff0dc994a30 no longer matches data.audit.log-line's current digest baa6041a29604648e301aa7611c043e089f9da0c5bc5d4ad1ef4e3850b732d8a; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/audit/impl/todo-app-frontend/privacy/evidence.yaml: recordDigest d7f56bc1ecf0f17bf710db6b2366decf311bbc4ba44b14bacfca45a820e08056 no longer matches impl.audit.todo-app-frontend.privacy's current digest 17fc92e81a93a9844e7d3577a2b7df9c54d24fdfdb6fb2ec2d2a4b9ca47f57be; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/plan/contract/create-precondition/evidence.yaml: recordDigest 07644f53d5e4a2587cc86ee0ff5d86f499f6e6d08b2ff5340fc3e37864b0e686 no longer matches contract.plan.create-precondition's current digest 9903c15f87c08bc2105f666a94194b11ad708921065dd44274bd88fabca6738d; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/task/br/delete/final/evidence.yaml: recordDigest 6869de81a64bc76e06cf0dd4bd7b0d8b00e5436492053b3527e9f3f0b4048b00 no longer matches br.task.delete.final's current digest 0235e6605fd3ee525422bf5c3e340b682f4842d802b6502b2b2d4eed235c5234; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/task/fr/complete/evidence.yaml: recordDigest ecfbfcfd1dc5e985b93463c6c774852ea9e5d8b2a53dfbfac84221afc75649c5 no longer matches fr.task.complete's current digest c5d276248fc6ac2c996e891dcdcf6a7a08890bd6d748d2c60164f6212fe1c5f7; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/task/fr/create/evidence.yaml: recordDigest 45818e4d4d72c387739eaa8e551509671ea00ad26be3a58e5cb15b8865cd08b6 no longer matches fr.task.create's current digest a89b301407a9e1deff3d647275df97f57f220b83ae5b22cbe11248e6927c3789; refused unless it carries stale: true
```

(Plus pre-existing `CODE_DIGEST_STALE` on `br.audit.erasure.right`, `contract.plan.create-precondition`,
`impl.audit.todo-app-frontend.privacy`, `br.task.delete.final`, `fr.task.create` — the product code
moved under them before this lane; not introduced by it.)

Tree-wide refusals remaining (128) are other lanes' surface: 71 `CODE_DIGEST_STALE`-class evidence
refusals, ~50 `RENDER_CHECK_FAILED` captures, the 6 `id is undefined` payload refusals v7-5
documented as a gate defect, and the other recordDigest lines from concurrent Phase-1 edits.

## Unresolved record↔code contradictions left standing

- None left by this lane. The two declared tensions in my scope are now decided (audit/delete) or
  record-corrected (plan-cap). `fr.task.create`'s `state: done` now matches enforced behavior rather
  than contradicting it; its stale evidence is the evidence lane's to re-capture.
- Reported, not fixed (out of scope): `br.task.single-owner`'s rev-2 `staleReason` notes
  `task.service.spec.ts:8` still carries a test named after the withdrawn rev-1 statement — a
  source-file nit in `src/**`, which this lane may not touch.
