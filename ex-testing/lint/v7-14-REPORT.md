# Lane v7-14 — mechanical residual sweep across BOTH trees (Phase 4)

Date: 2026-09-19. Scope per `ex-testing/briefs/v7/_common.md` + `v7-14.md`: path/string consistency
across `examples/todo-app-backend/.starciwork` and `examples/ecommerce-app-be/.starciwork`. No product
source (`src/**`, `apps/**`) was edited. No `evidence.yaml`, `_derived/`, capture, prompt or digest file
was written by this lane. Lane scratch (scripts + measured output): `ex-testing/lint/scratch/v7-14/`.

## Wait state — phase-1 gate honored, no timeout used

`done/v7-1.done`..`v7-5.done` were checked directly at 18:26 and 18:33 (none present) while the required
reading was done, then polled every 60 s from 18:42. Observed arrival:
`v7-2` 18:37:05 (the marker's own write time), `v7-1` 18:43, `v7-3` 18:47, `v7-5` 18:48,
**`v7-4` 19:47:27**. All five present at
19:47:27, inside the 90-minute window, so the full inventory was re-derived against the final phase-1
state before a single byte was written (`sweep-post.txt`), and the fixer's own assertions were re-run
against it. Phase-3 heavy lanes (`v7-6`..`v7-12`) were still running when I applied; per the brief I did
not wait for them. Their work is why the cost of my edits (§4) is a digest re-binding rather than a lost
proof: 4 of the 23 records I staled had already been re-proved by v7-6 before I sealed, and the
`codeDigest` class dropped from 71 to 54 while this report was being written.

## Tools this lane wrote (read-only against the trees)

The gate never looks at `composes[].module`, never resolves `inputRefs` as paths, never compares a
`repository` field against the workspace entry or the impl directory segment, and never executes the
schemas' required lists — the four blind spots this lane was sent into.

| script | what it measures |
| --- | --- |
| `sweep.mjs` | walks every `.yaml` in both trees; checks `module:` / `owners[].path` / `composes[].module` / `inputRefs` / `assets[].path` / `promptPath` / `directionAsset` / `run` / `master.path` / command-embedded paths for existence against the correct base (repo, work-root, host, record dir, the named `inspectionRoot`/`resolvedPath`, or the master's own record dir); machine-absolute detection; `repository` vs workspace vs directory segment; schema `required`/`pattern` per declared schema; catalog↔directory; duplicate ids |
| `pins.mjs` | indexes every first-party file by sha256 and asks, for each path+`sha256` pin pair, whether the bytes still exist *somewhere* — which is what distinguishes a pure move (mechanically retargetable) from a dead reference (not) |
| `fresh.mjs` | per record: does the sibling `evidence.yaml` currently satisfy the gate's own `recordDigest` and `codeDigest` tests |
| `fix.mjs` | the writer: line-anchored exact replacements, each with an expected-match assertion and a record-state precondition; any mismatch aborts the whole run with nothing written |
| `verify.mjs`, `verify-abs.mjs`, `report-tables.mjs` | post-write verification of every claim below |

## 1. What was purely mechanical — and is now fixed (76 lines, 28 files)

The complete change ledger, counted from `fix-apply.txt`: **76 changed line pairs** =
17 `repository:` values + 5 `revision:` values + 1 `workspace.yaml` repository name + 53 machine-absolute
paths. Nothing else in those files moved, and all 28 re-parse cleanly (`0 problem(s)`).

### 1a. `repository:` field vs actual sibling directory (brief item 2) — 17 → 0

`examples/todo-app-backend/.starciwork/features/*/impl/todo-app-backend/*/index.yaml` — all 17 backend
impl records — carried `repository: todo-app`, a name no directory on disk answers to
(`examples/todo-app` does not exist), while the impl directory, the record id and the real repository all
say `todo-app-backend`. `work-layout.yaml:42-44` requires the directory segment to be "the exact value
the record's own `repository` field names" — and its own worked example,
`impl/todo-app-backend/<name> beside impl/todo-app-frontend/<name>`, is unsatisfiable under the field as
it stood, since the rule demands the directory be named `impl/todo-app/<name>`. v6-3 §12 logged it as
"[medium] `impl/todo-app-backend/` directory names ≠ `repository: todo-app` — violates the layout's
exact-match rule; unchecked by the gate"; v7-3 §2 measured it and declined to fix it (not its files);
v7-5 §4 measured it and declined (not its scope). This lane owns the mismatch class, so:

- 17 records → `repository: todo-app-backend`.
- `.starciwork/workspace.yaml` be entry → `name: todo-app-backend`, because the field's schema says the
  value is "the repository this module lives in, **by the name the workspace record gives it**" — fixing
  only the records would have traded a directory mismatch for a workspace mismatch.

Resolution is unchanged by construction and was verified rather than assumed: `repoRootFor`
(`scripts/example-ownership.mjs:43`) returns the backend root for `role: 'be'` whatever the name is, and
`verify.mjs` now reports for both trees

```text
examples/todo-app-backend/.starciwork workspace repositories: be:todo-app-backend fe:todo-app-frontend
  be todo-app-backend -> examples/todo-app-backend  exists=true
  fe todo-app-frontend -> examples/todo-app-frontend  exists=true
examples/ecommerce-app-be/.starciwork workspace repositories: be:ecommerce-app-be fe:ecommerce-app-fe
  be ecommerce-app-be -> examples/ecommerce-app-be  exists=true
  fe ecommerce-app-fe -> examples/ecommerce-app-fe  exists=true
impl directory/field mismatches: 0
repository values in use: todo-app-backend(17) todo-app-frontend(7) ecommerce-app-be(2)
impl records whose repository resolves to a missing directory: 0
```

so directory == id segment == `repository` field == workspace entry == real sibling directory in both
trees, which is the state the ecom tree already had. `check-example-work.mjs` still reports
**zero `OWNER_PATH_MISSING`** lines after the rename: no owner path resolution moved.

A number worth correcting in the record: v7-5 §4 says "22 of 24 todo impl records sit under
`impl/todo-app-backend/`". Measured census (`census.mjs`): 24 todo impl records, **17** under
`impl/todo-app-backend/`, 7 under `impl/todo-app-frontend/` (whose field already matched). 22 overstates
the blast radius by five; the 76-line change above is the whole of it.

### 1b. `revision:` values against the schema's own pattern (brief item 3, the mechanical half) — 5 → 0

`schemas/work-implementation.schema.yaml:41` requires `^(?:[a-f0-9]{40}|[a-f0-9]{64})$` for `revision`.
Five records carried eight hex digits. Each was expanded only after `git rev-parse` in the repository
that tracks `examples/**` resolved it to exactly one commit — identity expansion of the same commit, not
a new claim:

| record | was | now |
| --- | --- | --- |
| `impl.login.todo-app-backend.auth`, `impl.task.todo-app-backend.create-task`, `impl.task.todo-app-backend.platform-database` | `750bd4b1` | `750bd4b1502aa47f44462f16e68a693c0a7d3803` |
| `impl.login.todo-app-frontend.sign-in` | `b104d717` | `b104d71744a67bd6c231e374292c12d78fa7ca9a` |
| `impl.task.todo-app-frontend.task-list` | `5ff83e19` | `5ff83e1986186965c1272290830323ef2bc2db2d` |

The other 21 impl records either already carried a full sha (14 verified against the pattern) or carry no
`revision` at all — that half is §2c, a proof-authorship decision, not a path.

### 1c. Absolute machine paths in records (brief item 4) — 53 → 0

`brand/index.yaml` plus the seven todo `ui/*/index.yaml` records committed another Orca worktree's
Windows path as provenance. Each was normalized to the host-relative form the *same file already uses*
for its sibling fields (`examples/…`, `knowledge/…`), and each conversion was **pin-verified first**: the
record's own `sha256` for that entry matches the bytes at the relative target in this checkout, so the
rewrite names the same content, in the same tree, on any machine:

```text
C:/Users/Hi/orca/workspaces/.claude/ex-draw-v3/examples/todo-app-frontend/…  ->  examples/todo-app-frontend/…   (42, every one MOVE_PROVEN — pinned bytes identical)
C:/Users/Hi/orca/workspaces/.claude/ex-lint/                                  ->  (stripped)                    (7 inspectedPath, the sibling `path` pin of the same entry verifies)
```

42 × `ui.acceptedInputs.grammar.inspectedCurrentFiles[].path`, 7 ×
`ui.acceptedInputs.knowledge[6].inspectedPath`, 3 × `brand.sources[].inspectionRoot`,
1 × `brand.grammar.resolvedPath`. URL routes (`/tasks`, `/internal/buyers/:personId`,
`/realms/todo/...`) and scheme addresses (`postgres://`, `redis://`) are wire paths, not file paths, and
were excluded deliberately — a naïve "any string with a slash" sweep would have rewritten them.

Post-write verification (`verify-abs.mjs`, run against the current files, 8 records):

```text
totals: pins still matching current bytes 186; resolved-but-historical 28; unresolvable 0; machine paths left in these records 0
```

i.e. after the rewrite **nothing in those records points at a file that is not there**, and 186 of their
content pins verify byte-for-byte. The 28 historical ones are references to records other lanes edited
today (`fr.place-order`, `brand/index.yaml`, `knowledge/ui/proof/anatomy-source.yaml`): path valid, digest
moved — the record states what was read then, which is what a provenance pin is for. That is not a defect
to paper over by re-pinning, and this lane did not.

## 2. What is mechanical in appearance but is not fixable without a decision (report only)

### 2a. `ecommerce-app-be` ui provenance names 16 frontend paths that no longer exist (brief item 1)

`ui.provenance.frontendContext[].path` in the five ecom ui records. v7-3 §1c put this on my list.
Measured, then **left alone**, for a reason v7-3's existence check could not see: each entry pins the
`sha256` of the bytes that were read, and no file in this checkout has those bytes.

| kind | entries | detail |
| --- | --- | --- |
| route moved under `[lang]` | 11 (7 distinct paths) | candidate exists — `apps/shop/src/app/[lang]/{cart,checkout,browse,account,page,layout}.tsx`, `apps/landing/src/app/[lang]/page.tsx` — but **bytes DIFFER**, so it is a move *and* a content change, not the pure move a retarget asserts |
| component removed | 5 (3 distinct paths) | `apps/shop/src/components/AppNav.tsx` (×3), `ProductTile.tsx`, `apps/landing/src/components/SiteHeader.tsx` — no such file under any name; the FE now composes `components/layouts/ShopLayout/`, `components/pages/<Page>/{component,index}.tsx`, `layouts/SiteLayout/` |

Retargeting a `path` while keeping a dead `sha256` would state "this file *is* what I read" about content
that demonstrably differs; re-pinning the current bytes would state "I read *this* content", which the
draw did not. Either is a false identity claim, and `_common.md` forbids fabricating a digest. Compounding
it: all five records' `evidence.yaml` was re-bound by v7-10 at 18:49–18:50 today (fresh by the gate's own
test), so a cosmetic path edit here would stale a proof the owning lane just made. **The fix belongs to
the ui/render lane that next re-reads the front end**: re-read the current files, write the new paths and
the new digests in one pass, or keep the historical paths and add a dated comment naming the move — say
which, and `report-tables.txt` has the per-entry candidate target.

### 2b. Four record families carry a `schema:` no file defines (61 records), plus `_resources` and the payloads

```text
  39  work/gap                             NO SCHEMA FILE
   8  work/contract                        NO SCHEMA FILE
   8  work/integration                     NO SCHEMA FILE
   6  work/event                           NO SCHEMA FILE
   3  work/resource                        NO SCHEMA FILE   (_resources/**/resource.yaml, skipped by my
                                                            sweep because the gate reads those itself)
  17  starci/uat-run-manifest@1 (11), starci/generation-receipts@1 (5), starci/direction-check@1 (1)
```

`work/gap` alone is 39 of the tree's 313 records. v7-4's handoff note carries the baseline it worked from
("v6-3 baseline: `gap.*` in either tree: 5 records") and says it authored 14 of what is there now; the
rest were named by the render and UAT lanes. In-tree there is nothing to fix — the records' `schema:`
strings are exactly the 15 families `work-layout.yaml:9` enumerates (the gate reads that list at run time
and refuses `FAMILIES_DRIFT` if it and `check-example-work.mjs` disagree); what is missing is
`schemas/work-{gap,contract,integration,event,resource}.schema.yaml`, without which a quarter of the tree
asserts a `const` no validator can check. The 17 payload/manifest files are the same class one layer down.

### 2c. `schema:` required lists the tree cannot satisfy (51 records) — and two are self-contradictory

| count | schema | field(s) |
| --- | --- | --- |
| 16 | `work/implementation` | `revision`, `verification`, `verificationSource` |
| 14 | `work/data` | `appliesTo` |
| 9 | `work/non-functional-requirement` | `appliesTo` |
| 7 | `work/implementation` | `verification`, `verificationSource` |
| 2 | `work/implementation` | `revision` |
| 1 | `work/policy-decision` | `recommendation`, `recommendationReason` |
| 1 | `work/functional-requirement` | `composes` |
| 1 | `work/uat-flow` | `proves` |

Two of those rows are **not** record defects. `schemas/work-data.schema.yaml:7` and
`work-non-functional-requirement.schema.yaml:7` require `appliesTo`, while
`check-example-work.mjs:223-228` refuses `outbound appliesTo` on exactly those schemas —
"only for business-rule and sds-component, where the target is a named module". The two are mutually
unsatisfiable: writing the field makes the gate refuse, omitting it makes the schema unsatisfied, for 23
records. `work/implementation`'s schema is contradicted the same way by `directory`/`files` (required at
`:7`, refused as legacy at `:180`) — this lane scores required-sets against the *executable* shape and
excludes those two, and says so rather than silently scoring a schema the gate forbids.

