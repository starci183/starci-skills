# Lane v7-3 — FE impl owner paths + resource naming (Phase 1)

Date: 2026-09-19. Trees: `examples/todo-app-backend/.starciwork` (+ sibling `todo-app-frontend`) and
`examples/ecommerce-app-be/.starciwork` (+ sibling `ecommerce-app-fe`).

**Scope honored.** Writes went only to `impl/<fe-app>/**/index.yaml` (7 files, todo tree) and
`_resources/**/resource.yaml` (2 files, todo tree). No `evidence.yaml`, no `ui/`, no `uat/`, no
`_derived/`, no product source, no ecommerce records. Read/write helpers and gate logs live in
`ex-testing/lint/scratch/v7-3-*`. Verified against the index rather than asserted: `git diff -U0` over
the todo tree shows 39 changed records (the other Phase-1 lanes' `fr`/`event`/`gap`/`journey`/`nfr`/
`uat` work is in this working tree too), and of my 9 files every changed line is either a comment I
added or the `role: route` owner entry being replaced — 6-8 lines per file, nothing else
(`ex-testing/lint/scratch/v7-3-all.diff`).

**Gates/tools run:** `scripts/check-example-work.mjs` (before and after, exit recorded via marker
file — both nonzero), `node --test tests/example-work-gate.spec.mjs tests/example-evidence.spec.mjs
tests/example-derive.spec.mjs` → **46 pass, 0 fail**. Ownership resolution was exercised through the
gate's own library (`scripts/example-ownership.mjs`: `resolveOwnedDirs`/`missingOwnedDirs`/
`hashOwnedDirs`) rather than an `ls` approximation, so the numbers below are what the gate computes.

---

## 1. `[lang]` route ownership — target class fully cleared

Every `owners[].path` in all 7 todo frontend impl records was checked against disk, then corrected.
The whole FE app's page routes sit under the `next-intl` locale segment (`src/app/[lang]/`,
locales `en|vi`, `src/i18n/config.ts:19`; unknown locale → `notFound()`, `src/app/[lang]/layout.tsx:58`),
and none of the authored route paths carried it.

| record | state | owner path as authored | corrected to |
|---|---|---|---|
| `impl.task.todo-app-frontend.task-list` | done | `src/app/tasks` | `src/app/[lang]/tasks` |
| `impl.notify.todo-app-frontend.preferences` | done | `src/app/notify` | `src/app/[lang]/notify` |
| `impl.plan.todo-app-frontend.usage` | done | `src/app/plan` | `src/app/[lang]/plan` |
| `impl.recur.todo-app-frontend.schedule` | done | `src/app/recur` | `src/app/[lang]/recur` |
| `impl.share.todo-app-frontend.invite-screen` | done | `src/app/tasks/[taskId]/share` | `src/app/[lang]/tasks/[taskId]/share` |
| `impl.audit.todo-app-frontend.privacy` | todo | `src/app/audit` | `src/app/[lang]/audit` |
| `impl.login.todo-app-frontend.sign-in` | done | `src/app/sign-in` only | **added** `src/app/[lang]/sign-in` (kept the existing entry) |

Non-route owners (components/blocks/features/hooks/api dirs) were verified and **all already
resolved** — the defect was confined to the `role: route` entries. Claimed *extent* is unchanged in
every case: only the missing locale segment was inserted, so a record that owned a parent route dir
still owns that same parent (e.g. `notify` still covers both `preferences/` and `unsubscribe/`, which
its own rev-1 reason says it implements).

### 1a. What the missing paths were actually doing to the proof (the finding this lane did not expect)

`OWNER_PATH_MISSING` reads like a cosmetic path complaint. It is not. `hashOwnedDirs`
(`scripts/example-ownership.mjs:124`) walks **only directories that exist** (`if (!fs.existsSync(abs)) continue`),
and because every one of these records also owned sibling directories that *do* exist, the digest was
computed and returned a plausible hash — silently excluding the entire route directory the record
claims to be the implementation of. All 7 fresh digests move after the fix; **11 route files enter
the proof, 0 leave it**:

