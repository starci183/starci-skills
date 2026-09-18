# The todo-app standard

`examples/todo-app-backend` and `examples/todo-app-frontend` are the reference pair the owner will hand to
outsourced developers and to the next refactor of every StarCi skill. This document reads them as they are
on disk today, not as any spec says they should be. Every claim below names a real path or a real record id.
Section 9 lists every place the tree, the schemas and the check scripts disagree.

## 1. What this example is

Two repositories make one product. `examples/todo-app-backend` owns the canonical `.starciwork` (the Work
tree: business rules, flows, design, implementation records, UAT) and the canonical `.starcistacks` (the
deployment declaration and its environments). `examples/todo-app-frontend` owns none of either. Its own
`README.md` says this directly: "It owns no `.starciwork`: the Work records of this product live in
`todo-app-backend/.starciwork`, and the records that describe these screens name this repository by name
(`impl.task.todo-app-frontend.task-list`, `ui.task.list`)."

This pairing is one of two topologies `schemas/work-layout.yaml` recognizes. In a multi-repository product
(this example), `.starciwork` lives in the bound backend repository, and
`.workspaces/projects/<project>/{be,fe}.json` at the host routes each side to its own repository and its own
`architecture.json` roots. In a monorepo, `.starciwork` lives at the repository root instead, and
`architecture.json` names `apps/*`/`packages/*` as its roots rather than a second repository. Both topologies
host the identical `features/<feature>/{...}` tree; only where `.starciwork` sits and how its roots are
declared differ. A project runs one shape or the other for one product, never both at once.