The remaining rows are proof-authorship, not paths. Filling in `verificationSource: authored-claim` is
exactly the hatch v6-3 §Q4 documented: the field is "accepted on *any* schema", the gate's own
`AUTHORED_CLAIM_SCHEMAS` covers only 3 schemas (`work/data`, `work/brand`, `work/policy-decision`) against
12 proof-required stateful ones, and the two clear misuses it named are `impl.plan.todo-app-backend.plan`
and `impl.plan.todo-app-frontend.usage` — `work/implementation` records claiming done on an authored
assertion with `verification: []`, beside a then-stale `evidence.yaml`. Those are exactly the two records
in the table above whose only gap is `revision`, which this lane did *not* add: choosing a revision is
choosing what the record is true at, and v7-1 §5 shows what hand-written proof fields cost — that lane
spent its pass deleting `provenBy` blocks six records carried, because the kernel derives them.
`decision.audit.operator-role` lacking `recommendation`/`recommendationReason`,
`fr.plan.usage.view` lacking `composes` and `uat.plan.upgrade-after-cap` lacking `proves` are the same
shape: a claim to author, not a string to fix.

### 2d. Two documents in the ecom tree carry the same `id`

`workspace.yaml` and `index.yaml` both declare `id: ecommerce-app`, and the loader keys records by id in
a `Map` (`scripts/example-ownership.mjs:52`, `records.set(record.id, …)`) — one of the two silently stops
existing for every consumer, which is exactly the failure v7-5 §2 proved with the five payload pseudo-ids
and v6-4 §Q6.3 saw with `_data` collisions. The ecom catalog and workspace are not distinguishable by id
today; the todo tree happens to avoid it (`workspace id: todo-app`, `catalog id: todo`). Which side
renames is a naming decision (v7-5 owns the catalog, and `work-catalog.schema.yaml:21-22` says a catalog id
"names the product, not the repository", which points at the *workspace* document as the one to change).
Reported, not decided.

