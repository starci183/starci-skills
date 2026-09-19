# v7-15 — Topology re-audit of the fixed trees

v7 lane: the v6-3 topology audit re-run against the post-fix `.starciwork` trees.

- **Trees audited:** `examples/todo-app-backend/.starciwork` (with sibling `todo-app-frontend`), `examples/ecommerce-app-be/.starciwork` (with sibling `ecommerce-app-fe`)
- **Baseline:** `ex-testing/lint/v6-3-REPORT.md` (295 records, 191 refused / 118 warned), `v6-4-REPORT.md`
- **Audited state:** post-`done/v7-13.done` (336 records, 2834 refs, 123 evidence files)
- **Gate at close:** `check-example-work` 0 refused / 0 warned. `check-example-derived`: ecommerce clean; todo `_derived/index.yaml` re-staled minutes after close by a concurrent wave's post-seal writes (see Finding 13 verdict).
- **Deep check:** `check-work-deep` 0 refused, 23 suspects (20 `UNCLAIMED_SURFACE`, 3 `CAPABILITY_WITHOUT_SPEC`), 3 informational.
- **Method:** semantic re-audit — every v6-3 finding re-verified against current record text *and* the product code it describes; new FRs/contracts read end-to-end; all corrected owner paths re-checked on disk. Nothing in either tree was edited (audit lane).

---

## Verdicts on the v6-3 findings

### FIXED — semantic fixes verified against code