The backend is a NestJS domain-first application (`package.json` calls it "NestJS domain-first example for
the runtime's architecture checks"); the frontend is a Next.js app consuming an internal `@todo-app/grammar`
package. Both are checked by the same `starci architecture check` tool against their own `architecture.json`,
and both are walked by the same `.starciwork` catalog for UAT and evidence.

## 2. How to read a feature

`features/task/` is the core feature: "A task a person creates, completes and deletes"
(`.starciwork/index.yaml`, catalog entry `task`). Its records live in flat family folders directly under
`features/task/` — `br/`, `ac/` (nested under each `br/`), `fr/`, `nfr/`, `sds/`, `data/`, `decision/`,
`contract/`, `event/`, `gap/`, `ui/`, `impl/`, `uat/`, `journey/` — not under a `business/` or `architecture/`
subtree. (Section 9 covers why this differs from `schemas/work-layout.yaml`'s documented shape.)

**`br` (business rule)** is a statement plus an id, a `module` (or list of modules) it belongs to, and a
`change` record. `br.task.title.required` says: "A task is created only with a non-empty title, trimmed of
surrounding whitespace." Its `acceptanceCriteria: [refuses-empty]` names its **`ac` children** by short name;
the full id is derived from the path (`features/task/br/title/required/ac/refuses-empty/index.yaml` →
`ac.task.title.required.refuses-empty`). Each `ac` is a `given/when/then`: "Given a creation request, when
its title is empty or only whitespace, then creation is refused and nothing is written."

**`fr` (functional requirement)** composes rules into a flow. `fr.task.complete` names its actors
(`[owner, collaborator]`), its trigger, its main and exception flows, and a `composes` list:
`{rule: br.task.single-owner, module: src/task/ownership}`, `{rule: br.task.complete.once, ...}`,
`{rule: br.share.role.permissions, ...}` — one entry per rule the flow relies on, each naming the module that
implements it.

**`sds` (SDS component)** carries a state machine as data and a sequence of observable steps, not prose.
`sds.task.ownership-guard`'s `stateMachine` has four states (`unchecked, owned, collaborating, foreign`) and
three transitions, each `{id, from, to, on, effect}`. Its `sequence` is a numbered list of
`{from, to, message, observable}` steps — for example `{from: browser, to: api, message: "PATCH /tasks/:id
with the actor's session", observable: http}` — naming only what an end-to-end run can actually see, not the
guard's internal order.

**`data`** is a field list plus invariants. `data.task.task` declares `id, owner, title, complete,
completedAt` and two invariants: "owner is never null and never changes for a given id" and "completedAt is
set if and only if complete is true."

**`decision`** is open or decided, never anything invented in between. `decision.task.list.scope` is
`outcome: open` — "Does an organization owner see the tasks of its members" — with three named `options` and
a `recommendation` that is not itself a decision. `decision.share.invite.expiry-window` is `outcome: decided,
chosen: fixed-window` — a pending invitation expires after fourteen days rather than staying open until
revoked.

**`contract`** is a provider/consumer surface, not a rule. `contract.share.completion-guard-for-task` names
`between: {provider: share, consumer: task}`, a `surface` of two functions (`mayComplete`, `mayDelete`) each
with a `shape`, a `guarantee` and a `stability` note, plus `consumerObligations` the consumer must keep
("task treats a null or throwing actor as unauthenticated, never as an owner").

**`integration`** is one node per external system a business or design record actually declares.
`integration.login.keycloak` is `state: done`: it names the real provider, its `endpoints`, its `credential`
(`KEYCLOAK_ADMIN_PASSWORD_FILE`, stored at `.starcistacks/dev/runtime/files/keycloak-admin-password.key.enc`),
and requires `live: {required: true}` proof against the real provider, not a fake.

**`event`** describes a fire-and-forget signal: producer, typed `payload`, and a `delivery`
`{guarantee, ordering}`. `event.task.created`'s payload includes a `sourceEventId`, "Stable and unique per
real create; the only thing a subscriber's dedupe key can honestly hash," and it is `blockedBy:
gap.audit.emitted-events` because nothing in the code emits it yet.

**`gap`** is a named absence, not restated prose. `gap.share.unbuilt-module`'s `statement`: "The example is
moving to a real NestJS backend and a Next.js frontend. `src/share/access.service.ts` and
`src/share/invitation.service.ts` do not exist yet... so no rule, flow, component or screen in this feature
has anything to run acceptance criteria or a UAT walk against." It carries `closedBy:
impl.share.todo-app-backend.access`, naming the record whose completion actually closes it.

**`ui`** names screen states and the brand revision it was built against. `ui.task.list`'s `states:
[empty, one-task, many-tasks, refused]` and `brand: {rev: 2}`; a code comment on the record explains why it
is *not* authored as `blockedBy` on the brand even though its captures are stale against brand rev 2 — "brand
is already done: citing it as a blocker would be stale on arrival."

**`impl` (owners)** names real files by role, plural, because one screen or flow can span more than one
artifact. `impl.task.todo-app-backend.ownership`'s `owners: [{role: module, path:
src/task/ownership/ownership.guard.ts}, {role: module, path: src/task/ownership/task.repository.ts}]`, a
`revision` (a git commit), and `proves: [br.task.single-owner, sds.task.ownership-guard]`. (Section 9 shows
these exact paths no longer exist.)

**`uat`** is a walked flow with disposable accounts. `uat.task.create`'s `accounts: accounts.yaml` (two
disposable role/username/password triples), five plain-English `steps`, and `proves: [fr.task.create,
br.task.single-owner]`.

A `journey` family also exists, crossing features: `journey.task.first-task` crosses `[login, task]` and
requires both `fr.login.sign-in` and `fr.task.create`.

## 3. The three states and what each proves

**`done`, proven with evidence.** `nfr.task.list.latency` is `state: done`, `requiresProof: {measurement:
{required: true}}`, and carries `provenBy: {measurement: [{command: "see the measurement block", exit: 0}]}`.
Its sibling `features/task/nfr/list/latency/evidence.yaml` is generated, not authored by hand: it opens with
"Written by starci-kernel when it settles the operation: the assertions below are the checks it re-ran
itself, not what the worker reported." It carries a `recordDigest` (a sha256 of the record's own `index.yaml`
bytes), an `outcome`, per-assertion `observation`s ("k6 reported p95=118ms over 60s..."), and `provenance`
naming the actor, the tool, and the exact commit the run was against. A run is replayable in the sense that
its command, its environment and its observed result are all named — someone can rerun `k6 run
scripts/load/list.js` and compare.

**`stale`, and what a developer does next.** `br.task.single-owner` is `state: todo` at `change.rev: 2`. Its
`change` block:

```yaml
change:
  rev: 2
  kind: breaking
  at: 2026-09-18T06:20:00.000Z
  withdraws: ["A task belongs to exactly one person, and only that person may complete or delete it."]
  reason: The share feature lets an owner grant an editor collaborator the right to complete a task the
    owner still exclusively owns and can still exclusively delete. The withdrawn clause conflated
    ownership (unchanged) with sole authority to complete (now shared with an accepted editor), so it no
    longer describes the product. Delete stays owner-only exactly as before; only the complete half moved.
```

The record's own `evidence.yaml` — history, not deleted — carries `stale: true` and explains exactly what
still holds and what does not: "The delete half of that observation still holds today, but nothing has
proven the split statements... since neither `contract.share.completion-guard-for-task` nor its call from
`fr.task.complete` exists yet." The digest chain propagates the same way: `sds.task.ownership-guard` and
`ac.task.single-owner.refuses-stranger` both went back to `todo`, each with a `blockedBy` entry naming the
other two and `contract.share.completion-guard-for-task` as the thing that must exist and be re-checked
before any of the three can be `done` again. `fr.task.complete` is blocked the same way, at the same rev.

What a developer does next is written into the blocker itself: build `contract.share.completion-guard-for-task`
(both the share-side provider and the task-side consumer call), then re-run the acceptance criterion and the
SDS transitions against the *new* wording, not the withdrawn one — never edit the stale evidence's digest to
make it match, since "staleness is never cleared by editing `recordDigest` to match - only a fresh run...
retires it" (`schemas/work-layout.yaml`).

A `done` record with no sibling `evidence.yaml` and no `verificationSource: authored-claim` is refused by the
gate. `scripts/check-example-work.mjs` enforces exactly this: "state is done with no sibling evidence.yaml
and no verificationSource: authored-claim + because."

**`todo` by design.** Most of `features/share/` is `todo` because the module it needs does not exist yet, and
that absence is named once and pointed at from everywhere it matters: `br.share.role.permissions`,
`br.share.editor.no-delete`, `br.share.invite.expiry`, `br.share.revoke.on-read`, `sds.share.invitation-lifecycle`,
`ui.share.invite`, `uat.share.invite-and-collaborate` and both backend `impl` records are all `blockedBy:
{record: gap.share.unbuilt-module, ...}`. `decision.task.list.scope` is a second, different shape of `todo`:
`br.task.list.owned` stays `todo` not because code is missing but because a product question — does an
organization owner read a member's list — is still `outcome: open`.

## 4. The questions the tree answers without reading source

| Question | Field or derived file that answers it |
| --- | --- |
| What is left to build in this feature? | Every record's `state: todo`, filtered to that feature's directory |
| Why is this specific thing todo? | Its `blockedBy[].because`, or a `gap` record it cites via `closedBy`/`blockedBy` |
| What proof exists that a `done` record actually works? | Its sibling `evidence.yaml` — `outcome`, `assertions[].observation`, `provenance` |
| Is that proof still trustworthy? | `evidence.yaml`'s `stale` flag and `staleReason`/`staleSince` |
| What breaks if I change X? | `X`'s inbound edges: other records' `refs`, `dependsOn`, `blockedBy`, `appliesTo`, `subscribes`, `composes` naming X, each carrying the digest of the slice it bound |
| Which rules conflict? | `conflictsWith` (pairwise) or a `work/policy-decision`'s `tension.records` (three or more, jointly unsatisfiable) |
| Which decisions are still open? | `work/policy-decision` records with `outcome: open` |
| What does the frontend need to build for this feature? | `impl.<feature>.todo-app-frontend.<name>` records and the `ui.<feature>.<screen>` they `prove` |
| What real files implement a rule? | The `br`'s `module` field, and the `impl` record whose `proves` names that rule, whose `owners[].path` names the files |
| What external systems does this feature depend on? | `extensions.work3.integrations` on the owning SRS/SDS record, resolved to one `integration.<feature>.<id>` node each |
| Has this feature's UAT ever actually been walked? | `uat.<feature>.<flow>`'s `state` and its `evidence.yaml`; `state: todo` with no evidence means never |

## 5. From record to code

**Owners and modules name real files.** A `work/business-rule`'s `module` is a plain string or list of
strings naming the source path(s) that carry it — `br.task.complete.once`'s `module: src/task/complete`. A
`work/implementation`'s `owners` is a list of `{role, path}` pairs, one entry per real artifact a screen or
flow spans — never a single `directory`/`files` pair, which `scripts/check-example-work.mjs` refuses outright
("work/implementation carries legacy directory/files/targetFiles; use owners: [{role, path}] instead").

**Test names quote acceptance criteria and business rules verbatim.** In
`examples/todo-app-backend/src/features/create-task/application/create-task.use-case.spec.ts`:

```ts
it('fr.task.create: the task is created, owned by the submitter, not complete', async () => { ... });
it('ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written', async () => { ... });
```

A reader can hold the Work record beside the test file and match them by the quoted id and wording, with no
separate traceability document.

**Evidence is kernel-generated, never hand-authored.** Every `evidence.yaml` in this tree opens with the same
comment: "Written by starci-kernel when it settles the operation: the assertions below are the checks it
re-ran itself, not what the worker reported." Its `recordDigest` is a sha256 over the sibling `index.yaml`'s
exact bytes — the same digest `kernel/reconciliation.mjs`'s `recordDigests`/`nodeFileOf` compute for
reconciliation, and the same one `scripts/check-example-work.mjs` recomputes to refuse a mismatched, non-stale
evidence file. A script named `scripts/example-evidence.mjs`, generating this file mechanically for the
example tree, does not exist in this base yet; it is landing separately and its brief was not found in
`schemas/work-layout.yaml` or elsewhere in this tree (see section 9).

**`interface.draw` and `uat.verify` attach to `ui` and `uat` through assets, not prose.** Per
`schemas/work-layout.yaml`'s `moduleUI` and `nodeAssets` shapes, retained design drawings and real running-page
screenshots both live under the owning node's `assets/**`, in original formats, distinguishing generated
design from real capture and naming the actual capture environment. This example tree currently has no
`ui/**/assets/` or `uat/**/assets/` directories on disk (its `ui.task.list` and `ui.share.invite` records
carry no asset references at all) — the mechanism is real in the schema and in the runtime's `interface.draw`/
`uat.verify` operation kinds (`docs/kinds.md`), but this particular example has not exercised it yet.

## 6. Running it

Backend (`examples/todo-app-backend/package.json`):

```sh
npm run build        # tsc -p tsconfig.build.json
npm run start         # node dist/main.js
npm run start:dev     # ts-node-dev --respawn --transpile-only src/main.ts
npm test              # jest, rootDir src, testRegex *.spec.ts
```

Frontend (`examples/todo-app-frontend/package.json`):

```sh
npm run dev        # next dev
npm run build      # next build
npm run typecheck  # tsc --noEmit
npm run test:unit  # vitest run
```

Infra (`.starcistacks/dev/README.md`): one Compose project,
`.starcistacks/dev/infra/compose/compose.yaml`, one file per component. `api` and `web` are declared with
placeholder images behind the `app` Compose profile; this example instead runs both processes on the host —
`npm run build && npm run start` in `todo-app-backend`, `npx next dev -p 3000` in `todo-app-frontend` —
against the infra the compose file brings up:

| command | effect |
| --- | --- |
| prepare | decrypt this environment's `.enc` secrets, then `docker compose ... pull` |
| doctor | `docker compose ... config` |
| up | `docker compose ... up -d` (postgres, keycloak, redis, minio, prometheus; `--profile app` adds the placeholder api/web containers) |
| status | `docker compose ... ps` |
| logs | `docker compose ... logs -f keycloak` |
| down | `docker compose ... down` |

Ports: web `3000`, api `3001` (`PORT` env, default 3001), postgres `5432`, redis `6379`, keycloak `8089`,
minio `9000`, prometheus `9090`.

Secrets are demo-only. `.starcistacks/dev/runtime/env/demo.agekey` is a SOPS age identity **committed in this
repository for reader round-trip, not real custody** — every secret's `application-stacks.yaml` entry repeats
this with `recipientPolicy: DEMO-ONLY` / `keyCustody: DEMO-ONLY`. `scripts/with-dev-secrets.sh` (or `.ps1`)
decrypts every `.enc` member listed in `runtime/env/KEYS.md` using that key via `sops`, materializes them
under `.starcistacks/dev/runtime/**` (gitignored), and runs a command with them exported — no decrypted
secret is ever written into the tracked tree.

## 7. The gates

| Command | What it refuses |
| --- | --- |
| `node scripts/check-example-yaml.mjs examples` | Any `.yaml`/`.yml` under `examples` the runtime's own strict loader cannot parse — a permissive parser accepting silently-invented keys is exactly the bug this gate exists to catch |
| `node scripts/check-example-work.mjs` | An id that doesn't match its directory place; a `ref`/`blockedBy`/`conflictsWith`/`appliesTo`/`subscribes`/`extends` pointing at an id nothing owns; a stale `blockedBy` (target already `done` at or past the cited rev); `blockedBy` authored as prose instead of `{record, rev?, because}`; a `work/gap` missing `state`/`statement`; a `work/policy-decision` with an invented `outcome` or a `chosen` not in `options`, or a `targetModule`; an unclosed `change.kind`; a `done` record with no evidence and no authored-claim declaration; `appliesTo` on the wrong schema or pointing nowhere; a malformed `work/event` or a `subscribes`/`extends` pointing at the wrong schema; `work/implementation` using legacy `directory`/`files` instead of `owners`; and an `evidence.yaml` whose `recordDigest` no longer matches its sibling's current bytes without `stale: true` |
| `starci architecture check <repo-root> [--config architecture.json]` | Backend/frontend dependency direction crossing a resolved responsibility boundary (app→feature→module, component/hook/module tiers), thin-app violations, undeclared package exports, unresolved internal imports (errors, not violations) |
| `starci check-stales --work <work-root> --repo <id>=<git-root>` | Nothing on its own — it is a read-only freshness *report* comparing canonical Work against bound source evidence; it does not repair or gate by itself |
| `npm test` (backend, jest) / `npm run test:unit` (frontend, vitest) | Any spec whose assertions do not hold against current source |
| `npm run typecheck` (frontend, `tsc --noEmit`) | Any type error across the checked TypeScript program |

## 8. What a new feature must add

Read from `features/share/`, which is fully specified and fully `todo` — a live template for "designed but
not built":

- A feature entry in the catalog: `features/index.yaml`'s `features[]` list (`{id, directory, description}`).
- A `features/<feature>/index.yaml` with `schema: work/feature`, a title and a description.
- One `br/<name>/index.yaml` per rule, each with `statements`, `acceptanceCriteria`, a `module`, and a
  `change: {rev: 1, kind: initial, at}`; one `ac/<name>/index.yaml` per acceptance criterion under it.
- One `fr/<name>/index.yaml` per flow, with `actors`, `trigger`, `mainFlow`, `exceptionFlows`, `composes`
  (one entry per rule it relies on) and `requiresProof`.
- `data/<name>/index.yaml` for every new persisted shape, with `fields` and `invariants`.
- `decision/<name>/index.yaml` for every genuinely open question, with `outcome`, `options` and a
  `recommendation` that is not itself an `outcome`.
- `contract/<name>/index.yaml` for every synchronous boundary another feature will call, naming `between`,
  `surface`, `guarantees` and `consumerObligations`.
- `integration/<id>/index.yaml` for every external system the feature's SRS/SDS actually declares under
  `extensions.work3.integrations` — one node per declared id, done only against the real provider.
- `event/<name>/index.yaml` for every fire-and-forget signal the feature raises, with `producer`, typed
  `payload` and `delivery: {guarantee, ordering}`.
- `gap/<name>/index.yaml` naming any known absence directly — "the module does not exist yet" — with
  `closedBy` naming the record that will actually close it, instead of leaving that absence as unowned prose.
- `sds/<name>/index.yaml` per architecturally significant component, with a `stateMachine` (states,
  transitions) and, where an end-to-end run can observe it, a `sequence`.
- `ui/<name>/index.yaml` per screen, with `states` and a `brand: {rev}` pin.
- Code owners: `impl/<repository>/<name>/index.yaml` per repository the feature touches, with `owners:
  [{role, path}]` naming every real artifact, `proves` naming what it demonstrates, and — once actually run —
  `verification`/`verificationSource` or a sibling `evidence.yaml`.
- Tests whose names quote the exact `fr`/`ac`/`br` id and wording they exercise, colocated with the source
  they test (`*.spec.ts` beside the implementation file, per `docs/backend-source-pattern.md`).
- `uat/<flow>/index.yaml` with `accounts.yaml` (`work/disposable-accounts`, synthetic values only), plain
  `steps`, and `proves`.
- Evidence: never hand-authored. A `done` record either gets a kernel-generated sibling `evidence.yaml` from
  an actual run, or an explicit `verificationSource: authored-claim` plus a `because:` sentence for the three
  schemas (`work/data`, `work/brand`, `work/policy-decision`) where that is legitimate by nature.

## 9. Known gaps

- **The example tree's family layout does not match `schemas/work-layout.yaml`'s documented shape.** The
  schema's `shape` block declares `businessOverview: features/<feature>/business/overview/index.yaml`,
  `businessSRS: features/<feature>/business/srs/**/index.yaml`, `architectureOverview:
  features/<feature>/architecture/overview/index.yaml`, and `architectureSDS:
  features/<feature>/architecture/sds/**/index.yaml`. The actual example tree — and the checker that gates
  it, `scripts/check-example-work.mjs`'s own `FAMILIES` set (`br, ac, fr, nfr, data, journey, decision, sds,
  ui, impl, uat, contract, integration, gap, event`) — instead places every record in a flat family folder
  directly under `features/<feature>/` (`features/task/br/...`, `features/task/sds/...`, with no
  `business/`/`architecture/` segment anywhere). Neither the schema file nor any other schema in `schemas/`
  documents this flat shape; `docs/examples/knowledge-update-delivery.md`, a separate synthetic worked
  example, uses yet a third, nested `business/`/`architecture/` layout consistent with the *schema*, not with
  the checked-in example. Three sources — the schema, one doc example, and the actual checked example plus
  its own gate script — currently describe or use two different, mutually exclusive directory shapes for the
  same concept.

- **Three `done` implementation records name source files that do not exist.** All three backend `impl`
  records currently `state: done` — `impl.login.todo-app-backend.auth`, `impl.task.todo-app-backend.list`,
  `impl.task.todo-app-backend.ownership` — name `owners[].path` values from a pre-refactor flat layout
  (`src/auth/sign-in.service.ts`, `src/auth/session.service.ts`, `src/auth/session.repository.ts`,
  `src/task/list/list.service.ts`, `src/task/ownership/ownership.guard.ts`,
  `src/task/ownership/task.repository.ts`). None of these six paths exists under
  `examples/todo-app-backend/src/`. The actual source moved to the domain-first layout
  `docs/backend-source-pattern.md` describes: `src/features/sign-in/`, `src/features/list-tasks/`,
  `src/modules/domain/task/ownership.guard.ts`, `src/modules/domain/task/task.repository.ts`. All three
  records also carry `verificationSource: kernel-observed`, and their `evidence.yaml` siblings are marked
  `stale: true` for a different reason (a record-digest mismatch against `index.yaml`'s current bytes) —
  neither the staleness check nor `scripts/check-example-work.mjs` verifies that an `owners[].path` actually
  exists on disk, so this drift is currently invisible to every automated gate in this repository.

- **A `done` implementation proves specifications that reverted to `todo`, and nothing flags it.**
  `impl.task.todo-app-backend.ownership` is `state: done` and `proves: [br.task.single-owner,
  sds.task.ownership-guard]`. Both targets are `state: todo` at `change.rev: 2` after the breaking share
  change. `scripts/check-example-work.mjs` checks that `blockedBy`/`conflictsWith`/`refs`/`appliesTo`/
  `subscribes`/`extends` targets resolve and checks blocker staleness, but it never checks a `proves` edge's
  target state, so a `done` implementation silently pointing at two `todo` specifications passes the gate
  clean.

- **The actual source code for `ownership.guard.ts` is still shaped for the withdrawn rev 1 rule, and its own
  test name quotes the withdrawn wording verbatim.**
  `examples/todo-app-backend/src/modules/domain/task/ownership.guard.ts`'s `OwnershipGuard.assert` only has
  the two transitions `br.task.single-owner` had before rev 2 (`t-owner`, `t-stranger`); there is no
  `t-collaborator` path and `TaskRepository.complete()` never calls
  `contract.share.completion-guard-for-task`'s `mayComplete` — exactly what `sds.task.ownership-guard`'s
  `blockedBy` says is still missing. Its spec,
  `examples/todo-app-backend/src/modules/domain/task/task.repository.spec.ts`, names its test
  `'br.task.single-owner: a task belongs to exactly one person, and only that person may complete or delete
  it'` — the exact sentence rev 2's `change.withdraws` retired. The test's assertions still pass (a plain
  stranger, not a collaborator, is the only case exercised), but the test's own name asserts a business rule
  that no longer exists in the record it names, and nothing in the digest/staleness machinery reads test
  source, so this drift is invisible to every check in this repository.

- **A gap's `statement` names two files; its `closedBy` names one record.** `gap.share.unbuilt-module`'s
  `statement` says both `src/share/access.service.ts` and `src/share/invitation.service.ts` do not exist, but
  `closedBy: impl.share.todo-app-backend.access` names only the implementation that would create the first
  one. `impl.share.todo-app-backend.invitations` (which would create the second) is a separate, existing
  record but is not named as a second closer. `work/gap`'s schema (per `schemas/work-layout.yaml` and
  `scripts/check-example-work.mjs`) allows exactly one `closedBy`, so a gap spanning two implementation
  records structurally cannot name both.

