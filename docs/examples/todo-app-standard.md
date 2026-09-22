# The todo-app standard

`examples/todo-app-backend` and `examples/todo-app-frontend` are the reference pair the owner will hand to
outsourced developers and to the next refactor of every StarCi skill. This document reads them as they are
on disk today, not as any spec says they should be. Every claim below names a real path or a real record id.
Section 9 lists what the example deliberately leaves open.

## 1. What this example is

Two repositories make one product. `examples/todo-app-backend` owns the canonical `.starciwork` (the Work
tree: business rules, flows, design, implementation records, UAT) and the canonical `.starcistacks` (the
deployment declaration and its environments). `examples/todo-app-frontend` owns none of either. Its own
`README.md` says this directly: "It owns no `.starciwork`: the Work records of this product live in
`todo-app-backend/.starciwork`, and the records that describe these screens name this repository by name
(`impl.task.todo-app-frontend.task-list`, `ui.task.list`)."

This pairing is one of two topologies `modules/schemas/work-layout.yaml` recognizes. In a multi-repository
product (this example), `.starciwork` lives in the bound backend repository, and
`.workspaces/projects/<project>/{be,fe}.json` at the host routes each side to its own repository and its own
`architecture.json` roots. In a monorepo, `.starciwork` lives at the repository root instead, and
`architecture.json` names `apps/*`/`packages/*` as its roots rather than a second repository. Both topologies
host the identical `features/<feature>/{...}` tree; only where `.starciwork` sits and how its roots are
declared differ. A project runs one shape or the other for one product, never both at once.

The backend is a NestJS domain-first application (`package.json` calls it "NestJS domain-first example for
the runtime's architecture checks"); the frontend is a Next.js app consuming an internal `@todo-app/grammar`
package. Both are checked by the same `node scripts/checks/architecture.mjs` gate against their own
`architecture.json`, and both are walked by the same `.starciwork` catalog for UAT and evidence.

## 2. How to read a feature

`features/task/` is the core feature: "A task a person creates, completes and deletes"
(`.starciwork/index.yaml`, catalog entry `task`). Its records live in flat family folders directly under
`features/task/` — `br/`, `fr/`, `nfr/`, `sds/`, `data/`, `decision/`,
`contract/`, `event/`, `gap/`, `ui/`, `impl/`, `uat/`, `journey/` — not under a `business/` or `architecture/`
subtree, matching the flat `shape.families` list `modules/schemas/work-layout.yaml` documents.

**`br` (business rule)** is a statement plus an id, a `module` (or list of modules) it belongs to, and a
`change` record. `br.task.title.required` says: "A task is created only with a non-empty title, trimmed of
surrounding whitespace." Its `acceptance` list carries each criterion inline — `{id, given, when, then}` —
so `ac.task.title.required.refuses-empty` reads "Given a creation request, when its title is empty or only
whitespace, then creation is refused and nothing is written." (`modules/schemas/work-layout.yaml` also
admits criteria as nested `br/<rule>/ac/<name>/` records; this example keeps them inline.)

**`fr` (functional requirement)** composes rules into a flow. `fr.task.complete` names its actors
(`[owner, collaborator]`), its trigger, its main and exception flows, and a `composes` list:
`{rule: br.task.single-owner, module: src/modules/bussiness/task}`, `{rule: br.task.complete.once, ...}`,
`{rule: br.share.role.permissions, module: src/modules/bussiness/share}` — one entry per rule the flow
relies on, each naming the module that implements it.

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

**`gap`** is a named absence, not restated prose. `gap.task.no-load-harness`'s `statement` names the exact
missing thing — no k6 run has ever been captured for `nfr.task.list.latency` — and `closedBy` names the
record that will close it. A closed gap stays in the tree as history: `gap.share.unbuilt-module` is
`state: done`, closed by `[impl.share.todo-app-backend.access, impl.share.todo-app-backend.invitations]`,
its `because` recording which half remains another lane's `todo` record.

**`ui`** names screen states and the brand revision it was built against. `ui.task.list`'s `states` are
`{name, trigger, behavior}` entries (`list`, `empty`, `one-task`, `many-tasks`, `refused`) and `brand:
{rev: 3}`.