### 2e. Machine-specific paths that must NOT be normalized

Three todo evidence files record their live-proof assertions as

```text
examples/todo-app-backend/.starciwork/features/task/br/complete/once/evidence.yaml: 2 (C:\PROGRA~1\Git\bin\bash.exe)
examples/todo-app-backend/.starciwork/features/task/br/delete/final/evidence.yaml: 2 (C:\PROGRA~1\Git\bin\bash.exe)
examples/todo-app-backend/.starciwork/features/task/br/list/owned/evidence.yaml: 2 (C:\PROGRA~1\Git\bin\bash.exe)
```

That is the interpreter the command actually ran under (an 8.3 short path for Git bash) — rewriting it to
`bash -c "…"` would make a replay command portable by lying about what executed. It needs re-running on
whatever shell the replay lane uses (v8-1's `scripts/check-work-replay.mjs` now resolves `assertion.cwd →
evidence.cwd → record.repository`, so it is the natural place), not a string swap. v7-5 §4's note is the
same class in payload prose: the `ui/*/assets/*.prompt.txt` files quote an `ex-lint` worktree path *
because that checkout lacked* `knowledge/ui/proof/anatomy-source.yaml`; normalizing those would point at a
file that is not in the repo, and the honest fix (carry the bytes, drop the machine path) is a judgment —
left to the assets lane. Nothing under `assets/**`, `runs/**` or `evidence.yaml` was written here.

### 2f. Gate-side items that are not this lane's to decide

- **6 refusals** of the form `id is undefined, but its place says ui.checkout.cart.assets` — the ecom
  asset payloads v7-5 gave their real `starci/*` schema after the fake-id lie. The gate walks every
  `.yaml` under `features/` deeper than two segments (`check-example-work.mjs:84`) and has no payload
  skip; only a `scripts/` change can resolve it (v7-5 §2 recommends excluding `**/assets/**` from the
  walk and from `collect()`), which the brief puts out of scope. A `.txt` rename would silence it by the
  same dodge v7-5 rejected, so it is untouched.
- **`schemas/work-layout.yaml:118,160` still say `featureCatalog: features/index.yaml`**, a file that
  exists in neither tree; `schemas/source-layout.yaml:34,107` repeats it;
  `work-catalog.schema.yaml:5` and reality say `.starciwork/index.yaml` (v6-3 §17, v7-5 §3). Two host
  files, no executable reads them, so the gate cannot see the contradiction. Not a tree edit.
- **`_resources/**/resource.yaml` `owner:` and id segments** (`identity.todo-app.demo` vs
  `todo-app-backend`): v7-3 §2 already reasoned that an id segment is not a repository claim and left it;
  this lane agrees and adds nothing.

### 2g. Three `measurement.how` values name a load harness that does not exist (found by adding a prose-command check)

No structured field in the tree carries these paths, so nothing in the gate can see them; my first pass
missed them too, and they surfaced only when I taught the sweep to read commands out of prose. All three
name `scripts/load/<x>.js` and there is no `scripts/load/` directory in `examples/todo-app-backend`:

```text
features/plan/nfr/cap-check/latency/index.yaml    measurement.how: k6 run scripts/load/create.js …   covered by gap.plan.no-load-harness
features/share/nfr/revoke/read-latency/index.yaml measurement.how: k6 run scripts/load/share-status.js …  covered by gap.share.load-proof
features/task/nfr/list/latency/index.yaml         measurement.how: k6 run scripts/load/list.js …      NOT covered by any gap record
```

Plan and share state the absence as a `work/gap` record and bind it with a `blockedBy` — the shape the
model wants. Task's is held only by an English comment v7-1 added ("naming a gap for task is the gaps
lane's, so the fact is documented in a comment"), and v7-4's pass created six `gap.task.*` records without
that one. Writing the gap is content authorship in the gaps lane's voice, not a string to fix, so it is
reported; the mechanical fact — no `scripts/load/`, no k6 binary, three nfrs whose stated measurement
cannot be run — is measured above. Two more prose hits are correct usage and must not be "fixed":
`gap.plan.no-load-harness.statement` and `nfr.login.sign-in-timing.change.withdraws[1]` name the missing
file *in order to say it is missing*.

## 3. Classes this lane swept that phase-1 had already cleared (independent confirmation)

My sweep checked these tree-wide before I touched anything, so the fleet gets a second measurement:

| class | first inventory (18:5x) | after phase-1 (19:47) | who closed it |
| --- | --- | --- | --- |
| `composes[].module` naming a directory that does not exist | 8 | **0** | v7-1 §2 |
| `module:` / `owners[].path` missing on disk | 6 (todo fe routes) | **0** | v7-3 §1 |
| `apps/{order,identity}/…` owner paths in ecom | 52 (v6-3 §8) | **0** | v7-2 |
| `requiresProof` / assertion commands pointing at absent files | 8 (`scripts/load/*`, fe spec paths in be-resolved evidence) | **0** — and five of the eight were my own checker's blindness, not the tree's: `cd ../todo-app-frontend && npx vitest run src/hooks/auth/useSignIn.spec.ts` names a file that exists in the *sibling* repository, which the first base model did not consider. Handling the `cd` target as a base cleared them (`src/components/blocks/task-list`, `src/features/pages/tasks`, `src/components/blocks/sign-in-form`, `src/hooks/auth{,/useSignIn.spec.ts}` — all present in `examples/todo-app-frontend`) | v7-1 §3 for the one real case |
| `inputRefs` unresolvable | 0 after wire-path exclusion | 0 | already clean |
| `assets[].path` / `promptPath` / `directionAsset` / `master.path` | 0 unresolved | 0 | already clean |
| catalog `index.yaml` ↔ `features/*` directories | 9 + 9 false positives from my own first pass (entries key on `id`, not `directory`) | **0** real mismatches; v7-5 §3 independently confirms both directions | — |

## 4. Digest fallout — the honest cost of editing `index.yaml` after the proofs

`recordDigest` is the sha256 of the record's own bytes, so any record edit refuses its sibling evidence
until it is re-run. This lane wrote 27 records plus `workspace.yaml`; **23 of them had an evidence file
whose `recordDigest` matched at the moment of the write** (`fix-apply.txt` labels each file
`evidence recordDigest FRESH`), and all 23 now show a refusal:

```text
17  backend impl records: audit/{erasure,log,operator-read}, login/auth, notify/pipeline, plan/plan,
    recur/engine, share/{access,invitations}, task/{complete-task,create-task,delete-task,list,
    ownership,platform-database,platform-events,reopen-task}
1   brand/index.yaml
5   ui records: audit/privacy, notify/preferences, plan/usage, recur/schedule, share/invite
```

The other 4 records I edited (`login/ui/sign-in`, `task/ui/list`, `login/impl/todo-app-frontend/sign-in`,
`task/impl/todo-app-frontend/task-list`) already carried a `recordDigest` mismatch when I measured them at
19:07 and again at 19:47 — their `index.yaml` had been edited after their evidence was bound, before this
lane ever opened them — so the edit costs nothing there. By the sealed run, v7-6 had already re-bound 4 of
the 23 (all of `audit/impl/todo-app-backend/{erasure,log,operator-read}` and `login/impl/todo-app-backend/auth`),
leaving 19 refused.

```text
recordDigest refusal lines: 24 (before my writes) -> 46 (2 min after) -> 32 (sealed)
evidence files that gained a recordDigest refusal: mine=23, other-lanes=4
```

Nothing was marked `stale: true`, no digest was recomputed by hand, and no `evidence.yaml` was opened for
writing — the refusal text changing is the model working as documented, and the re-run belongs to v7-6
(todo non-ui evidence) and v7-9 (todo ui), both of which run after phase-1 and will re-bind these on their
next pass. Representative verbatim lines from `gate-final.txt`:

```text
REFUSED examples/todo-app-backend/.starciwork/features/task/impl/todo-app-backend/list/evidence.yaml: recordDigest … no longer matches impl.task.todo-app-backend.list's current digest …; refused unless it carries stale: true
REFUSED examples/todo-app-backend/.starciwork/features/share/ui/invite/evidence.yaml: recordDigest … no longer matches ui.share.invite's current digest …; refused unless it carries stale: true
```

## 5. Gate counts, and which part of the movement is mine

`node scripts/check-example-work.mjs`, with the exit captured through a `&&`/`||` marker file
(`gate-sealed.code` → `GATE_NONZERO`) rather than `%ERRORLEVEL%`, which cmd.exe expands at parse time and
would have reported a false zero:

| run | records | refs | evidence | refused | warned |
| --- | --- | --- | --- | --- | --- |
| 18:22, before any v7-14 observation | 295 | 2518 | 114 | 134 | 4 |
| 19:33, immediately before my writes (`gate-before.txt`) | 311 | 2505 | 120 | 130 | 4 |
| 19:52, 2 min after my writes (`gate-final.txt`) | 313 | 2658 | 120 | **142** | 0 |
| 20:0x, sealed (`gate-sealed.txt`, **exit ≠ 0**) | 313 | 2661 | 120 | **111** | 0 |

Class-level movement, before-writes → sealed: `CODE_DIGEST_STALE` 71 → 54 and `recordDigest` 24 → 32
(evidence lanes re-proving while I worked — of the 23 records §4 lists, **4 had already been re-bound by
v7-6 at seal time and 19 were still refused**), `RENDER_CHECK_FAILED` 29 → 19 and
`BLOCKER_UNROOTED` 4 → 0 (v7-4/v7-9 landing), payload `id is undefined` 6 → 6 (§2f). The +22 the 19:52
run showed in `recordDigest` is this lane's §1a/§1c edits plus 4 from concurrent phase-1 writes; the tree
total at 111 is **19 below** the 130 that stood before I wrote, and every line still attributable to me
is a digest re-binding another lane is already working through.

Warnings in both trees are zero. `node --test tests/example-work-gate.spec.mjs
tests/example-evidence.spec.mjs tests/example-derive.spec.mjs` → **46 pass, 0 fail** after my writes
(`tests.txt`; same 46/0 v7-3 recorded, so no tooling behaviour moved).
`node scripts/check-example-derived.mjs` → todo `_derived/index.yaml` stale (v7-8's rebuild; this lane
does not write `_derived`). Re-running `fix.mjs` after the writes aborts all 18 of its §1a rules with
`repository is already todo-app-backend` and writes nothing — the fix is idempotent and cannot be
double-applied by a later pass.

## 6. Unresolved record↔code contradictions this lane leaves

1. **The 16 ecom ui provenance paths of §2a.** The record claims it read `apps/shop/src/app/cart/page.tsx`
   and its pin; the front end has that page at `apps/shop/src/app/[lang]/cart/page.tsx` with different
   content, and `AppNav.tsx`/`ProductTile.tsx`/`SiteHeader.tsx` exist in no form. A reader cannot open
   what the record says it read, and no mechanical edit can repair the claim.
2. **`repoRootFor`'s sibling-directory assumption is still load-bearing and still unchecked for the ecom
   front end.** With `repository` now naming real directories in both trees, the remaining fragility is
   v6-3 §11's: `ecommerce-app-fe`'s code lives under `apps/shop/src/**`, so a future `<repo>/src/**` owner
   path there would resolve to a non-existent directory and `hashOwnedDirs` would return `null` *silently*
   (`example-ownership.mjs:124`). Today the ecom tree has 2 impl records, both backend, so nothing is
   exposed — the hazard is latent, and `scripts/check-work-surfaces.mjs` (v8-2) is the first tool that
   would catch it. Not a residual to sweep; a shape to watch.
3. **25 of the 26 `work/implementation` records do not satisfy their own declared schema** (§2c): 18 carry
   no `revision` at all, 23 carry no `verification`/`verificationSource`, and 16 lack all three — including
   both ecommerce impl records and every `audit/*` impl. Only
   `task/impl/todo-app-frontend/task-list` satisfies the required set. The path-side half of the `revision`
   problem is fixed in §1b; the other two fields are proof-claim vocabulary this lane must not fill in.
   They are also currently *masked* rather than enforced: the gate's done-without-proof check
   (`check-example-work.mjs:247-253`) only fires when no `evidence.yaml` sibling exists, and all 25 have
   one, so nothing refuses them today. That is what makes `verificationSource` worth having: v6-3 §Q4
   found the field accepted on any schema while only 3 of 15 schemas are supposed to be able to claim it,
   and found 78 of that tree's 114 evidence files refused as stale with only 2 carrying the `stale: true`
   valve — i.e. `done` was already widespread while current proof was not, and this lane's mechanical edits
   cannot close that gap, only re-bind it.
4. **The unresolved paths inside payload files are another lane's measurement to redo, not this lane's to
   rewrite.** My first inventory (18:5x, mid-phase-1) counted **101**; the run after phase-1 closed counts
   **36** across 16 distinct paths — 30 `evidence.yaml` `codeDigest.files[].path` entries naming code that is
   gone (the `src/modules/bussiness/{task,share,recur,notify}/index.ts` barrels, which exist in no module;
   `audit-operator-role.guard.ts`; the pre-`[lang]` fe page routes) and 6 `assets[].path` entries in uat run
   manifests naming a `videos/{sign-in,create}.webm` that was never kept. The drop is v7-6/v7-7's
   regeneration landing while I worked, not anything I did — this lane opened no `evidence.yaml` and no
   `runs/` file. Both lists are in `report-inputs.txt` (18:5x) and `sweep-5.txt` (post-fix).

## 7. Files this lane wrote

Inside the trees: 17 `features/*/impl/todo-app-backend/*/index.yaml`,
5 of those also with `revision`, 2 `features/*/impl/todo-app-frontend/*/index.yaml` (`revision`),
`workspace.yaml` (1 line), `brand/index.yaml`, and 7 `features/*/ui/*/index.yaml` — 28 files, 76 line
pairs, all enumerated with before/after text in `ex-testing/lint/scratch/v7-14/fix-apply.txt`.
Outside the trees: this report, `ex-testing/lint/done/v7-14.done`, and
`ex-testing/lint/scratch/v7-14/{sweep,pins,fresh,fix,verify,verify-abs,census,report-inputs,report-tables,uncls}.mjs`
plus their `.txt`/`.json` output and `gate-before.txt` / `gate-final.txt` / `gate-sealed.txt` /
`derived.txt` / `tests.txt`. Two earlier marker files (`gate-before.code`, `gate-after.code`) were deleted:
they were written with `echo EXIT_%ERRORLEVEL%`, which cmd.exe expands at parse time, so they recorded
`EXIT_0` for runs that exited 1 — a false artifact in the evidence directory is worse than no artifact.
`gate-sealed.code` is the one exit measurement this lane trusts (written by `&& … || …`, value
`GATE_NONZERO`).