- **The example's backend has no top-level `README.md`; it has `COVERAGE.md` instead.**
  `examples/todo-app-backend/README.md` does not exist. `examples/todo-app-backend/COVERAGE.md` exists and
  documents component coverage and the verified journey, but it is not a getting-started README: it has no
  install or run instructions, and everything a new developer needs to run the stack is instead split across
  `.starcistacks/dev/README.md` (the runbook) and `package.json` (the scripts). A reader following "read the
  backend README" finds a coverage manifest, not onboarding instructions.

- **The `.stacks` schema and the actual directory disagree on name.** `schemas/stacks-layout.yaml` declares
  `root: <bound-source-repository>/.stacks` and every path in its `shape` block starts with `.stacks/`. The
  actual directory in both example repos and in this backend's own root is `.starcistacks/`. Every rule and
  example in `schemas/stacks-layout.yaml` is otherwise consistent with what `.starcistacks/` actually
  contains (`application-stacks.yaml`, one directory per declared environment, `secrets/<name>` +
  `secrets/<name>.enc`, `seeds/**`, a runbook `README.md`) — only the root directory name itself differs from
  what the schema states.

- **`scripts/example-evidence.mjs`, the script this brief expected for mechanically generating example
  evidence, does not exist anywhere in this base**, and no brief for it was found in
  `schemas/work-layout.yaml` or any other file searched. Every `evidence.yaml` currently in the tree was
  produced by some other means (the file headers say "Written by starci-kernel," but the mechanism that wrote
  them, if not this script, was not located).

