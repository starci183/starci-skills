# Lane v7-5 — REPORT: tree hygiene + payload/schema edges (Phase 1)

Date: 2026-09-19. Scope per `ex-testing/briefs/v7/_common.md` + `v7-5.md`: BOTH trees' root-level
files/dirs, `assets/**` payloads, catalog `index.yaml`. No product source touched, no `_derived`
write, no `_resources` write, no schema file write.

Gates run: `node scripts/check-example-work.mjs` (baseline + post-fix + final),
`node scripts/check-example-derived.mjs` (read-only checker), plus three read-only audit scripts of
mine (`ex-testing/lint/_v75-*.mjs`, listed in the appendix).

**Concurrent-lane caveat.** The trees moved under this lane while it ran: the gate went
`295 record(s) … 134 refused` → `299 … 143` → `311 … 154 refused, 3 warned` across three runs, and
`_resources/environments/dev/resource.yaml` was edited by v7-3 between my audit and my report. Every
number below is stamped with which run produced it. My lane's delta is isolated by set-diffing the
refusal lines, not by comparing totals (`_v75-diff.mjs` → `_v75-diff-final.txt`).

## Baseline and end state (verbatim summary lines)

```text
295 record(s), 2518 ref(s), 114 evidence file(s): 134 refused, 4 warned      # baseline, before any v7-5 write
311 record(s), 2504 ref(s), 115 evidence file(s): 154 refused, 3 warned      # final, after v7-5 writes
```

Final 157-line breakdown (71 `CODE_DIGEST_STALE`, 53 `RENDER_CHECK_FAILED`, 24 untagged
recordDigest-mismatch lines, 6 `id is undefined`, 3 `BLOCKER_UNROOTED` warnings): **this lane accounts
for exactly the 6 `id is undefined` lines (§2)**. The 24 recordDigest lines are v7-1/v7-2/v7-4 editing
`index.yaml` files mid-lane (their briefs state that evidence lanes run after them), and the digest
*values* inside two of the baseline lines changed between my runs for the same reason. Zero refusal
line mentions `DIRECTIONS` or `directions.md` — the root-file move introduced no new refusal.

---

## 1. Unsanctioned roots — both fixed

`work-layout.yaml:266` (the custody rule) is the standard applied:
canonical Work (`workspace.yaml`, `brand/`, `features/`) + tracked counter-record
(`ledger-anchor.json`) + runtime custody (`runtime.sqlite`, `kernel-*`) + `_derived/`
(`shape.derived`) + `_resources/` (`shape.resources`). Catalog at `.starciwork/index.yaml` per
`work-catalog.schema.yaml:5`.

### Root inventory, before → after

| tree | root entries before | after |
| --- | --- | --- |
| todo-app-be | `.gitignore`, `brand/`, **`business-rules/`**, `features/`, `index.yaml`, `ledger-anchor.json`, `workspace.yaml`, `_derived/`, `_resources/` | same minus `business-rules/` |
| ecommerce-app-be | `.gitignore`, `brand/`, **`DIRECTIONS.md`**, `features/`, `index.yaml`, `workspace.yaml`, `_derived/` | same minus `DIRECTIONS.md` |

- **`business-rules/` (todo) — deleted.** Verified empty first (`dir /a` → `0 File(s)`, only `.` and
  `..`; 0 files by recursive walk), and `findstr /S "business-rules"` across all of
  `examples/**/*.{yaml,md,json}` → 0 hits, so nothing referenced it. It is the leftover shell of the
  retired `business/` nesting (`work-layout.yaml` `shape.familiesNote`), and "empty layers are not
  scaffolded". It was untracked (git stores no empty dirs), so this cleanup shows in no `git status`.
- **`DIRECTIONS.md` (ec, 4 852 bytes, LF) — moved, not deleted.** It is *not* stale prose: its one
  checkable lifecycle claim, "UI records remain `uninvestigate`", is still true — all five ecom ui
  records verified `state: uninvestigate` (`ui.checkout.{cart,landing-home,shop-browse,stock-refused}`,
  `ui.identity.sign-in`). It also holds facts found nowhere else (the sampled raster-pixel table with
  coordinates, the B3 prompt-formula note, the "no frontend/ops/scripts/CI files were changed"
  scope claim), and `direction-check.yaml` cites it twice — `visualReview: See each UI record and
  DIRECTIONS.md …` and `pixelTokenMatch: 'not exact; final sampled pixels are recorded in
  DIRECTIONS.md; …'`. Deleting it would have stranded that claim and destroyed the only record of the
  raster-limitation measurements.