**`impl` (owners)** names real files by role, plural, because one screen or flow can span more than one
artifact. `impl.task.todo-app-backend.ownership`'s `owners: [{role: module, path:
src/modules/bussiness/task}]`, a `revision` (a git commit), and `proves: [sds.task.ownership-guard]` — it
deliberately does not prove `br.task.single-owner` while that rule is still `todo`, because the gate refuses
a `done` record whose `proves` target is not done.

**`uat`** is a walked flow with disposable accounts. `uat.task.create`'s `accounts: accounts.yaml` (two
disposable role/username/password triples), plain-English `steps`, and `proves: [fr.task.create]` — narrowed
because `br.task.single-owner` was observed in the walk but is still `todo`, and a `done` record may not
claim to prove one that is not.

A `journey` family also exists, crossing features: `journey.task.first-task` crosses `[login, task]` and
requires both `fr.login.sign-in` and `fr.task.create`.

## 3. The three states and what each proves

**`done`, proven with evidence.** `impl.task.todo-app-backend.list` is `state: done` and `proves:
[br.task.list.owned]`. Its sibling `features/task/impl/todo-app-backend/list/evidence.yaml` is generated, not
authored by hand: `scripts/example/example-evidence.mjs` writes it by actually running the assertion
commands below against `--cwd`, and stamps that in its header. It carries a `recordDigest` (a sha256 of the record's own `index.yaml` bytes),
a `codeDigest` (per-file sha256 over the record's `owners` paths), an `outcome`, per-assertion
`command`/`exit`/`outcome` rows (`npx jest src/modules/bussiness/task/list-tasks.handler.spec.ts`, `exit: 0`),
and `provenance` naming the actor. A run is replayable in the sense that its command, its environment and its
observed result are all named — someone can rerun the assertion and compare.

**`stale`, and what a developer does next.** `br.task.single-owner` is `state: todo`. The breaking change
landed at `change.rev: 2` (the share feature split "only the owner may complete" into owner-plus-accepted-
editor); the current block is rev 5, `kind: editorial`, whose `retains` list keeps all three statements
verbatim while the `reason` records where the remaining wait now lives:

```yaml
blockedBy:
  - {record: gap.task.single-owner-editor-arm, because: "The rule's own evidence.yaml is stale: true over
     exactly this absence — its one captured run proves the delete half and the stranger negatives but never
     exercises the accepted-editor complete arm ..."}
```

The record's own `evidence.yaml` — history, not deleted — carries `stale: true` with
`staleSince: {record: br.task.single-owner, rev: 2}` and explains exactly what still holds and what does
not: the delete half and the stranger negatives are proven; the accepted-editor complete arm is not, because
`contract.share.completion-guard-for-task`'s provider/consumer proof is still `todo`. The edge graph now
roots that wait in one place: `gap.task.single-owner-editor-arm` (a terminal gap cannot cycle), and
`fr.task.complete`, `fr.task.delete`, `contract.share.completion-guard-for-task` and
`journey.notify.told-about-completion` all stay `todo` behind it; `gap.task.share-edge-hold` is the
mechanical sentinel that refuses the flip until the captured run exists. `sds.task.ownership-guard` has
already re-earned `done` against the new wording.

What a developer does next is written into the gap itself: prove the accepted-editor arm through
`contract.share.completion-guard-for-task`, then re-run the rule's assertions — never edit the stale
evidence's digest to make it match, since "staleness is never cleared by editing `recordDigest` to match -
only a fresh run... clears it" (`modules/schemas/work-layout.yaml`).

A `done` record with no sibling `evidence.yaml` and no `verificationSource: authored-claim` is refused by the
gate. `scripts/checks/check-example-work.mjs` enforces exactly this: "state is done with no sibling evidence.yaml
and no verificationSource: authored-claim + because."

**`todo` by design.** `features/share/` is specified and mostly `done` — what remains `todo` there is proof,
not design: `contract.share.completion-guard-for-task`, `journey.share.collaborate-on-a-task` and
`nfr.share.revoke.read-latency` wait on the gaps that name the missing proof (`gap.share.live-proof`,
`gap.share.load-proof`). A second `todo` shape is a missing measurement rather than missing code:
`nfr.task.list.latency` stays `todo` on `requiresProof.measurement` — the load run that would prove it is
named by `gap.task.no-load-harness`.

## 4. The questions the tree answers without reading source

| Question | Field or derived file that answers it |
| --- | --- |
| What is left to build in this feature? | Every record's `state: todo`, filtered to that feature's directory |
| Why is this specific thing todo? | Its `blockedBy[].because`, or a `gap` record it cites via `closedBy`/`blockedBy` |
| What proof exists that a `done` record actually works? | Its sibling `evidence.yaml` — `outcome`, `assertions[].observation`, `provenance` |
| Is that proof still trustworthy? | `evidence.yaml`'s `stale` flag and `staleReason`/`staleSince` |
| What breaks if I change X? | `X`'s inbound edges: other records' `refs`, `dependsOn`, `blockedBy`, `appliesTo`, `subscribes`, `composes` naming X, each carrying the digest of the slice it bound |
| Which rules conflict? | `conflictsWith` (pairwise) or a `work/policy-decision@1`'s `tension.records` (three or more, jointly unsatisfiable) |
| Which decisions are still open? | `work/policy-decision@1` records with `outcome: open` |
| What does the frontend need to build for this feature? | `impl.<feature>.todo-app-frontend.<name>` records and the `ui.<feature>.<screen>` they `prove` |
| What real files implement a rule? | The `br`'s `module` field, and the `impl` record whose `proves` names that rule, whose `owners[].path` names the files |
| What external systems does this feature depend on? | `extensions.work3.integrations` on the owning SRS/SDS record, resolved to one `integration.<feature>.<id>` node each |
| Has this feature's UAT ever actually been walked? | `uat.<feature>.<flow>`'s `state` and its `evidence.yaml`; `state: todo` with no evidence means never |

## 5. From record to code

**Owners and modules name real files.** A `work/business-rule@1`'s `module` is a plain string or list of
strings naming the source path(s) that carry it — `br.task.complete.once`'s `module:
[src/modules/bussiness/task]`. A
`work/implementation@1`'s `owners` is a list of `{role, path}` pairs, one entry per real artifact a screen or
flow spans — never a single `directory`/`files` pair, which `scripts/checks/check-example-work.mjs` refuses outright
("work/implementation@1 carries directory/files/targetFiles; use owners: [{role, path}] instead").

**Test names quote acceptance criteria and business rules verbatim.** In
`examples/todo-app-backend/src/modules/bussiness/task/create-task.handler.spec.ts`:

```ts
it('fr.task.create: the task is created, owned by the submitter, not complete', async () => { ... });
it('ac.task.title.required.refuses-empty: an empty or whitespace-only title is refused and nothing is written', async () => { ... });
```

A reader can hold the Work record beside the test file and match them by the quoted id and wording, with no
separate traceability document.

**Evidence is generated or captured by a run, never hand-edited into a pass.** Implementation records carry
sibling `evidence.yaml` files written by `scripts/example/example-evidence.mjs`, which runs each
assertion command against `--cwd` and stamps that in the header; UAT flows
carry evidence that names the real `runs/<runId>` directory the Playwright harness produced. Each file's
`recordDigest` is a sha256 over the sibling `index.yaml`'s exact bytes — the same digest
`scripts/checks/check-example-work.mjs` recomputes to refuse a mismatched, non-stale evidence file.

**`interface.draw` and `uat.verify` attach to `ui` and `uat` through assets, not prose.** Per
`modules/schemas/work-layout.yaml`'s `moduleUI` and `nodeAssets` shapes, retained design drawings and real
running-page screenshots both live under the owning node's `assets/**`, in original formats, distinguishing
generated design from real capture and naming the actual capture environment — `ui.task.list` and
`ui.share.invite` both carry `assets/` directories on disk.

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
| `node scripts/checks/check-example-yaml.mjs examples` | Any `.yaml`/`.yml` under `examples` the runtime's own strict loader cannot parse — a permissive parser accepting silently-invented keys is exactly the bug this gate exists to catch |
| `node scripts/checks/check-example-work.mjs` | An id that doesn't match its directory place; a `ref`/`blockedBy`/`conflictsWith`/`appliesTo`/`subscribes`/`extends` pointing at an id nothing owns; a stale `blockedBy` (target already `done` at or past the cited rev); `blockedBy` authored as prose instead of `{record, rev?, because}`; a `work/gap@1` missing `state`/`statement`; a `work/policy-decision@1` with an invented `outcome` or a `chosen` not in `options`, or a `targetModule`; an unclosed `change.kind`; a `done` record with no evidence and no authored-claim declaration; `appliesTo` on the wrong schema or pointing nowhere; a malformed `work/event@1` or a `subscribes`/`extends` pointing at the wrong schema; `work/implementation@1` using `directory`/`files` instead of `owners`; and an `evidence.yaml` whose `recordDigest` no longer matches its sibling's current bytes without `stale: true` |
| `node scripts/checks/architecture.mjs <repo-root> [--config architecture.json]` | Backend/frontend dependency direction crossing a resolved responsibility boundary (app→feature→module, component/hook/module tiers), thin-app violations, undeclared package exports, unresolved internal imports (errors, not violations) |
| `node scripts/checks/check-stales.mjs --work <work-root> --repo <id>=<git-root>` | Nothing on its own — it is a read-only freshness *report* comparing canonical Work against bound source evidence; it does not repair or gate by itself |
| `npm test` (backend, jest) / `npm run test:unit` (frontend, vitest) | Any spec whose assertions do not hold against current source |
| `npm run typecheck` (frontend, `tsc --noEmit`) | Any type error across the checked TypeScript program |

## 8. What a new feature must add

Read from `features/share/` — fully specified, with its remaining `todo` records waiting on proof rather
than design:

- A feature entry in the catalog: `features/index.yaml`'s `features[]` list (`{id, directory, description}`).
- A `features/<feature>/index.yaml` with `schema: work/feature@1`, a title and a description.
- One `br/<name>/index.yaml` per rule, each with `statements`, `acceptance`, a `module`, and a
  `change: {rev: 1, kind: initial, at}`. This example authors criteria inline in `acceptance`; the schema
  also permits nested `ac/<name>/index.yaml` sub-records under the `br/` when a team wants them separate.
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
- `uat/<flow>/index.yaml` with `accounts.yaml` (`work/disposable-accounts@1`, synthetic values only), plain
  `steps`, and `proves`.
- Evidence: generated or captured by a real run, never hand-edited into a pass. A `done` record either gets a
  sibling `evidence.yaml` produced by an actual run (`scripts/example/example-evidence.mjs` for
  implementation assertions; a `runs/<runId>` harness capture for UAT), or an explicit
  `verificationSource: authored-claim` plus a `because:` sentence for the schemas where that is legitimate by
  nature.

## 9. What this example deliberately leaves open

This example is maintained as a demonstration, so a few things are intentionally left in a non-`done` state
rather than papered over:

- **The accepted-editor arm of `br.task.single-owner` is still unproven.** Its `evidence.yaml` remains
  `stale: true` by design (section 3): the delete half and stranger negatives are proven, the
  accepted-editor completion arm is not. `gap.task.single-owner-editor-arm` names the exact missing proof
  and `gap.task.share-edge-hold` is the mechanical sentinel keeping dependent records honest. This is the
  example's worked demonstration of the `change`/`stale`/`blockedBy`/`gap` machinery — it exists to be read,
  not to be closed quietly.

- **A load run for `nfr.task.list.latency` has never been captured.** `gap.task.no-load-harness` names the
  absence directly; the NFR stays `todo` on `requiresProof.measurement`.

- **Record bodies keep authored historical notes.** Some records carry comments naming earlier path or
  revision states (for example `impl.task.todo-app-frontend.task-list` explains why its `owners` paths are
  written the way they are). These are provenance inside the record, not live claims about the current
  tree — `owners[].path` and `evidence.yaml` are the fields the gates check, and both name current paths.