```
impl.task.todo-app-frontend.task-list               9 -> 11 files   digest 369b1353227b -> 6071787d0776
impl.notify.todo-app-frontend.preferences           8 -> 10 files   digest 880792f880ae -> 2a71bdb3e799
impl.plan.todo-app-frontend.usage                   7 ->  9 files   digest 83282dc9032d -> a59ae80d32fb
impl.recur.todo-app-frontend.schedule               9 -> 11 files   digest 931ba0bdd8df -> 6f18373c15c9
impl.share.todo-app-frontend.invite-screen         25 -> 26 files   digest b215c7df7585 -> f7ab343e2ed2
impl.audit.todo-app-frontend.privacy                5 ->  6 files   digest 70f2b3450379 -> 08c1ad7c7fa6
impl.login.todo-app-frontend.sign-in                7 ->  8 files   digest e885d9d5d7ab -> c69bdba9404f
```

Reproducer: `ex-testing/lint/scratch/v7-3-coverage-diff.mjs`. So for every `done` FE impl in this
tree, `evidence.yaml`'s `codeDigest` bound the block/feature/hook code and **never** bound
`page.tsx` — the proof covered everything about the screen except the route the record exists to own.
Nothing in the tree's refusal surface distinguished that from a complete digest. This is the same
silent-hazard shape as the realm probe in §3, reached from the other direction: §3 is a target that
answers when it should not; this is a measurement that goes quiet when it should fail.

Newly-covered files (`v7-3-coverage-diff.mjs` output), for the record: `src/app/[lang]/tasks/page.tsx`,
`src/app/[lang]/tasks/[taskId]/share/page.tsx`, `src/app/[lang]/notify/{preferences,unsubscribe}/page.tsx`,
`src/app/[lang]/plan/page.tsx`, `src/app/[lang]/plan/usage/page.tsx`, `src/app/[lang]/recur/page.tsx`,
`src/app/[lang]/recur/recur.css`, `src/app/[lang]/audit/privacy/page.tsx`, `src/app/[lang]/sign-in/page.tsx`.

### 1b. `impl.login.todo-app-frontend.sign-in` — the case an existence check cannot catch