- **New home: `examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/directions.md`.**
  Chosen because (a) that node already owns the cross-screen artifact-verification payload
  (`direction-check.yaml`), so the two provenance documents for the same five-screen draw sit beside
  each other under one owner, and (b) the sibling todo tree keeps exactly this class of document in a
  ui node's `assets/` (`features/task/ui/list/assets/visual-review.md`, and `…/assets/CAPTURES.md`
  under an impl node) — an established in-repo convention, sanctioned by `work-layout.yaml:68`
  (`<node>/assets/**/<file-in-original-format>` … "never a Work node in its own right").
- **Link rewrite, byte-minimal.** 18 relative-link prefixes rewritten across 8 lines. Verified by
  line-diffing the new file against `git show HEAD:…/DIRECTIONS.md`: 67 lines both sides, **8**
  differing lines, every one of them a link-path change, zero prose changed. The fixer script asserted
  on-disk resolution for all 18 targets and aborted twice before writing (a bad `L` prefix, then two
  wrong `../` depths it caught itself), so the final file is the only state ever written.
- **`direction-check.yaml` repointed**: both `DIRECTIONS.md` references now read
  `assets/directions.md` (node-relative), asserted count 2 before replacing.

### One root item I did NOT touch, and why

- **`.gitignore` (both trees, 129/128 bytes)** is the only remaining root entry that
  `work-layout.yaml:266`'s enumeration does not name — literally "a file at the root that is none of
  these is drift". Its content is exactly the runtime-custody exclusion list
  (`runtime.sqlite`, `-wal`, `-shm`, `kernel-evidence/`, `kernel-strays/`, `kernel-headless/`,
  `kernel-approvals/`, `_local/`), i.e. it is the mechanism that makes the rule's "untracked"
  enforceable in a git host; `findstr` for `.gitignore` across `schemas/`, `docs/`, `scripts/` returns
  nothing, so it is unnamed rather than sanctioned. **Deleting it would turn untracked kernel state
  into tracked Work content — the opposite of the rule's intent. Kept, flagged here.** If the schema
  owner wants the letter satisfied, the fix is one clause in the custody rule ("plus the `.gitignore`
  that holds the runtime custody untracked"), not a change in these trees.
- `ledger-anchor.json` present in todo, **absent in ec** — sanctioned-by-absence (no live workflow has
  anchored there); flagged, not scaffolded ("empty layers are not scaffolded").
- `_resources/` present in todo, absent in ec — see §4.

---

## 2. Asset payloads — fake record ids reverted; the gate recognises no payload marker

### What was on disk when this lane arrived

All six payloads carried the real schema **and** a fabricated Work id:

```text
features/checkout/ui/cart/assets/generation-receipts.yaml        schema=starci/generation-receipts@1  id=ui.checkout.cart.assets
features/checkout/ui/landing-home/assets/generation-receipts.yaml schema=starci/generation-receipts@1 id=ui.checkout.landing-home.assets
features/checkout/ui/shop-browse/assets/generation-receipts.yaml  schema=starci/generation-receipts@1 id=ui.checkout.shop-browse.assets
features/checkout/ui/stock-refused/assets/generation-receipts.yaml schema=starci/generation-receipts@1 id=ui.checkout.stock-refused.assets
features/identity/ui/sign-in/assets/generation-receipts.yaml      schema=starci/generation-receipts@1 id=ui.identity.sign-in.assets
features/checkout/ui/landing-home/assets/direction-check.yaml     schema=starci/direction-check@1      id=ui.checkout.landing-home.assets
```

**Action: all six `id:` lines removed; every `starci/*` schema line kept.** `git diff` against HEAD
shows HEAD carried *neither* the `schema:` nor the `id:` line — v6-1 added both without committing —
so this lane's net change against the commit is the honest `+schema: starci/generation-receipts@1`
line on each of the five receipts payloads, and on `direction-check.yaml` the `+schema` line plus the
two repointed `DIRECTIONS.md` references. No ids were invented, no `stale:` marker used, nothing moved
out of `assets/`, no payload content edited.

### Why the fake ids were exactly those strings, and why they are worse than cosmetic

`check-example-work.mjs:84` — `if (segments[0] === 'features' && segments.length > 2 &&
!EXEMPT.has(record.schema))` — sends every `.yaml` under `features/` deeper than two segments through
`expectedId()` (`:38`), which for `features/checkout/ui/cart/assets/x.yaml` yields
`ui.checkout.cart.assets` (innermost family `ui`, then feature, then the remaining segments). The
earlier fix typed in the refusal's own expected value instead of stating what the file is.

Two measured consequences, not theoretical:

1. **`records.set()` collision.** `landing-home` had *two* payload files claiming one id
   (`ui.checkout.landing-home.assets` — the receipts file and the direction-check file). The walk is
   alphabetical, so the second silently replaced the first in the record map; the payload that
   actually documents artifact verification stopped existing as far as any consumer was concerned.
2. **The lie propagated into the readable index.** The working-tree
   `_derived/index.yaml` listed five payload pseudo-records, e.g.
   ```yaml
     ui.checkout.cart.assets:
       schema: starci/generation-receipts@1
       feature: checkout
       state: null
       effectiveState: null
   ```
   (observed at ~11:2xZ, quoted from `examples/ecommerce-app-be/.starciwork/_derived/index.yaml`
   lines 148-200). `HEAD`'s committed derived index contains no `.assets` key — this contamination
   existed only because of the uncommitted fake ids. A concurrent rebuild at 11:33:10Z dropped them:
   the ec derived index now holds 32 record keys, none named `*.assets`.

### The gate does *not* skip non-`work/*` schemas — so the 6 refusals are back, by design

Confirmed against the code and empirically: `EXEMPT` (`:25`) is a closed allow-list of **exact schema
strings** — `work/catalog`, `work/workspace`, `work/brand`, `work/feature`,
`work/disposable-accounts`, `starci/application-stacks` — not a `work/*` prefix test.
`starci/application-stacks` proves a non-Work schema can be exempted, but the mechanism is a schema
deny-by-name list that there is no in-tree way to extend. So giving the payloads their real schema was
necessary and is not sufficient. **Verbatim, from the final run** (`_v75-gate-final.txt`):

```text
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.cart.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/direction-check.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.landing-home.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.shop-browse.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/assets/generation-receipts.yaml: id is undefined, but its place says ui.checkout.stock-refused.assets
REFUSED examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/assets/generation-receipts.yaml: id is undefined, but its place says ui.identity.sign-in.assets
```

These six are the **only** delta this lane made to the gate's verdict set, and they are a true
statement about a gate defect, not a false statement about the tree. `work-layout.yaml:68` and `:286`
("Payloads are not interpreted as Work nodes, resources, accounts or manifests") are on the payloads'
side; the walk is the outlier.

**Recommended gate fix (out of this lane's scope — not applied).** Either
(a) one line: add `starci/generation-receipts@1` and `starci/direction-check@1` to `EXEMPT`, or
(b) narrower and more correct: exclude `**/assets/**` from the record walk at `:84` (and from
`collect()`), which additionally stops payload strings being harvested as refs and stops the
`records.set()` id collision class entirely. (b) makes the code match the layout text that already
exists; (a) leaves the collision hole open for the next payload schema.

**What I deliberately did *not* do:** rename the payloads to dodge the walk. That workaround is
already visible in the sibling tree — todo keeps `features/task/ui/list/assets/direction-check.txt`
(a PASS/LOG text artifact) and `assets/anatomy-source.accepted.yaml.txt` (YAML content under a `.txt`
name). The `.txt`-named YAML is the same species of dodge as the fake id: it silences a check by
changing a filename instead of stating what the file is, and it discards the `starci/*` schema
discriminator. If the fleet decides the gate stays frozen, that tradeoff belongs to the owner, in one
documented sweep, not smuggled in per-file by a hygiene lane. Flagged for that decision.

### The payload content is currently honest (so it deserves the fix, not deletion)

`_v75-payload-check.mjs` re-hashed what the receipts claim:
**55 of 55 digests match** the bytes on disk (24 artifact/prompt hashes + 31 referenced-image hashes,
0 mismatch, 0 missing), and `direction-check.yaml`'s counts check out: `totalPngsIncludingHistory: 12`
/ `siblingPrompts: 12` vs 12 `.png` and 12 `.prompt.txt` actually present under those five `assets/`
dirs, `result: pass` with 5 per-record `pass` rows. Caveat: this is truth *as of this run* — v7-10 is
recapturing the ecom front end and will move those bytes; nobody should treat these hashes as
settlement, and none of them is `state: done` evidence (all five ui records are `uninvestigate`).

### One asymmetry left for the ui lanes (v7-9 / v7-10 own `ui/**`)

The ecom ui records declare only image/prompt files in `ui.assets[]`; none declares the `.md`/`.yaml`
payloads sitting in its own `assets/` (and the newly moved `directions.md` is therefore undeclared).
The todo tree does declare them (`features/task/ui/list/index.yaml:486` `reviewPath:
assets/visual-review.md`, and `ui.assets[]` entries for `assets/visual-review.md` +
`assets/direction-check.txt`). Declaring them is a ui-record edit — v7-10's scope, not mine.

---

## 3. Catalog ↔ dirs — verified consistent; zero edits needed

`_v75-audit.mjs` checks four directions per tree (entry → existing directory, directory → listed in
catalog, catalog id → matching `work/feature` node at `features/<f>/index.yaml` with `id === <f>`,
plus no orphan entry). Result, both trees:

```text
todo:  schema=work/catalog id=todo        entries(7): login, task, share, notify, plan, audit, recur
       actual features/* dirs(7): audit, login, notify, plan, recur, share, task
       entry->missing dir: none | dir not listed: none | catalog id with no dir: none
       all 7 feature nodes: ok schema=work/feature id=<dir> catalogEntry=yes
ecom:  schema=work/catalog id=ecommerce-app entries(2): checkout, identity
       actual features/* dirs(2): checkout, identity
       entry->missing dir: none | dir not listed: none | catalog id with no dir: none
       all 2 feature nodes: ok
```

So the "add/remove entries to match reality" half of item 3 was a no-op: nothing to add, nothing to
remove. Both catalog ids are schema-correct — `work-catalog.schema.yaml`'s `id` says it "names the
product, not the repository" (`todo`, `ecommerce-app`), which is *not* the same fact as
`workspace.yaml project:` (`todo-app`, `ecommerce-app`). The `directory` pattern
`^features/[a-z0-9]+(?:-[a-z0-9]+)*$` is satisfied by all nine entries.

### `featureCatalog` path disagreement — verified, reported, schema file untouched

Three statements of one fact, and two of them are wrong about the trees:

```text
schemas/work-layout.yaml:118   featureCatalog: features/index.yaml
schemas/work-layout.yaml:160-161  "Its product catalog is features/index.yaml; every actual feature owns
                                features/<feature>/{business,architecture,ui,implementation,uat}/ as applicable."
schemas/source-layout.yaml:34   - path: .starciwork/features/index.yaml
schemas/source-layout.yaml:107  - The bound Work root is exactly <backend>/.starciwork and contains features/index.yaml.
schemas/work-catalog.schema.yaml:5  "The product catalog at .starciwork/index.yaml. …"
```

Reality: both trees carry the catalog at `.starciwork/index.yaml`; **`features/index.yaml` exists in
neither tree** (checked directly, and by full recursive walk). `findstr` for `features/index.yaml`
across `schemas/`, `scripts/`, `checks/`, `kernel/`, `docs/` finds it only in the two layout files
above — no executable anywhere reads that path, which is why the disagreement is invisible to the
gate: `check-example-work.mjs` exempts `work/catalog` by schema and never checks where the catalog
sits. Consequence for a reader: `work-layout.yaml`'s `shape` block calls itself "the executable form"
of the layout, yet following it literally means a tool would look for a catalog that does not exist
and find a tree with no catalog. The two layout lines should move to match `work-catalog.schema.yaml`
and reality; **not edited here per brief.**

Two further drifts noticed in the same file while doing this (schema-side, both out of scope,
neither touched):
- `work-layout.yaml:161` and `:408` still describe
  `features/<feature>/{business,architecture,ui,implementation,uat}/` — the nesting that the same
  file's `shape.familiesNote` declares retired in favour of the flat 15-family folders. The gate's
  `FAMILIES` set follows the flat form; the rules text is a second, contradictory copy.
- `work-layout.yaml:239` keeps `_local` as a workspace-root exception while `:96` says
  `.starciwork/_local` is retired and only an import source; neither tree has one today.

---

## 4. `_resources` / naming inconsistencies — flagged only (v7-3 owns those files)

- **Realm contradiction: already resolved by v7-3 during this lane, verified live here.**
  `_resources/identities/todo-app-demo/resource.yaml` now carries `realm: todo` and
  `_resources/environments/dev/resource.yaml`'s `keycloak-realm-ready` probe targets
  `http://localhost:8089/realms/todo`, with dated `# v7-3 (2026-09-19)` comments naming the evidence
  (`realm-todo.json` declares `"realm": "todo"`, `app-config.service.ts` defaults to `/realms/todo/…`,
  `integration.login.keycloak` names `/realms/todo/protocol/openid-connect/{token,userinfo}`) and the
  reason the old target could never go green. My earlier audit snapshot showed `/realms/todo-app` —
  that was the pre-v7-3 state; it is fixed, and consistently so.
- **Three product names circulate in the todo tree** (unchanged, and not this lane's files):
  catalog `id: todo`, `workspace.yaml id/project: todo-app` + be repository `name: todo-app`, and the
  impl directory segment `todo-app-backend`. **22 of 24** todo impl records sit under
  `impl/todo-app-backend/` while carrying `repository: todo-app` — a direct violation of
  `work-layout.yaml`'s impl shape entry ("`<repository>` is the exact value the record's own
  `repository` field names"), unchecked by the gate (v6-3 finding 12). The two
  `impl/todo-app-frontend/`-style dirs whose names do match their `repository` field verify as `ok`
  by that test; the ecom tree is fully consistent (`impl/ecommerce-app-be/` ↔
  `repository: ecommerce-app-be` ↔ workspace be name). Renaming the 22 dirs rewrites 22 ids plus every
  inbound `proves`/`provenBy`/`blockedBy` string and re-hashes 22 `recordDigest`s — that is
  cross-family record surgery owned by v7-1/v7-6, so I left it and measured it instead.
- **`_resources` id vs directory-name asymmetry**: `_resources/environments/dev/resource.yaml` carries
  `id: environment.todo-app.dev` — the directory is `dev`, the id embeds the project — while
  `identities/todo-app-demo/` → `identity.todo-app.demo` and `fixtures/todo-app-seed/` →
  `fixture.todo-app.seed` follow dir==id-suffix. One of the three conventions should move; v7-3's call.
- **ecom has no `_resources/` at all**, while its tree does carry two `work/integration` records
  (`integration.checkout.postgres`, `integration.checkout.redis`) and no `uat/` flow yet. Nothing is
  broken today — no dangling `environment`/`fixtures`/`accounts` edge exists to refuse (0 such
  refusals in the gate output) — but the moment the ecom live-proof lanes add a `uat-flow`, they owe
  an `_resources` custody that does not exist in that tree. Flagged for whoever boots ecom UAT.

---

## 5. What this lane could NOT prove, and why

1. **That the six payloads are accepted by the gate.** Not provable in-lane: the discriminator the
   walk would need is code in `scripts/check-example-work.mjs`, which the brief puts out of scope.
   Left as six verbatim refusals + the recommended one-line/two-line fix in §2 rather than faked away.
2. **That `DIRECTIONS.md`'s content belongs to a *record* rather than a payload.** The brief offered
   "move into a proper record **or** delete if stale prose". Neither branch was clean: it is not stale
   (§1), and folding its sampled-pixel table into five `work/ui-screen` records means inventing a field
   no ecom ui record has (they keep review prose inline under `ui.review.limits`), in files v7-10 owns
   and is actively editing. I chose the third sanctioned option — `<node>/assets/**` payload — which
   preserves every claim byte-for-byte and touches no other lane's record. If the owner wants it as
   record content instead, the move is now two files' worth of editing from a clean root.
3. **Whether the ecom direction assets are still live truth.** Re-hashed and green (§2), but v7-10 is
   recapturing; no claim here survives that run.
4. **`_derived/` freshness.** Not this lane's write. `node scripts/check-example-derived.mjs` after
   my edits, verbatim:
   ```text
   REFUSED …examples/ecommerce-app-be/.starciwork/_derived/index.yaml is missing or stale; run `node scripts/example-derive.mjs --work …ecommerce-app-be\.starciwork --write` to refresh it
   REFUSED …examples/ecommerce-app-be/.starciwork/_derived/critique.yaml or critique.md is missing or stale; run `node scripts/example-critique.mjs --work … --write` to refresh them
   REFUSED …examples/todo-app-backend/.starciwork/_derived/index.yaml is missing or stale; run `node scripts/example-derive.mjs --work …todo-app-backend\.starciwork --write` to refresh it
   REFUSED …examples/todo-app-backend/.starciwork/_derived/critique.yaml or critique.md is missing or stale; run `node scripts/example-critique.mjs --work … --write` to refresh them
   2 work tree(s) checked: 4 refused
   ```
   Both trees were re-derived by a concurrent lane at 11:33Z mid-lane and are stale again by the time
   this lane finishes (records moved 295 → 311 underneath it). **For v7-8:** the rebuild must run after
   `done/v7-5.done` and will now legitimately drop the five payload pseudo-records; a rebuilt index
   that lists any `*.assets` id again means a fake id came back.
5. **`BLOCKER_UNROOTED` (3 warned) and the recordDigest/CODE_DIGEST/render refusals** — other lanes'
   families; untouched.

## 6. Record ↔ code contradictions left unresolved by this lane

None inside my scope's files: the six payloads bind only to asset bytes under their own node
(verified 55/55), and `directions.md` describes generated images, not product code. The contradictions
I *found* and left in place are all schema↔schema or schema↔tree, because the fix target is a file
this lane must not edit: `featureCatalog` / `source-layout` vs `work-catalog.schema.yaml` vs the trees
(§3), the retired `business/architecture` nesting still in the rules text (§3), and the impl
directory↔`repository` rule violated by 22 todo records (§4).

## Files this lane wrote

Inside the trees:
- deleted `examples/todo-app-backend/.starciwork/business-rules/` (empty dir)
- `examples/ecommerce-app-be/.starciwork/DIRECTIONS.md` → `…/features/checkout/ui/landing-home/assets/directions.md` (link paths only)
- `…/features/checkout/ui/landing-home/assets/direction-check.yaml` (fake id removed, 2 references repointed)
- `…/features/checkout/ui/{cart,landing-home,shop-browse,stock-refused}/assets/generation-receipts.yaml`
  and `…/features/identity/ui/sign-in/assets/generation-receipts.yaml` (fake id removed)

Outside the trees: this report, `ex-testing/lint/done/v7-5.done`, and the scratch below.

Appendix — lane scratch (read-only evidence, safe to delete), full list as written by this lane:
`_v75-audit.mjs` / `_v75-audit.txt` / `_v75-audit-after.txt` / `_v75-audit.code` (roots, catalog↔dirs,
payload ids, `_resources`), `_v75-audit2.mjs` / `_v75-audit2.txt` / `_v75-audit2-after.txt` /
`_v75-audit2.code` (cross-tree reference search, impl dir↔repository, derived keys),
`_v75-fix.mjs` / `_v75-fix.txt` (the writer, with its assertions),
`_v75-diff.mjs` / `_v75-diff.txt` / `_v75-diff-final.txt` (refusal set attribution),
`_v75-payload-check.mjs` / `_v75-payload.txt` (digest re-verification),
`_v75-gate-baseline.txt` / `_v75-gate-after.txt` / `_v75-gate-final.txt` /
`_v75-gate-baseline.code` (the three gate runs + the exit-code marker proving the baseline run exited
nonzero on 134 refusals), `_v75-assets-lines.txt` / `_v75-idlines.txt` (per-run line extracts),
`_v75-derived.txt` (post-fix checker run), `_v75-derived-head.txt` (`HEAD`'s derived index, for the
`.assets`-key comparison in §2), `_v75-directions-head.md` / `_v75-docdiff.txt` (`HEAD`'s
`DIRECTIONS.md` and the line-by-line comparison), `_v75-d1.txt` / `_v75-d2.txt` /
`_v75-diffstat.txt` (per-file diffs of the reverted payloads), `_v75-gitstatus.txt` /
`_v75-example-status.txt` (working-tree context at lane start).
