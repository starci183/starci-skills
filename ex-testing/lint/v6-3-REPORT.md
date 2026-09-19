# Lane v6-3 — Work topology audit: are the examples' .starciwork trees rigorous, correctly topologized, non-contradictory?

Date: 2026-09-19. Scope honored: read-only. Only this file was written.
Trees audited: `examples/todo-app-backend/.starciwork` (295-record share of the pair),
`examples/ecommerce-app-be/.starciwork`, plus the `src/` they describe.
Gates run: `scripts/check-example-work.mjs` (twice), `scripts/check-example-derived.mjs` (once).

## Snapshot caveat — the tree moved under the audit

`check-example-work.mjs` was run twice, ~15 min apart. Between the runs an
outside process edited `ecommerce-app-be` records: `sds.checkout.order-flow`'s
owners flipped `apps/order/src/...` → `src/modules/...` at 16:54, the same
correction landed on `br.checkout.place-order`, both impl records and
`br.identity.sign-in`, and the six `ui/*/assets/*.yaml` payloads gained record
ids (`id: ui.checkout.cart.assets` etc.). Verdicts below are the *end* state
unless marked "[start-state]"; both gate outputs are quoted where it matters.

Gate totals: **run 1 — 290 records, 200 refused, 4 warned. run 2 — 295 records,
191 refused, 4 warned** (the +5 records are the asset payloads turned into
records by the added `id:` lines — see finding 14).

## Q1 — Topology correctness: does `features/` mirror the product? — **has-gaps**

Feature set vs code:

- todo catalog = 7 features (login, task, share, notify, plan, audit, recur) =
  7 feature dirs. Every `src/modules/bussiness/*` dir (task, session, share,
  notify, plan, recur, audit) and every `src/modules/integrations/*` (keycloak,
  notify-queue, notify-smtp, sepay) is claimed by an impl record's `owners`
  (`features/*/impl/todo-app-backend/*/index.yaml`). Sound at the top level.
- ecom catalog = 2 features (checkout, identity) = 2 dirs; all six
  `src/modules/bussiness/*` (account, cart, catalog, order, payment, session)
  and both integrations are claimed via impl/sds/br owners.

Orphans — code capability with no record:

- **`delete task` has no FR.** `src/modules/bussiness/task/delete-task.handler.ts`
  and the `delete-task` GraphQL mutation exist and work (spec + live-proof), the
  event `event.task.deleted` is done — but `features/task/fr/` holds only
  `complete`, `create`, `reopen`. There is no `fr.task.delete`. The event's
  `producer:` is `br.task.delete.final` — a business rule, not a flow — precisely
  because no flow record exists to produce it.
- **`list tasks` has no FR** either: `list-tasks.handler.ts` +
  `task-counts.handler.ts` + `queries/task/{list-tasks,task-counts}` are covered
  only by `br.task.list.owned`, `contract.task.list-for-dashboard` and
  `impl.task.todo-app-backend.list`.
- **ecom cart operations have no requirement record.** `add-cart-item`,
  `clear-cart`, `cart` query under `src/features/checkout/graphql/` are real
  resolvers; no `fr.checkout.*`/`br.checkout.*` names them — only
  `sds.checkout.order-flow`'s `t-add` transition (`on: cart-line-added`) and the
  ui screens' prose mention them.
- `src/features/todo/http/health` is owned by no impl record (the only
  reference is the `api-reachable` probe in
  `_resources/environments/dev/resource.yaml`).
- The GraphQL doors for task/plan/share/audit
  (`src/features/todo/graphql/{mutations,queries}/{task,plan,share,audit}`) are
  in no impl's `owners` — only session, recur and notify doors are owned.
- `src/modules/platform/{config,cqrs,logging}` and
  `src/modules/shared/exceptions/errors/*` except `errors/notify` are unowned
  (only `platform/databases/postgresql/primary` and `platform/events` have
  records: `impl.task.todo-app-backend.platform-{database,events}`).

Orphans — record-side:

- **ecom owner paths were entirely fictional [start-state].** Every ecom
  record's `module`/`owners` named `apps/order/src/modules/bussiness/*`,
  `apps/identity/src/...` — but `apps/order/src/` and `apps/identity/src/`
  contain only `main.ts`, `app.module.ts`, `app-module.boot.spec.ts`; the modules
  live at repo-root `src/modules/...` (imported via `@modules/...` aliases).
  First gate run: 5 OWNER_PATH_MISSING refusals covering br, sds and both impl
  records. The paths were corrected to `src/...` mid-audit; the *evidence*
  `codeDigest`s were never recomputed, so all 8 ecom evidence files are now
  stale against both old and new paths.
- `impl` directory naming violates the layout: dirs are
  `features/<f>/impl/todo-app-backend/` but every such record carries
  `repository: todo-app` (workspace.yaml's be entry is `name: todo-app`). The
  layout (`work-layout.yaml` impl entry) says the directory is "the exact value
  the record's own `repository` field names" — `todo-app-backend` ≠ `todo-app`.
  The gate does not check this; ids embed the directory (`impl.task.todo-app-
  backend.list`) while the field says otherwise — a three-way dir/id/field
  mismatch.

## Q2 — Contradictions — **has-gaps** (several real ones; most are at least declared)

Found and verified against code:

1. **`contract.checkout.order-for-identity` (done) declares a route the code
   does not serve.** Surface says `GET /buyers/:personId`; the provider is
   `@Controller("internal/buyers")` (`src/features/checkout/transport/http/
   buyer.controller.ts`) and the consumer calls `/internal/buyers/:personId`
   (`src/modules/integrations/order/order.client.ts:32`). A done contract whose
   wire path is wrong on both ends.
2. **`contract.plan.create-precondition` (done) vs `fr.task.create` (done) —
   declared, unresolved.** The contract's consumerObligations require the create
   path to call `TaskCreationPolicy.assertMayCreate` and refuse on
   `PlanCapExceededException`; the code does exactly that (proven per
   `create-precondition.contract.spec.ts`), while `fr.task.create`'s mainFlow
   still says a non-empty title alone creates a task. The contract's own
   `conflictsWith` names this ("two different, currently incompatible
   realities"). Honest declaration, but it means `state: done` on the fr is
   spec-wrong about current behavior.
3. **`data.audit.log-line` vs `br.task.delete.final` — declared tension.** The
   append-only log keeps a deleted task's identifier for the retention window;
   `stays-gone` says the identifier "resolves to nothing ... now and after a
   restart." Real conflict, recorded on the data record (`conflictsWith`, rev 1
   pins match) — the best-handled contradiction in the tree.
4. **`contract.notify.task-completion-feed` describes a mechanism that doesn't
   exist.** Surface: `onTaskComplete` direct call. Reality: PlatformEventBus
   pub/sub. The rev-2 note admits it and keeps the record todo — declared, not
   hidden, but the `surface` still states a wrong shape.
5. **`_resources` realm mismatch.** `identity.todo-app.demo` custody says
   `realm: todo-app` and `environment.todo-app.dev`'s probe hits
   `realms/todo-app` — but the imported realm file is `"realm": "todo"`
   (`.starcistacks/dev/infra/compose/realm-todo.json`), the code default is
   `realms/todo` (`app-config.service.ts:9`) and `integration.login.keycloak`'s
   endpoints say `/realms/todo/...`. The probe as written 404s.
6. **Unsatisfiable `requiresProof.e2e` commands.** `npm run test:e2e --
   tasks/complete|create|reopen`, `auth/sign-out`, `audit/log-append`,
   `audit/log-read`, `audit/export`, `audit/erasure-*`, `recur/*` — jest
   positional patterns matching no spec path (real files:
   `src/tests/e2e/task/task-lifecycle.e2e-spec.ts`,
   `src/tests/e2e/session/sign-out.e2e-spec.ts`, ...). `fr.task.complete`'s own
   comment concedes the named command "does not exist in this repository."
   Several `done` frs (all `fr.audit.*`) carry them.
7. **`event.login.signed-in`/`signed-out` are todo while their producer is done
   and the code emits them.** `SignInHandler`/`SignOutHandler` publish both
   (verified), audit's subscriber routes both, `fr.login.sign-in` is done — the
   event records stay todo with no remaining blockedBy ("left for login's lane
   to advance"). Done producer / todo product inversion.
8. **`journey.task.first-task`'s blockedBy justification is false.** Its
   `because` claims no `uat/sign-in/runs/<runId>` with a passing result exists —
   `uat.login.sign-in` is done, settled on run `20260918T174721Z-023dd8d9`
   (pass + videos + screens). The edge target (`gap.task.live-proof`) is still
   right for the task half; the stated reason is stale.
9. **`contract.notify.new-device-signal` misuses `conflictsWith`.** It cites
   `br.login.session.single-device` not for a rule-rule conflict but because the
   device field isn't built — which `blockedBy: gap.login.device-field` already
   says correctly.
10. **`fr.login.sign-out` composes `br.login.session.single-device`** — the
    eviction rule governs *sign-in* (a new sign-in ends the old session), not
    sign-out; sign-out's "the session ends" doesn't exercise it. The composition
    also makes sign-out wait on a rule its flow doesn't need.
11. **Stale rev pins.** `contract.share.completion-guard-for-task` blockedBy
    cites `fr.task.complete@rev 2` (the record carries *no* `change.rev`) and
    `br.task.single-owner@rev 2` (now rev 3); `fr.task.complete` cites
    `br.task.single-owner@rev 2` (rev 3). The gate's staleness check only fires
    when the target is done — todo targets keep stale pins silently.
12. **Stale `because` text.** `journey.notify.told-about-completion`'s blockedBy
    says `fr.task.complete` is blocked by `br.task.complete.once`, `single-owner`
    and `gap.task.collaborator-completion` — the actual edge list is now just
    `br.task.single-owner` (once-edge dropped, gap closed).

## Q3 — Id/ref integrity beyond the gate — **has-gaps**

~25 edges read at both ends. The large majority resolve to the record that means
the right thing (`subscribes` → all 5 real events with a real subscriber in
`audit-event.subscriber.ts`; `proves` chains on impl records all land on done
targets — 0 PROVES_TARGET_NOT_DONE; `appliesTo`, `environment`/`fixtures`/
`accounts` resource edges resolve with correct kinds). Defects found:

- **`provenBy` is hand-authored and unverified.** The schema calls it
  kernel-computed; these records ship it anyway (6 files), and nothing checks
  its contents. `fr.task.create` (done) carries `provenBy.uat: [uat.task.create]`
  — but `uat.task.create` is `state: todo`, its blockedBy says no qualifying run
  exists, and it has no `evidence.yaml`. A done record asserting UAT proof by a
  flow that never settled a passing run is a false proof claim invisible to the
  gate.
- **`contract.task.list-for-dashboard`'s consumer is `dashboard`** — no
  `features/dashboard` exists in the catalog; `between.consumer` is not checked
  against the feature set. The record's own comment admits the consumer doesn't
  exist.
- **`composes[].module` stale paths** (see Q2-6 context): `fr.task.complete`
  → `src/modules/domain/task/**`, `src/features/complete-task/**`,
  `src/share/access.service.ts`; `fr.task.create` → `src/modules/domain/task/**`,
  `src/features/create-task/**`; `fr.notify.on-new-device` → `src/notify/dedupe`,
  `src/notify/digest`. None exist — these are pre-migration guesses the task and
  part of the notify lanes never corrected (other features did correct theirs;
  the inconsistency is itself a finding).
- **BLOCKER_UNROOTED (3 warned, real):** `fr.task.complete`,
  `contract.share.completion-guard-for-task` and
  `journey.notify.told-about-completion` all dead-end at
  `br.task.single-owner` — a todo rule with *no* blockedBy and no gap explaining
  why it can't be done (its rev-3 note explains: its evidence never exercises
  the accepted-editor arm — a real but unrecorded root).
- `event.task.deleted.producer: br.task.delete.final` — a business rule as an
  event producer (because no `fr.task.delete` exists; see Q1).

## Q4 — Coverage honesty: is done-without-proof enforced? — **the mechanism is real; the corpus is mostly stale**

- Enforcement exists and fires: the gate refuses `done` + no `evidence.yaml` +
  no `verificationSource: authored-claim`+`because` for every schema outside
  `AUTHORED_CLAIM_SCHEMAS = {work/data, work/brand, work/policy-decision}` —
  **3 authored-claim schemas vs 12 proof-required stateful schemas** (br, fr,
  nfr, journey, sds, ui, impl, uat, contract, integration, gap, event; ac has no
  state). Zero such refusals today: all 24 done-without-evidence records are
  data/policy-decision — sanctioned.
- **But 78 of 114 evidence files (68%) are currently refused as stale** — 76
  CODE_DIGEST_STALE + recordDigest mismatches — and only **2** carry the
  `stale: true` escape valve. Every code-bound proof in todo (71 files) and all
  8 in ecom no longer match the code on disk. `state: done` is widespread;
  current proof is not. `brand/assets/work-check-final.txt` preserves a run
  showing only 2 refusals — the tree once nearly passed and has since rotted.
- **Escape hatch misuse:** `verificationSource: authored-claim` is accepted on
  *any* schema. It's used defensibly by 19 `work/gap` records (gap closure is a
  derived fact) but also by two `work/implementation` records
  (`impl.plan.todo-app-backend.plan`, `impl.plan.todo-app-frontend.usage`,
  `verification: []`) — an implementation claiming done on an authored
  assertion, beside a now-stale evidence.yaml.