**[v6-3 #1, critical] Gate fails at scale → FIXED.**
295→336 records; `every id matches its place, every ref resolves, and every new-concept rule is satisfied`. The class-level causes were fixed, not silenced: fake payload ids reverted (#14), wrong topologies corrected (#7), edges retargeted (#8), workspace fields aligned (#12). Residual: one stray zero-byte `features/nul` file remains in the ecommerce tree (see New Issues).

**[v6-3 #2, critical] Fabricated `apps/*` paths in ecommerce → FIXED.**
Zero `apps/` owner paths remain. Evidence files for all impl/contract records were regenerated fresh (digests, owners, schemas now real). `sds.checkout.order-flow` contract-doors correction verified against `order.client.ts` (`/internal/buyers/`, `/internal/sessions/verify`) and the real GraphQL mutations (`selfCheckout`, `selfPurchaseHistory`).

**[v6-3 #3, high] Frontend impls named nonexistent `[lang]` routes → FIXED.**
All 7 corrected owners verified on disk: `[lang]/tasks`, `[lang]/notify`, `[lang]/plan`, `[lang]/recur`, `[lang]/tasks/[taskId]/share`, `[lang]/audit`, `[lang]/sign-in` — every one exists in `todo-app-frontend/src/app/`. The sign-in subtlety was handled correctly: the pre-existing `src/app/sign-in` owner is the *mascot media route* (`sign-in/turtle-master.png/route.ts`), so it was kept and `[lang]/sign-in` was added alongside it.

**[v6-3 #4, high] `contract.checkout.order-for-identity` named a wire path code doesn't serve → FIXED.**
`GET /internal/buyers/{personId}` now matches `BuyerController` (`@Controller("internal/buyers")`) and `order.client.ts` (`/internal/buyers/${personId}`) — verified both ends.

**[v6-3 #5, high] `fr.task.create` `provenBy` claimed proof that doesn't exist → FIXED.**
Zero hand-authored `provenBy:` keys remain in either tree (only `provenBy` *comments* survive, flagged explicitly as examples in two records). The claim was replaced honestly: `uat.task.create` now has a real settled run (`20260919T112844Z`, pass) and `state: done` — and `fr.task.create`'s `evidence.yaml` binds that run plus fresh captures.

**[v6-3 #6, high] `fr.task.create` contradicts `contract.plan.create-precondition` → FIXED.**
`fr.task.create` now states the cap refusal itself (`"…and refuses task creation once the active plan's task cap is reached"`), composes `br.plan.caps.limit`, and the contract's `conflictsWith` edge was dropped. Verified against `create-task.handler.ts` → `TaskCreationPolicyRegistry.assertMayCreate` → `PlanCapGuardPolicy`. No residual contradiction.

**[v6-3 #7, medium] Missing FRs / wrong kinds for business behaviour → FIXED.**
- `fr.task.delete` created: permanent owner-scoped delete publishing `TaskDeletedEvent` — matches `DeleteTaskHandler` (`findOwnedRow` + `OwnershipGuard` + `delete`, then publish).
- `fr.task.list` created: owner-scoped `listOwnedBy` reads with wire-accurate TaskCounts/TodaySummary fields — matches the resolvers.
- `fr.checkout.cart.{add,clear,list}` + `br.checkout.cart` + 3 ac records created: person-scoped upsert/clear — matches `selfUpsertCartLine`/`selfClearCart`/`selfCart` resolvers and `cart.service.ts` (`personId` where-clause, `REQUEST_INVALID`/`INVENTORY_UNAVAILABLE` refusals).
- `br.identity.account` + 3 acs + `fr.identity.account` created: thin passthrough to order service — matches `selfAccount` resolver (`PERSON_UNKNOWN` before the order call, no caching) and the `contract.identity.account-for-buyer` consumer obligations.
All checked: no conflictsWith contracts; claims match code.

**[v6-3 #8, medium] Stale non-record references → FIXED.**
Composes `repository:` fields corrected to real module files (`plan-cap-guard.policy.ts`, `task.service.ts`, `plan-cap-refusal.exception.ts`, `plan-cap-read.service.ts`); `journey.task.first-task`'s false `because` naming a `tasks.page.tsx` ancestor removed. Existence sweep over all yaml `file:`/`path:` values: zero missing.

**[v6-3 #9, medium] Blocker rot → FIXED.**
Rev pins corrected to rev 4; `because` texts rewritten to name the real proof mechanism ("its uat flow cannot currently settle"); chains now root at the newly created `gap.task.single-owner-editor-arm` — a genuine unresolved gap whose description was verified as an accurate summary of code and evidence reality (owner protection exists in code; no run in evidence inspects a deleted task's editor).

**[v6-3 #12, medium] `impl.todo-backend.*` directory/repository mismatch → FIXED.**
`workspace.yaml` name corrected to `todo-app-backend`; all 17 backend impl records carry `repository: todo-app-backend`. Consistent throughout.

**[v6-3 #14, low-medium] Fake `id:` fields on payloads → FIXED, the right way.**
v7-5 reverted the fake ids, keeping the real `starci/*` schemas; the gate was extended to exempt payload namespaces (or payloads got per-record namespaces). Verbatim gate output: `2 payload(s) under assets/** are exempt — payloads are not Work nodes`. The chosen fix matches v7-5's own recommendation.

**[v6-3 #15, low] Root drift → FIXED.**
`business-rules/` deleted, `DIRECTIONS.md` moved under `ui/todo-app/assets/` with link refs repointed.

**[v6-3 #16, low] Vocabulary misuse → FIXED.**
All three `conflictsWith` misuses corrected: `br.login.session.new-device-signal` now `blockedBy: gap.login.device-field` (the real gap); `fr.recur.occurrence` demoted to `refs:`; `br.audit.erasure.right`'s retention conflict resolved — legitimately, because `decision.audit.erasure-method` (crypto-shred) narrowed retention so the statements no longer contradict. `event.login.signed-out` recomposed to `br.login.session.restores` (matching the code comment's own wording: revocation restores `br.login.session`, not `session.restores`).

### FIXED, then re-broken by a concurrent wave

**[v6-3 #13, medium] `_derived/` stale → FIXED AT CLOSE, RE-STALED.**
The closer rebuilt both trees' `_derived` (`check-example-derived` clean at seal). Minutes later a concurrent wave (v8/v9 lanes per `v7-FLEET-SUMMARY.md`) wrote a new recur UAT run and touched `recur/gap/live-proof` + `recur/uat/make-recurring` records — the todo `_derived/index.yaml` is stale again at audit time. This is the gate working as designed (derived must lag edits), not a v7 regression; the todo tree needs one more `--write` pass whenever the concurrent wave settles.

### Partially fixed — honest residue, correctly declared

**[v6-3 #10, medium] `_resources` realm contradiction → FIXED for realm; residue remains.**
Realm now reads `todo` everywhere (`_resources`, `realm/index.yaml`, `login.service.ts` default, `identity.integration.ts`) — the fix went in the correct direction (records to code). Residue: record ids `identity.todo-app.*` and the keycloak `outboxPoller` scope still embed `todo-app`/`todo` inconsistently — declared in `todo-app-backend/_resources/index.yaml` notes as "id churn noise", an accepted inconsistency rather than a hidden one.

**[v6-3 #11, medium] `event.login.signed-in`/`signed-out` can't become done → PARTIALLY FIXED.**
Records still `todo` (unchanged semantics — no assertion command exists to produce evidence), but now carry accurate producer wiring (`SignedInEvent`/`SignedOutEvent` publication verified in `sign-in.handler.ts`/`sign-out.handler.ts`) and honest descriptions of *why* they're open. The done-producer/todo-event inversion is now declared rather than hidden. Under the Work model this is correct; if the fleet wants these done, someone must add a runnable assertion — that's a forward task, not a lie in the tree.

**[v6-3 #17, low] Spec contradiction (`featureCatalog` path) → STILL PRESENT, out of lane scope.**
`work-catalog/work-layout` schema/text disagreement is in `catalog/` and `skills/` — not a `.starciwork` tree fix. v7-5 reported it; trees follow the schema. Unresolved by design.

---

## The v7-15 brief's specific checks

**"Are the new fr's real statements of code behaviour?"** — Yes. `fr.task.delete`, `fr.task.list`, `fr.checkout.cart.*`, `fr.identity.account` were each verified line-by-line against their handlers/resolvers/services. Field names, refusal codes, scoping, and event publication all match.

**"Contract surfaces corrected to real wire paths?"** — Yes. `/internal/buyers/:personId` verified at controller and client. Additionally verified: `contract.login.identity-for-task` rev 3 now names `Authorization: Bearer <sessionToken>` and this matches `session-actor.adapter.ts` (`/^Bearer\s+(.+)$/i`) — including the documented reason (rev 1/2's implicit `x-session-token` mismatch was what a live UAT run caught). `sds.checkout.order-flow` doors now name real mutations and `/internal/sessions/verify`.

**"[lang] owner paths real?"** — Yes; all 7 ls-verified against `todo-app-frontend/src/app/[lang]/`.

**"provenBy gone?"** — Yes; `rg -l "^provenBy:"` returns empty for both trees. Two `spec:`/`comment:` strings mention provenBy only to document the *vocabulary* (v7-2 left them as annotated examples).

**"Blockers rerooted at real gaps/decisions?"** — Yes. `gap.task.single-owner-editor-arm` (code-verified: owner protection exists, no proof captures it), `decision.audit.deleted-task-target` (chosen `history-not-resolution` matches `AuditLogService` behaviour — the log keeps the raw task id while reads resolve to nothing), `gap.task.no-load-harness` (no k6/scripts exist — verified), 5× `gap.*.render-proof` (each names a real measured failure: off-brand colours, `ARCH_CONFIG_INVALID`, unprovable layouts).

**"New contradictions from the additions?"** — See below.

---

## New issues found during this audit

1. **Stray `features/nul` file** — `ecommerce-app-be/.starciwork/features/nul`, 0 bytes, created mid-wave (~21:12) by a Windows redirect accident (`> nul` hitting bash). Inside `features/`, so it's custody drift under the common rules; the gate doesn't see non-yaml files, so it wasn't refused. Should be deleted by whichever lane owns the tree next.

2. **`impl.plan.todo-app-backend.plan` has contradictory verification metadata** — `state: done`, `verificationSource: authored-claim`, `verification: []` *and* fresh real evidence. The `authored-claim` flag is now vestigial — it says "proof is the author's word" while real proof sits in `evidence.yaml`. Harmless (gate-clean, and evidence truthfully fresh) but sloppy; the flag should be cleared when the plan UAT leg settles.

3. **`fr.task.create` done while composing a `todo` rule** — `br.task.single-owner` stays `todo` (stale evidence, correctly flagged), yet both composing fr's diverge: `fr.task.create` done / `fr.task.complete` todo. Declared asymmetry, not hidden — but "composes a todo rule while done" is a real open inconsistency in the convention, flagged already by v7-1 and still unresolved.

4. **Stale code comment contradicts the contract record** — `request-erasure.resolver.ts:25` still says the personId comes from `x-session-token`; the code actually calls `session-actor.adapter` (Bearer). Product-source comment, not a tree file, but it's exactly the kind of stale statement these audits exist to catch — noting for the record-owners' next pass.

5. **`uat.notify.digest-and-unsubscribe` inprogress, one leg not-run** — honestly declared (no SMTP host, `channel: email` marked `not-run` with explanation). Not a defect — included here because it means `br.notify.digest` can't close until an SMTP-configured environment exists. Same for `gap.sepay.no-live-intent` (ecom, inprogress, named honestly).

6. **Deep-check suspects are real and mostly structural** — 20 `UNCLAIMED_SURFACE`: the todo tree has many GraphQL resolvers + the whole `health`/`internal`/`webhooks` HTTP surface with no owning impl/spec record (e.g. `plan/my-plan`, `plan/my-usage`, `share/*`, `audit/*` resolvers, `POST /internal/tasks/complete-occurrence`, `POST /webhooks/sepay` in ecom). 3 `CAPABILITY_WITHOUT_SPEC`: `todo health/internal/webhooks` and ecom `webhooks` feature dirs contain doors with no spec records at all. These are genuine undeclared surfaces — the trees still don't cover everything the code exposes. Not gate-blocking (suspects, not refusals) but the honest boundary of "truthful" here is: *the records that exist are truthful; the code has more surface than the records describe.*

---

## Semantic vs gate-only summary

| Fix | Kind |
|---|---|
| Missing fr's/br's created and verified against handlers | Semantic |
| Contract wire paths corrected (`/internal/buyers`, Bearer header, sds doors) | Semantic |
| `[lang]` route owners corrected + verified on disk | Semantic |
| `provenBy` removed, replaced with real settled UAT run | Semantic |
| Plan-cap contradiction resolved (fr states refusal) | Semantic |
| Blocker chains rerooted at real verified gaps/decisions | Semantic |
| Realm direction fixed (records → code default `todo`) | Semantic |
| Payload fake ids reverted; gate exempts payload namespaces | Tooling fix (correctly placed — payloads aren't nodes) |
| Workspace name / `repository:` fields aligned | Structural fix |
| `_derived` rebuilt | Mechanical (re-staled by concurrent wave) |
| `evidence.yaml` regenerated with real digests/owners | Semantic (real re-derivation, not copied) |
| 4 fe impls demoted `done`→`todo` on real render failures | Semantic honesty (truthful state over clean tree) |
| UAT manifests with `not-run` legs kept as gaps | Semantic honesty |

**Not done to clear the gate** (confirmed by inspection): no `stale: true` was used except where genuinely true and named; no record was marked `done` without fresh evidence or a settled run; no `provenBy`/`proves`/run/digest was fabricated; the only gate change was the payload-namespace exemption, which is the correct place for it.

---

## Honest bottom line

The v7 fleet's claim — *"the records that exist describe the code as it actually is"* — holds up under this re-audit, with the residual scope caveat above (20 unowned surfaces are real code with no records). All v6-3 headline findings are fixed semantically; the only tree-level regressions are the concurrent-wave `_derived` staleness (mechanical, self-healing on next `--write`) and one stray `nul` file. Remaining tensions (`authored-claim` flag, composed-todo-rule asymmetry, `todo` events with `done` producers, open UAT legs) are all *declared in the records* rather than hidden — which is precisely the difference between a truthful tree and a clean-looking one.