This was the only FE route whose authored path *existed*, so it produced **no** refusal in either
tree while still naming the wrong directory. `src/app/sign-in/` contains exactly one file,
`turtle-master.png/route.ts` — the mascot bytes route handler. The screen this record captures in
four states is `src/app/[lang]/sign-in/page.tsx`. `OWNER_PATH_MISSING` is a `fs.existsSync` test
(`example-ownership.mjs:92`), so a path that resolves to *something adjacent* passes it forever. Fixed
by adding the page directory and keeping the media handler (both are genuinely this impl's code —
the record's own rev-2 reason credits `MediaFrame over the brand turtle master's own bytes served by
the turtle-master.png route handler`). Flagged in a comment in the record, since it is the class of
defect the gate is structurally blind to, not a one-off typo.

### 1c. Ecommerce sweep — nothing owned to fix, and that is itself the finding

`ecommerce-app-fe` is declared `role: fe` in `examples/ecommerce-app-be/.starciwork/workspace.yaml`
and has real routes — `apps/shop/src/app/[lang]/{account,browse,cart,checkout}/page.tsx` plus a second
app at `apps/landing/src/app/[lang]/page.tsx`. It has **zero `work/implementation` records**: the tree
holds 2 impl records, both `repository: ecommerce-app-be`. Measured in
`ex-testing/lint/scratch/v7-3-owned-paths.txt`. Consequences to route elsewhere, not fixed here:

- `IMPL_BEFORE_DIRECTION` cannot fire for a feature that authors no FE impl, and
  trust-concept-9's render-proof rule walks `work/implementation` records only — so the whole
  ecommerce frontend reaches `done` status on the backend's records without ever owning a line of FE
  code. The todo tree's 7 FE records are the only place this discipline is demonstrated.
- The `[lang]` drift already reached the ecommerce `ui/**` records' FE path claims, and further:
  **10 of the 13 distinct FE paths named in `features/*/ui/*/index.yaml` do not exist.** Verified with
  `fs.existsSync` from `examples/`: absent are `apps/shop/src/app/{account,checkout,cart,browse,layout,page}.tsx`
  (all missing the `[lang]` segment) and `apps/shop/src/components/{AppNav,ProductTile}.tsx`,
  `apps/landing/src/{app/page.tsx,components/SiteHeader.tsx}`. The last four are not a `[lang]`
  problem — those components no longer exist under any name; the FE now composes
  `apps/shop/src/components/layouts/ShopLayout/` + `pages/<Page>/{component,index}.tsx` and
  `apps/landing/src/components/layouts/SiteLayout/`. Present: `apps/shop/src/modules/api/identity.ts`,
  `apps/landing/src/data/catalog.ts`, `apps/landing/src/modules/config/index.ts`.
  Also note the ecommerce FE repo root is `apps/shop/` — a BE-relative `src/app/...` path is wrong
  here even after inserting `[lang]`, unlike todo where `src/` *is* the repo root. → v7-14 (mechanical
  `inputRefs` sweep) and v7-10 (ec render), with the above as the target list.

## 2. `repository` field consistency — frontend clean, backend disagrees, host routing absent

Measured, not inferred (`v7-3-owned-paths.mjs`, and a dir-vs-field census over every
`work/implementation`):

- **FE side (my scope): consistent.** All 7 todo FE records carry `repository: todo-app-frontend`,
  their directories are `impl/todo-app-frontend/`, and `workspace.yaml` declares
  `{role: fe, name: todo-app-frontend}`. 0 mismatches. `repoRootFor` resolves that to
  `examples/todo-app-frontend`, which is where the routes in §1 were verified.
- **BE side (out of my write scope): 17 mismatches.** Every `work/implementation` under
  `impl/todo-app-backend/` (17 records) carries `repository: todo-app`, because
  `todo-app-backend/.starciwork/workspace.yaml` declares `{role: be, name: todo-app}` while the
  repository directory is `todo-app-backend`. The *directory and the id agree with each other*
  (`impl.audit.todo-app-backend.log` in `features/audit/impl/todo-app-backend/log/`); the
  `repository:` field is the odd one out — so this is a 2-of-3 disagreement, not the "three-way"
  spread v6-3 §12 describes. `work-layout.yaml`'s `impl` entry says the directory is "the exact value
  the record's own `repository` field names"; it does not.
- **Why I did not fix it, though §2 says "fix record-side":** the single change that satisfies the
  layout rule, `workspace.yaml`'s be `name:`, is not an impl record and not `_resources/**` — it is the
  workspace document, which v7-1/v7-2/v7-5 all hold and none of them claim. Editing 17 BE `index.yaml`
  files to say `todo-app-backend` instead would collide with `repoRootFor`, which returns the backend
  root for `role: 'be'` *whatever* the name is — so a field-only fix changes nothing mechanically while
  leaving the field contradicting the workspace document it is supposed to name. Resolution is
  unaffected either way: `repoRootFor` (`example-ownership.mjs:43`) never consults the be name.
  This is a one-line decision for the workspace owner; recorded, not guessed at.
- **Ecommerce is the counter-example that proves the drift is avoidable:** its workspace declares
  `{role: be, name: ecommerce-app-be}` matching its directory, and its 2 impl records show
  **0 mismatches**. The todo mismatch is todo-specific.
- **`.workspaces` binding does not cover either example.** `AGENTS.md` routes a project through
  `.workspaces/projects/<project>/work.json` (`pathFromSource` per role). That directory exists and
  contains exactly one project, `nivo`. There is **no `todo-app` or `ecommerce-app` entry**, and
  `.claude/.workspaces` does not exist at all. So for these two examples the repository→directory
  binding lives *only* in `.starciwork/workspace.yaml` plus the sibling-directory coincidence
  `repoRootFor` hardcodes — the routing layer the host bootstrap describes is not in play here. v6-4
  FM1 called this "a sibling-directory coincidence"; it is still one, and the `apps/shop/` prefix in
  §1c is where that coincidence would bite next (an FE repo whose code is not at `<sibling>/src/**`
  hashes nothing and says nothing is wrong).
- `_resources/**` (also mine) carries `owner: todo-app-backend` on all three resources — the directory
  name, not the workspace `name:`. Same family of ambiguity as above, and left alone for the same
  reason: no check reads it, and half-fixing a naming question I have scoped out is how this tree got
  its stale rev pins.

## 3. Realm naming — fixed to code, with the hazard spelled out

Code is truth, and it is unanimous: `.starcistacks/dev/infra/compose/realm-todo.json:2` declares
`"realm": "todo"`, mounted by `keycloak.yaml:16` under `start-dev --import-realm` (line 4);
`src/modules/platform/config/app-config.service.ts:9` defaults the token URL to
`http://localhost:8089/realms/todo/protocol/openid-connect/token` (asserted at
`app-config.service.spec.ts:73`); `src/tests/infra/platform/stack/e2e-stack.service.ts:37` sets
`const REALM = "todo"` and polls `/realms/${REALM}` for readiness (line 384);
`e2e-auth.service.ts` admin calls hit `/admin/realms/todo/users`; the dev stack README verifies with
`curl -fsS http://localhost:8089/realms/todo`; and `features/login/integration/keycloak/index.yaml`
already names `/realms/todo/...`. Two files in `_resources/` said `todo-app`. Changed:

- `_resources/identities/todo-app-demo/resource.yaml` — `custody.realm: todo-app` → `todo`.
- `_resources/environments/dev/resource.yaml` — probe `keycloak-realm-ready` target
  `http://localhost:8089/realms/todo-app` → `/realms/todo`; `allowedEffects` "…under the todo-app
  realm" → "under the todo realm".
- `todo-app-seed` needed no change; its `schemaFiles`/`seedFiles` were verified to exist
  (`.starcistacks/dev/seeds/{01-schema,02-tasks}.sql`).

**The hazard, as the brief asked me to note it.** `expect: 200` is the whole assertion, and Keycloak
answers 200 for *whatever realm exists* and 404 for one that does not. So today the authored probe
could never go green on a healthy stack — a UAT flow gated on `environment.todo-app.dev` fails while
everything about the stack is fine, which is loud, and loud is cheap. The expensive version arrives
when both names exist: the moment a realm called `todo-app` is imported beside `todo` (or the probe's
target is loosened to a host root, or the `identity` custody and the environment probe keep naming
*different* realms — which is exactly the state I found), a probe that keeps returning 200 certifies
readiness against a realm no code talks to, and every `accounts`/`environment` ref that resolves
through this file inherits the lie. One name, taken from the import file, is the only fix; a comment in
the environment record now says so where the next reader will trip.

**Not changed: the ids.** `identity.todo-app.demo`, `environment.todo-app.dev`, `fixture.todo-app.seed`
still embed `todo-app`, which is the *project* name (`workspace.yaml project: todo-app`), not the
realm — and `work-layout.yaml`'s own example block (`:500`) authors these exact directory names.
Renaming an id rewrites every inbound `environment:`/`fixtures:`/`accounts[].identity` ref from the
`uat/**` records, which are not mine this phase; a comment in the identity record states that an id
segment is not a realm claim so the coincidence does not get "corrected" the wrong way later.

### 3a. Second defect found in the same owned file (fixed)

`_resources/environments/dev/resource.yaml` declared `target.compose: infra/compose/compose.yaml`.
That path resolves to nothing — `todo-app-backend/infra/` does not exist. The file is
`.starcistacks/dev/infra/compose/compose.yaml` (verified), whose fragments are the source of every
port and origin this resource lists: `api.yaml` `3001:3001`, `keycloak.yaml` `8089:8089` +
`KC_HTTP_PORT: "8089"`, `web.yaml` `3000:3000`, `postgres.yaml` `5432`, `redis.yaml` `6379`,
`minio.yaml` `9000`, `prometheus.yaml` `9090` — all 7 origins/ports in the record check out against
them. Corrected to the real path with a comment. No gate rule reads `target.compose`, so this is
invisible to `check-example-work.mjs` — it is exactly the "a `done` contract whose wire path is wrong
on both ends" pattern from v6-3 §2, in a resource custody record instead.

## 4. Absolute paths in owned files — zero, verified rather than assumed

Census over both `.starciwork` trees, excluding `_derived/` (a rebuilt artifact, v7-8):
`ex-testing/lint/scratch/v7-3-abs-paths.mjs` counts `[A-Za-z]:[\/\\]Users[\/\\]` per family:

```
todo-app-backend: 81 occurrences — 77 under features/*/ui/**, 4 under brand/, 0 under features/*/impl/**
ecommerce-app-be:  0 occurrences
_resources/**:     0 in both trees  <- v7-3 owned scope
```

**Nothing leaked into my owned files, so nothing was normalized.** The `C:/Users/Hi/orca/workspaces/…`
strings remain where v6-4 §Q6 left them — in `ui/**` records' `inputRefs`/`inspectedPath`
(`path: C:/Users/Hi/orca/workspaces/.claude/ex-draw-v3/examples/todo-app-frontend/node_modules/@starci/grammar/…`)
and in `brand/index.yaml:259-276` (`inspectionRoot`, `resolvedPath`) — plus prompt/markdown payloads
under `ui/*/assets/`. That is v7-14's mechanical sweep and v7-9's re-capture surface. Two notes for
whoever takes it: `brand/index.yaml`'s `resolvedPath` also pins a **`node_modules` path** as a
version claim, and the prompts under `assets/` quote an `ex-lint` worktree path as the source of
`knowledge/ui/proof/anatomy-source.yaml` "because this checkout lacks that file" — normalizing those
to repo-relative would make them point at a file that is not in the repo, so the honest fix there is
to carry the bytes (as `assets/anatomy-source.accepted.yaml.txt` already does) and drop the machine
path, which is a judgment call, not a sed.

---

## Gate verification and count delta

**The tree total moved 134 → 154 refused while I worked, and none of the +20 is mine.** Phase-1 lanes
run concurrently: the same two runs went `295 → 311 records`, `2518 → 2505 refs`,
`114 → 115 evidence` — new `fr`/`ac` records and removed `provenBy` blocks, i.e. v7-1/v7-2/v7-4
writing their scopes. Any before/after total on this tree is contaminated by them; the honest number
is the delta restricted to my owned files:

| class, my owned files only | baseline | after | delta |
|---|---|---|---|
| `REFUSED OWNER_PATH_MISSING` | 5 | **0** | **−5** |
| `WARN OWNER_PATH_MISSING` | 1 | **0** | **−1** |
| `REFUSED RECORD_DIGEST_STALE` | 2 | 7 | **+5** |
| `REFUSED CODE_DIGEST_STALE` | 7 | 7 | 0 |
| `REFUSED RENDER_CHECK_FAILED` | 53 | 53 | 0 |
| owned problem lines, total | 68 | 67 | **−1** |

Per record, from `ex-testing/lint/scratch/v7-3-per-record.mjs`:

| record | OWNER_PATH | RECORD_DIGEST | CODE_DIGEST | RENDER |
|---|---|---|---|---|
| task-list | 1→0 | 0→1 | 1→1 | — |
| preferences | 1→0 | 1→1 *(pre-existing)* | 1→1 | 14→14 |
| usage | 1→0 | 0→1 | 1→1 | 11→11 |
| schedule | 1→0 | 0→1 | 1→1 | 10→10 |
| invite-screen | 1→0 | 0→1 | 1→1 | 10→10 |
| privacy | 1→0 (warn) | 0→1 | 1→1 | — |
| sign-in | 0→0 | 1→1 *(pre-existing)* | 1→1 | 8→8 |

Tree-wide, the final run prints **zero `OWNER_PATH_MISSING` lines** — refused or warned, in either
tree. The class this lane was sent to clear is gone from the whole gate output, not just from my files.

**The +5 is mine, and I am not dressing it down.** `recordDigest` is sha256 of the sibling
`index.yaml`'s bytes (`check-example-work.mjs:50`), and this lane's hard rule forbids touching
`evidence.yaml`, so correcting a record mechanically refuses its own proof. It is the model working as
documented (v6-4 §Q1: "a record edit stales only its own evidence") and the fleet's designed handoff —
v7-4's brief says plainly "Your fixes change index.yaml digests — that's expected; evidence lanes run
after you," and v7-6/v7-7 both *wait for `done/v7-3.done`* precisely to re-bind these digests. I did
not mark anything `stale: true`, did not edit an evidence file, and did not recast a digest. Two of
the seven records (`preferences`, `sign-in`) already had a `recordDigest` mismatch *before* I touched
them — their `index.yaml` had been edited after their evidence was bound by an earlier lane; that
pre-existing drift is reported as found, not as my doing.

Both gate runs exited **nonzero** (`GATE_NONZERO` markers), as they must — 154 refusals remain in the
tree, mostly in scopes I do not own.

## What I could NOT prove, and why

1. **Any of the 7 records' proof is not re-established by this lane.** `codeDigest` still mismatches
   for all 7 and `recordDigest` for all 7. Correcting an owner path cannot make its evidence fresh —
   it changes which bytes the digest *should* cover. Re-running the assertions is v7-6's job. The
   `done` states on 6 of these records therefore still rest on stale proof in this snapshot.
2. **Whether the corrected route code passes the render/brand checks.** Out of scope and out of my
   reach: the 53 `RENDER_CHECK_FAILED` lines on these records (`palette-off-brand` deltaE failures +
   `no DNA snapshot for grammar family common` on this host) are `assets/**` and v7-9's, unchanged by
   me — my edits touched no capture, no `assets:` entry, no brand file.
3. **`impl.audit.todo-app-frontend.privacy`'s `done` status.** Left `todo` behind
   `gap.audit.render-proof` as the render lane set it; §1 fixed only its path. It cannot be promoted
   by this lane, and I did not try.
4. **The realm probe was not executed.** `http://localhost:8089/realms/todo` was matched to the
   import file, the compose config, the app default, the e2e stack, the integration record and the
   stack README's own verify command — six agreeing sources on disk. It was **not** proven by a live
   Keycloak, because the dev stack is not running in this session and booting it (docker, realm
   import) is outside a records lane. If it comes up and 404s, the import file lies, not my edit.
5. **No change `rev` bump was authored on the 7 records** — deliberate, and disclosed rather than
   hidden. `owners` is *not* in `checks/work-change.mjs`'s `PROSE`/`LIFECYCLE` exclusion sets
   (`:44-51`), so its classifier computes a non-additive owners edit as **`breaking`**, which would
   additionally demand `stale: true` + `staleReason` on the evidence — a write this lane is forbidden
   to make. The corpus's own precedent for this exact edit goes the other way: the
   `apps/*`→`src/*` correction left the two ecommerce impl records with no `change` block at all, and
   `impl.recur.todo-app-frontend.schedule` recorded an owners correction as `kind: clarifying` at rev 2.
   I matched the precedent (comment at the corrected field + this report), not the classifier, because
   `work-change` is provably inert on these trees (v6-4 §Q4: it reads an inline `evidence:` block that
   no example record has). If the fleet wants these path corrections carried as machine-visible
   revisions, that is a one-line-per-record follow-up — say so and it is a 7-edit pass, but declaring
   `breaking` here would be asserting an expiry step I am not permitted to complete.
6. **The ecommerce FE route question could not be "fixed" at all**, only reported: there is no
   `impl/ecommerce-app-fe/**` record in either directory layout or `_derived`. Authoring FE impl
   records for a repo I cannot prove (no captures, no direction assets, no `ui/` records of its own)
   would manufacture exactly the false `done` this whole exercise exists to remove. Left absent,
   named in §1c.

## Remaining gate refusals observed in my owned scope (verbatim, final run)

Saved complete at `ex-testing/lint/scratch/v7-3-owned-refusals.txt` (7 `recordDigest` + 7 `codeDigest`
lines). Two representative pairs:

```
REFUSED examples/todo-app-backend/.starciwork/features/task/impl/todo-app-frontend/task-list/evidence.yaml: recordDigest b7ba7d761ea17200b93354d384a32b7e56767130a2619a7b938c4a1e0524d7a4 no longer matches impl.task.todo-app-frontend.task-list's current digest 9b6231af74f316daca4fd557fc887800484527012e9c3af5a0d62ca2acd94248; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/audit/impl/todo-app-frontend/privacy/evidence.yaml: codeDigest 8792590c4657352592a1a415b04735887059083949868c6b7363f453993b7019 no longer matches the code currently under impl.audit.todo-app-frontend.privacy's owners/module (now 08c1ad7c7fa6…); refused unless it carries stale: true [CODE_DIGEST_STALE]
```

and, for the record, what the class I removed looked like before:

```
REFUSED examples/todo-app-backend/.starciwork/features/plan/impl/todo-app-frontend/usage/index.yaml: owners/module names a directory that does not exist on disk: src/app/plan [OWNER_PATH_MISSING]
WARN examples/todo-app-backend/.starciwork/features/audit/impl/todo-app-frontend/privacy/index.yaml: owners/module names a directory that does not exist on disk: src/app/audit [OWNER_PATH_MISSING]
```

The 53 `RENDER_CHECK_FAILED` lines in my owned scope are byte-identical before and after (verified
counted per record in the table above); quoting one in full would be quoting v6-3 §1 verbatim, which
already does.

## Record ↔ code contradictions this lane had to leave

1. **Three records assert a correction that had not happened.**
   `impl.plan.todo-app-frontend.usage` rev 3: "Owners are the real directories now";
   `impl.recur.todo-app-frontend.schedule` rev 2: "corrected owners to the module-root directories
   that exist"; `impl.audit.todo-app-frontend.privacy` rev 1 narrative: "Route adapter
   `src/app/audit/privacy/page.tsx`". All named paths that never existed. The paths are now real;
   the *historical `change.reason` text is left verbatim* (rewriting a past revision's account is the
   thing v6-3 §2's honest-declarations are supposed to protect), with a corrective comment placed
   immediately above each `owners:` block naming what was wrong and where the narrative stops being
   current. `privacy` is the sharpest case: its rev-2 note explicitly promises "The rev-1 narrative
   below is kept verbatim as the record of what was built" — honouring that promise and fixing the
   path are compatible, so both happened.
2. **Stale route prose outside my files, same root cause.** `fr.plan.usage/view` and
   `fr.plan.downgrade` both say the usage screen "exists at `src/app/plan/usage`"; `sds`/`ui` records
   across the todo tree carry the same pre-`[lang]` shape. Out of scope (fr/sds/ui) → v7-1/v7-4/v7-14.
3. **`impl.login.todo-app-frontend.sign-in` captures are provenanced as `Running-page screenshot of
   /sign-in`**, and the app has no `/sign-in` page — the URL is `/{en|vi}/sign-in`. I did not touch
   `assets:` provenance text (v7-9 owns these captures, and a provenance string is a claim about a
   screenshot I did not retake). Flagged for v7-9: recapture or reword, but the record's own
   `observations` already say captures ran on `localhost:3199` via Playwright, so the bytes may be
   right and only the label wrong.
4. **Nested route dirs now overlap.** `src/app/[lang]/tasks` is task-list's route dir and contains
   `[taskId]/share/`, so task-list's digest now hashes the share page that
   `impl.share.todo-app-frontend.invite-screen` exists to own (`plan` → `plan/usage` likewise:
   +2/+1 per record in §1a). This is extent-preserving (the authored parent dir claimed the same
   overlap before it broke) and it is what a module-root owner means in this layout, but it is the
   FE analogue of v6-4 §Q1's "one `br`'s module spans 3 roots, so the digest over-covers": a change
   to the share page will stale task-list's proof, and vice versa. Left as-is; flagged so nobody
   "fixes" it by narrowing an owner to a single file, which the layout forbids.
5. **`todo-app` means the project in one place and the realm in another** (§3). Both readings are now
   separated by a comment; the underlying single-name collision is not, because ids and the workspace
   document are out of scope.
6. **`todo-app-backend/infra/` did not exist and still does not** — only the record's claim about it
   moved (§3a). Nothing in the tree references the old string any more.

## Cross-lane notes

- **Any lane writing a bracketed Next.js dynamic segment into these YAMLs: quote it.**
  `core/yaml.mjs` **throws** on a plain scalar containing `[` inside a flow mapping —
  `- {role: route, path: src/app/[lang]/tasks}` is `Invalid or unsupported YAML`, and quoting it is
  the only thing that parses. Two consequences, both bad: `check-example-work.mjs:75` calls
  `parseYaml` with no `try`, so one such line **crashes the whole gate run** (the fleet loses every
  lane's signal, not just the offender's); `loadRecords` in `example-ownership.mjs:139` *catches and
  skips*, so `example-evidence.mjs`/`example-derive.mjs` silently drop the record — and
  `prover-fallback` then resolves nothing for every spec record whose code it reaches through that
  impl, while the derived index stops listing it. Block style (`path: src/app/[lang]/tasks` on its own
  line) parses fine; the corpus already quotes (`impl.share...owners` had
  `path: "src/app/tasks/[taskId]/share"`), so quoting is the convention, not a workaround. Probe with
  `ex-testing/lint/scratch/v7-3-yaml-bracket.mjs`. This lane hit it on its first edit and caught it
  because the digest test would not have moved otherwise.
- **v7-6 / v7-7**: the 7 FE `evidence.yaml` files in todo need both digests re-bound, and the
  `codeDigest` re-bind must run with `--cwd examples/todo-app-frontend` — 11 route files are now
  inside those digests that were never inside them before (§1a), so any re-proof that only reuses the
  stored file list will re-assert a proof that still does not cover the screen. `impl.plan.todo-app-frontend.usage`
  additionally has `verification: []` + `verificationSource: authored-claim` while sitting `done`
  beside a real `evidence.yaml` — v6-3 §Q4's escape-hatch misuse, unresolved here because it is a
  state question, not a path question.
- **v7-9**: `impl.audit.todo-app-frontend.privacy` and `impl.login.todo-app-frontend.sign-in`
  capture provenance names routes without the locale prefix (item 3 above).
- **v7-1 / v7-4**: 17 BE records still carry `repository: todo-app` against an
  `impl/todo-app-backend/` directory (§2); no fix chosen, so a later lane does not read the silence
  as agreement. And `provenBy` was confirmed **absent** from all 7 of my records, so §5 of v7-1's list
  will not land in this lane's files.
- **v7-13 (closer)**: expect `OWNER_PATH_MISSING` = 0 in both trees as of this marker; if it returns
  nonzero, a lane since authored a path without checking it, and §1c's ecommerce FE route table is the
  likely source.