- **Under-claim too:** `uat.task.create` is todo with a *passing* run on disk
  (`runs/20260918T090054Z-240aa95e`, outcome pass, screens present, no videos/
  — so it can't be done by rule) while `fr.task.create`'s `provenBy.uat` names
  it as proof anyway. Both directions of dishonesty in one pair of records.

## Q5 — `business-rules/`, `_derived/`, `_resources/` — **has-gaps**

- `business-rules/` (todo root): **empty directory, unsanctioned.** The
  layout's custody rule allows workspace.yaml, brand/, features/,
  ledger-anchor.json, runtime/kernel dirs, _local, _resources, _derived — "a
  file at the root that is none of these is drift," and "empty layers are not
  scaffolded." This empty dir echoes the retired `business/` nesting the
  families note says was removed. Drift.
- `_derived/`: sanctioned shape (generated by `example-derive.mjs` /
  `example-critique.mjs`), but `check-example-derived.mjs` refuses **all 4
  files in both trees as stale** — the derived frontier/critique lag the
  records, so the "readable index" is currently wrong.
- `_resources/` (todo only): sanctioned, correct `work/resource` schema and
  kinds; the only defect is the realm contradiction above.
- **ecom `DIRECTIONS.md` at `.starciwork` root**: unsanctioned root file under
  the same custody rule — drift (a human doc file sitting in canonical space).
- ecom has no `ledger-anchor.json` (harmless — no live workflow has run).

## Q6 — The catalog — **strict** on contents, one spec-level contradiction

- `index.yaml` (todo) lists 7 features = 7 dirs; ecom lists 2 = 2 dirs. Every
  entry's `directory` exists; every `features/<f>/index.yaml` is a
  `work/feature` whose id matches the catalog entry. Complete and consistent.
- **But `schemas/work-catalog.schema.yaml` places the catalog at
  `.starciwork/index.yaml` while `schemas/work-layout.yaml` says
  `featureCatalog: features/index.yaml`.** The trees follow the schema; the
  layout's shape block — which claims to be "the executable form" of the truth —
  disagrees with both the schema and reality.

## Findings, ordered by severity

1. **[critical] The trees fail their own gate at scale**: 191 refusals —
   78/114 evidence files stale (CODE_DIGEST_STALE/recordDigest), 100 render-check
   refusals (palette-off-brand deltaE failures + "no DNA snapshot for grammar
   family `common`" on every frontend capture), 6 OWNER_PATH_MISSING, 4 warnings.
   Whatever the records claim, the gate says the tree does not verify.
2. **[critical] ecom code-binding was fabricated at `apps/<svc>/src/...` paths
   that never existed** [start-state; corrected to `src/...` mid-audit but all 8
   evidence digests remain stale and unrecomputed].
3. **[high] All five done frontend impl records name routes missing the
   `[lang]` segment** — `src/app/{tasks,plan,notify,recur,audit,
   tasks/[taskId]/share}` vs real `src/app/[lang]/...` (only `src/app/sign-in`
   is correct). OWNER_PATH_MISSING on every one.
4. **[high] `contract.checkout.order-for-identity` (done) documents
   `GET /buyers/:personId`; the code serves `GET /internal/buyers/:personId`** —
   a done contract both of whose ends contradict its surface.
5. **[high] `fr.task.create` (done) carries a hand-authored `provenBy.uat:
   [uat.task.create]` naming a todo, never-settled flow** — a false proof claim
   no check reads.
6. **[high] Done spec contradicts done contract**: `fr.task.create`'s flow has
   no plan-cap precondition while `contract.plan.create-precondition` (done) and
   the code enforce it — flagged `conflictsWith`, unresolved.
7. **[medium] Missing FRs for live capabilities**: task delete, task list,
   ecom cart add/clear/query — mutations ship with no functional-requirement
   record (symptom: `event.task.deleted.producer` is a business rule).
8. **[medium] Stale non-record references**: `composes[].module` paths that
   never existed (`src/modules/domain/task/**`, `src/share/access.service.ts`,
   `src/notify/{dedupe,digest}`, `src/features/complete-task/**`); unsatisfiable
   `requiresProof.e2e` commands (`tasks/complete`, `auth/sign-out`,
   `audit/log-append`, `recur/*` — no matching spec paths).
9. **[medium] Blocker rot**: stale rev pins (`rev 2` cited against a rev-3 and
   a rev-less record), false `because` texts (`journey.task.first-task` claims a
   nonexistent-run; `journey.notify.told-about-completion` describes an outdated
   edge set), and 3 BLOCKER_UNROOTED chains dead-ending at
   `br.task.single-owner` with no gap authored for why it's held.
10. **[medium] `_resources` realm contradiction**: `todo-app` in resource
    custody/probe vs `todo` in the realm file, code default and
    `integration.login.keycloak` endpoints.
11. **[medium] Producer/product inversion**: `event.login.signed-in`/
    `signed-out` todo with no blocker while the code emits them, audit consumes
    them, and producer `fr.login.sign-in` is done.
12. **[medium] `impl/todo-app-backend/` directory names ≠ `repository:
    todo-app`** — violates the layout's exact-match rule; unchecked by the gate.
13. **[medium] `_derived/` is stale in both trees** (4 files refused by
    `check-example-derived.mjs`) — the generated index a reader is told to trust
    describes an older tree.
14. **[low-medium] Gate compliance by gaming** [observed mid-audit]: payload
    files `ui/*/assets/generation-receipts.yaml` and `direction-check.yaml`
    were given record ids (`ui.checkout.cart.assets`) to silence the
    id-mirroring check — turning "never a Work node" payloads into fake records.
    Either the gate shouldn't walk `assets/` payloads, or the payloads shouldn't
    pose as records; both can't be right.
15. **[low] Root drift**: empty `business-rules/` dir (todo) and `DIRECTIONS.md`
    (ecom) — both outside the sanctioned root custody set.
16. **[low] Vocabulary misuse**: `conflictsWith` used for "field not built"
    (`contract.notify.new-device-signal`); `fr.login.sign-out` composing
    `br.login.session.single-device`, a rule its flow doesn't exercise.
17. **[low] Spec contradiction**: `work-layout.yaml`'s `featureCatalog:
    features/index.yaml` vs `work-catalog.schema.yaml`'s
    `.starciwork/index.yaml` (trees follow the schema).

## Bottom line

The honest parts are genuinely good: declared tensions are recorded rather than
hidden (log-line vs delete-final, plan contract vs create fr), gap records
mostly name real absences, and the corrected-owner fixes during the audit show
the layout corrections do happen. But as a *worked example of a verified tree*
it fails: two-thirds of its evidence is stale, a sixth of its refusals are
render proofs that cannot run in this host, frontend route ownership is wrong on
every done screen, and several records claim or disclaim proof the gate never
checks (`provenBy`, `because` text, rev pins on todo targets). The mechanism is
rigorous; the content currently is not.