- **Nearly every `evidence.yaml` in the tree is stale by digest mismatch, not by breaking change.** Beyond
  `br.task.single-owner`'s deliberate breaking-change story, `br.task.title.required`, `fr.task.create`,
  `sds.task.ownership-guard`, `nfr.task.list.latency`, both `impl.task.todo-app-backend.*` records,
  `uat.task.create`, and `journey.task.first-task` all carry evidence marked `stale: true` with the generic
  reason "The record's index.yaml bytes no longer match recordDigest above; something edited the record
  after this run captured it, and no fresh run has re-verified it since." This reads as an entire tree edited
  in bulk after evidence was captured, with no re-run since — the mechanism the layout is built to surface is
  working, but the example itself is currently left in the state the layout calls out as the thing to fix,
  not the state a finished reference should demonstrate at rest.

- **The frontend's `todo`-state implementation record also names pre-migration paths.**
  `impl.task.todo-app-frontend.task-list` names `app/tasks/task-list.tsx` and
  `app/tasks/create-task-form.tsx`; the actual frontend has no `app/tasks/` directory at all — routes live
  under `src/app/tasks/page.tsx`, and the actual components are `src/components/blocks/task-list/` and
  `src/features/pages/tasks/`. This record is `state: todo` (with `verificationSource: authored-claim`), so
  it does not trip the done-needs-evidence gate, but its `owners[].path` values are as stale as the three
  `done` backend records above and would mislead a developer following the record to the code.

- **This example's `ui` records have never exercised the `assets/` mechanism `interface.draw`/`uat.verify`
  are documented to use.** `ui.task.list` and `ui.share.invite` carry no `assets` and no `ui/**/assets/`
  directory exists anywhere in this tree, so section 5's description of how design drawings and UAT captures
  attach to a `ui`/`uat` node is drawn from the schema and the runtime's operation-kind documentation
  (`docs/kinds.md`), not from anything this example currently demonstrates end to end.
