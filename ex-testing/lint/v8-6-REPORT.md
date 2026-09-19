# v8-6 — `scripts/check-work-artifacts.mjs` (declared bytes vs disk)

Lane: v8-6 · Script: `scripts/check-work-artifacts.mjs` (570 lines) · Fixture: `tests/work-artifacts.spec.mjs` (14 tests)
Live run stamp: 2026-09-19 20:04:46 local, `ex-testing/lint/scratch/v86-run-a.txt` (36 kB,
SHA256 `e5a3efae5775626aa7895bd4713447fdae77d5980c0d571b70e387f146335b5a`, raw exit marker
`v86-exit-full.code` = `EXIT_NONZERO`). Repeat run 20:04:48 (`v86-run-b.txt`, marker `EXIT_NONZERO`) has the
**same SHA256**.

The base gate reads declarations. This script reads the bytes those declarations name: existence, size, the
magic number behind the extension, and the sha256 a record stamped on an artifact. It is read-only and wrote
**zero bytes under any `.starciwork` tree** — the only files this lane created are
`scripts/check-work-artifacts.mjs`, `tests/work-artifacts.spec.mjs`, this report, and
`ex-testing/lint/scratch/v86-*` evidence (`git status --porcelain` for those paths is in §7).

## 1. What it checks

Three tiers, inherited from `check-work-deep.mjs`: REFUSE / SUSPECT / INFO, each line suffixed `[CODE]`, each
tier sorted so two runs over an unchanged tree are byte-identical (proven: §9). The tier line is
**custody**: bytes the Work tree keeps for itself are refused when they are wrong, bytes it merely borrowed
(the source a direction was drawn from) are reported and not refused.

| Concept | Code(s) | Tier | The declaration and the disk it is measured against |
| --- | --- | --- | --- |
| 1. magic bytes | `ASSET_MAGIC` | REFUSE | every kept artifact's first bytes ↔ the format its extension claims (PNG signature, EBML for `.webm`, `ftyp` for `.mp4`, JPEG/GIF/WEBP); plus `provenance.toolOutputBasename`'s extension ↔ the kept asset's |
| 2. declared artifacts | `ASSET_MISSING` `ASSET_EMPTY` | REFUSE | `assets[].path`, `asset.path`, `ui.assets[].path` in any record, plus `generation.promptPath`, `ui.coverage.map[].directionAsset`, `ui.supersededDirection.path`, `ui.anatomyReview.reviewPath`, `ui.artworkSlots[].master.path`, evidence `assets[].path`, run-manifest `assets[].path` — exists, is a regular file, is > 0 B |
| 3. stamped digests | `ASSET_DIGEST` REFUSE · `ASSET_STAMP` REFUSE | REFUSE | each of those paths' sibling `sha256` (or a receipt's `promptSha256`) recomputed over the bytes on disk; `ASSET_STAMP` fires when the stamp is not a sha256 at all |
| 4. prompts | `PROMPT_MISSING` `PROMPT_EMPTY` REFUSE · `PROMPT_INPUT_GHOST` SUSPECT | as marked | every generated asset keeps its `.prompt.txt` (or the declared `promptPath`) beside it, non-empty; paths quoted on prompt *input* lines are looked up |
| 5. receipts | `RECEIPT_ORPHAN` | REFUSE | `generation-receipts.yaml` `calls[].artifact`/`prompt` must be the bytes the receipt hashed; a `toolOutputBasename` whose extension disagrees with the artifact it was renamed into is the renamed-fake shape (see §2.4) |
| 6. evidence ghosts | `EVIDENCE_ARTIFACT_GHOST` | REFUSE when the settled run's directory is absent · SUSPECT when a declared *input* is | `evidence.yaml run:` names a directory that exists; its `assets[]` files are refused when missing, its `directionReview.anatomySources[].path` and `ui.provenance.*.path` inputs suspected |
| 7. run media | `RUN_MEDIA_FAKE` | REFUSE in the settled run, SUSPECT in a historical one | `runs/<id>/videos/*` ≥ 10 KB, `runs/<id>/screens/*.png` ≥ 5 KB, each with the magic its extension claims |
| 8. uat resources | `RESOURCE_FILE_MISSING` | REFUSE | `uat-flow accounts:` file, and a `work/resource`'s own repo files (`target.compose`, `configuration.renderedFrom`/`rendered`, `schemaFiles[]`, `seedFiles[]`, `custody.sealed`) |
| 9. parent claims | `FEATURE_DONE_INCOMPLETE` | REFUSE | a `work/feature`/`work/catalog` with `state: done` over members that are not done, or whose members' artifacts failed concept 2/3 |
| 10. moved inputs | `INPUT_BYTES_MOVED` | SUSPECT | the `sha256` a ui record stamps on the record/knowledge/source file it was drawn from |

Runnable standalone: `node scripts/check-work-artifacts.mjs` (both example trees, the discovery line
`walk(examples) → */.starciwork/index.yaml` is copied from `check-example-work.mjs`) or
`--tree <path>` for one `workRoot`; exit 1 on any REFUSE. Exported as `checkWorkArtifacts(workRoot, out)`
with `out = {refuse, suspect, info}` — the same shape `checkWorkTree(workRoot, problems, warnings)` has, so
the fixture can point it at a throwaway tree.

**How to extend it.** Add one row to the table that owns the shape you want read: `RECORD_DECLARATIONS` (a
field on an `index.yaml` record), `EVIDENCE_DECLARATIONS`, `RECEIPT_DECLARATIONS`, `MANIFEST_DECLARATIONS`,
or `RESOURCE_DECLARATIONS`. A row is `{trail, base, what, digestKey}` — `trail` names the field path with `[]`
folded onto whichever segment is a list and `*` standing for one dynamic segment (`ui.provenance.*.path`
covers `provenance.brand.path` and `provenance.business[].path` alike); `base` is `record`, `repo`, `run` or
`named-record` and only matters for a short path, because a value written from a root resolves from that root
first; `what` decides the tier (`input` suspects, everything else refuses); `digestKey` names the sibling that
holds the stamp, or `null` to check existence without comparing bytes. Then add a fixture test in
`tests/work-artifacts.spec.mjs` that shows the refusal firing on a broken tree and *not* firing on the same
tree with correct bytes — the second half is what keeps a new rule from crying wolf, and §6 is what happens
when it does.

## 2. Design decisions

**2.1 The tier line is custody, not severity preference.** A record's own `assets[]` entry is a claim about
bytes the Work tree keeps; `ui.provenance.brand.path` is a claim about bytes somebody else keeps. Both are
verified the same way, and the second one is reported as SUSPECT (`INPUT_BYTES_MOVED`) even when the digest
disagrees, because the Work tree can re-stamp its own artifact but cannot make `knowledge/` stop moving.
Measuring this mattered: at the stamped run the literal reading (refuse every digest gap) puts 64 findings on
the trees, 34 of them about bytes the tree borrowed and does not own; the custody line leaves 30 refusals, all
of them inside Work custody.

**2.2 A run manifest is an artifact of its node, not a record.** `loadRecords()` takes any `.yaml` with an
`id`, and `manifest.yaml` carries `id: uat.task.create.runs.<id>` + `schema: starci/uat-run-manifest@1`, so
manifests entered the record map and every one of their declarations was reported twice — once with the
label `<run>/index.yaml`, a file that does not exist. The record pass now handles `work/*` schemas only and
the manifest/receipt/evidence passes handle the rest, each with the directory its paths are actually
relative to. Same reading `check-work-deep.mjs` reports as `PAYLOAD_AS_RECORD`.

**2.3 Path resolution is value-first.** A declaration written out from a root (`examples/…`, `knowledge/…`,
`.starcistacks/…`) is its own address and resolves at the skill root or the repository root; a short path
(`assets/x.png`) needs the base its shape declares — the node dir, the run dir, or, for
`ui.artworkSlots[].master`, the record it names: `{record: brand, path: assets/turtle-master.png}` is the
brand's bytes, not a copy under the ui node. `ui.artworkSlots` is the *only* shape in either tree that uses
the relocation, and it was the only place the base gate cannot see: `brand` is not a `FAMILIES` prefix, so
that ref is invisible to `refFieldNames` resolution.

**2.4 `toolOutputBasename` is provenance of a rename, and refusing it is a wolf cry.** The brief reads
"receipts naming bytes that aren't there → REFUSE". Measured first: `knowledge`-style census in
`v86-explore.txt` and `v86-media.txt`, then a glob for `examples/**/exec-*` → **0 files**. All 12 basenames
in all 5 receipt files (`exec-4f0ee36a-….png` etc.) name the tool's own scratch output, which the author
copied to `assets/<asset>.png` and recorded as `postProcessing: None`. A literal existence check refuses
12/12 = a 100 % false-positive rate that teaches whoever runs the gate to ignore it. What is refused instead
is the claim that *can* hold: the receipt's `artifact`/`prompt` must be on disk and must hash to the digest
the receipt stamps (that check passes on all 12 live calls — §4), and the basename's extension must agree
with the artifact it was renamed into, which is exactly the "0-byte file renamed `.webm`" incident.

**2.5 `ui.supersededDirection.sha256` is a historical value, so it is not byte-compared.** Seven live records
stamp the digest the *retired* raster had, on the path that now holds the newer revision — the two can never
both describe today's bytes. `features/task/ui/list`: `supersededDirection` says `c7dd5800…`, `assets[]` says
`1451e635…`, and the file on disk hashes `1451e635…` (and so does its committed blob). The path is still
checked, the digest deliberately is not, and a test guards the choice (§9). This was found by measuring, not
by reading the schema: it was 7 of the first run's 37 digest refusals.

**2.6 The declared-path population is an allow-list, and the exclusions are the point.** A "any string with a
dot" sweep refuses record ids (`fr.plan.usage.view` reads as a `.view` file), versions (`0.4.13`), module
*directories* (`owners[].path`, already `OWNER_PATH_MISSING` in the base gate), and the command strings in
`provenance.tool` (`npx jest -t … (fixtures uat/fixtures/…)`) — measured in `v86-explore.txt`: 8 of 174
`inputRefs` values are ids, not paths. `looksLikeFilePath` therefore requires a known file extension, no
whitespace, no glob, no URL scheme and no `FAMILIES` id shape; the tables then name which shapes are read at
all. `ui.assets[].provenance.promptExample.originalLocation` (`../ex-draw-v4/gen-lab/out/B3-final.txt`) is
excluded on purpose: it records where a file came from before it was retained inside the tree.

**2.7 The media floors are measured, not guessed.** Smallest committed artifact on this lane's 19:07 scan
(`v86-media.txt`): a 10,186 B screenshot and a 41,771 B `.webm`; the direction rasters run 0.4-2.3 MB.
Floors sit at 5,000 B / 10,000 B — under every genuine artifact, far above a stub, and stated in the code so
the next reader can re-measure them. The size floor is refused only in the run an `evidence.yaml` settled on
and suspected in the historical runs beside it; magic bytes are refused in every run, because a placeholder
is a placeholder whatever attempt it sits under.

**2.8 Clean zeros announce their census.** `_common.md`: "a zero that means 'nothing was looked at' must say
so." Each tree prints a `BYTE_CENSUS` INFO line with what it opened — see §4 — so a code with no findings can
be read as "N candidates, none matched".

## 3. What fired on the live trees (and what it means)

```
313 record(s) over 2 tree(s): 843 declared path(s) (821 opened on disk, 400 hash-compared against a stamped
sha256), 60 run media file(s) read across 13 run declaration(s), 36 prompt file(s), 5 receipt file(s) binding
12 call(s), 120 evidence file(s) - 36 refused, 52 suspect, 6 info
findings by code: INPUT_BYTES_MOVED=34, ASSET_DIGEST=30, EVIDENCE_ARTIFACT_GHOST=16, ASSET_MISSING=6,
                  PROMPT_INPUT_GHOST=2
```

Per tree, from separate runs at the same build: `--tree examples/todo-app-backend/.starciwork` → 36 refused /
22 suspect, raw exit `EXIT_NONZERO` (`v86-tree-todo.txt`, `v86-exit-todo.code`);
`--tree examples/ecommerce-app-be/.starciwork` → **0 refused** / 30 suspect, `EXIT_ZERO`
(`v86-tree-ec.txt`, `v86-exit-ec.code`). All 36 refusals are in `todo-app-backend`; every ecommerce finding is
about a borrowed byte, which is the tier that tree has not yet broken. `INPUT_BYTES_MOVED` grew 27 → 34
between this lane's own runs an hour apart - the borrowed-bytes class is the moving one.

**`ASSET_MISSING` — 6 refusals, all run manifests naming a video the run folder does not hold**
(`v86-run-a.txt`). Each of these `manifest.yaml` files declares
`assets: [{path: videos/<flow>.webm, sha256, size}]` (the first one: 154,839 bytes of `sign-in.webm`) while
the run has no `videos/` directory at all
— the `screens/*.png` entries in the same list all resolve, so it is the recording alone that is fictional.
What makes this worth a refusal is the `outcome:` each of those manifests also carries:

| Run | Declared outcome | Ghost asset |
| --- | --- | --- |
| `features/login/uat/sign-in/runs/20260918T061141Z-af3dfbbc` | `partial-pass` | `videos/sign-in.webm` |
| `features/login/uat/sign-in/runs/20260918T070052Z-b037b5fe` | `partial-pass` | `videos/sign-in.webm` |
| `features/login/uat/sign-in/runs/20260918T080854Z-f7ab26f0` | `fail` | `videos/sign-in.webm` |
| `features/login/uat/sign-in/runs/20260918T090054Z-240aa95e` | **`pass`** | `videos/sign-in.webm` |
| `features/task/uat/create/runs/20260918T080854Z-f7ab26f0` | `fail` | `videos/create.webm` |
| `features/task/uat/create/runs/20260918T090054Z-240aa95e` | **`pass`** | `videos/create.webm` |

Two of the six claim `outcome: pass` about a run whose recording the tree does not have. The base gate's
concept-12 media check looks only at the run the *current* evidence settled on, so a stale `pass` ledger entry
in the history folder is invisible to it — and "no uat run has executed this flow" blockers elsewhere in
these trees are argued from exactly those historical runs. That is the "reads as proven and is not" shape this
lane was written for, and it is why the run sweep refuses existence and magic in *every* run while reserving
the size floor for the settled one.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/uat/sign-in/runs/20260918T061141Z-af3dfbbc/manifest.yaml: assets[].path names artifact videos/sign-in.webm, which is not on disk under features/login/uat/sign-in/runs/20260918T061141Z-af3dfbbc run dir - declared bytes are not there [ASSET_MISSING]
```

**`ASSET_DIGEST` — 30 refusals across three files, and the git evidence says two different stories.**

| File | n | What moved |
| --- | --- | --- |
| `features/login/impl/todo-app-frontend/sign-in/index.yaml` | 16 | 8 `assets/*.png` + 8 `assets/*.html` |
| `features/recur/impl/todo-app-frontend/schedule/index.yaml` | 9 | 8 `assets/running-page-*.png` + `assets/capture.mjs` |
| `features/task/ui/list/evidence.yaml` | 5 | `list-many-tasks.png`, `list-many-tasks.prompt.txt`, `visual-review.md`, `direction-check.txt`, `verify-direction.mjs` |

For the first two, the *committed* blob matches the record's stamp and the working tree does not — a
concurrent lane is re-capturing screenshots right now. Verified on `sign-in-empty-desktop-1280.html`:
HEAD's blob is 13,531 B hashing `a4292a47…` = exactly the record's `sha256`; the file on disk is 24,746 B
hashing `aa949a73…`, and `git status` shows the asset as `M`. Between this lane's 19:07 and 19:24 scans,
`running-page-no-rule-desktop.png` changed size from 42,549 B to 333,854 B. The refusal is correct about
the snapshot (the record describes bytes that are no longer there) and belongs to the capturing lane to
resolve — re-stamp or land the capture. It is *not* evidence of authored dishonesty, and the report says so
rather than softening the finding to hide someone else's in-flight work.

For `features/task/ui/list/evidence.yaml` the gap is older: HEAD's `list-many-tasks.png` hashes
`1451e635…`, which is what `index.yaml` stamps, while `evidence.yaml` stamps `9bf10368…` for the same path.
Two committed declarations disagree about one file, so at least one of them has never described the bytes it
names. That is the incident class this lane exists for, and it is the strongest finding here.

**Post-stamp drift, and it argues the point.** This lane's verification run six minutes after the stamp
(`v86-run-c.txt`, 20:11:02) reports 31 refused, not 36: all five `features/task/ui/list/evidence.yaml` lines
are gone, because that file was re-stamped in the meantime. Nothing in the fleet told whoever did it that the
stamps were wrong - the check that found them is un-wired and unknown to the other lanes, which is exactly
§5's request. The stamped figures stay as printed above; the 31 refusals left in `v86-run-c.txt` are the
login/recur re-capture class plus the six ghost videos.

```
REFUSE  examples/todo-app-backend/.starciwork/features/login/impl/todo-app-frontend/sign-in/index.yaml: assets[].path stamps artifact assets/sign-in-empty-desktop-1280.png as 384ccde5315c8934cc83df9b0d8a052a38eac0173a4fcbae6c0f2d25eaa64750, but the 1093835 bytes on disk hash to d6923be5cee517df4fd9908f09d6f251a9cd976070b7d9dbd749cafd7b73bd13 - the bytes on disk are not the bytes this declaration names [ASSET_DIGEST]
REFUSE  examples/todo-app-backend/.starciwork/features/recur/impl/todo-app-frontend/schedule/index.yaml: assets[].path stamps artifact assets/capture.mjs as 79c933efce7f979bbd7c9a020d0b0cd966a824d698bdb5637ef7bec008816f6c, but the 8282 bytes on disk hash to c94e396e4877406470ba9de295d58e311893223ddd40b236e103294824966087 - the bytes on disk are not the bytes this declaration names [ASSET_DIGEST]
```

**`EVIDENCE_ARTIFACT_GHOST` — 16 SUSPECTs over 11 distinct paths, one cause: the frontend moved and the Work
records did not.** Every one is an ecommerce `ui.provenance.frontendContext[].path` (cart 4, shop-browse 5,
landing-home 2, stock-refused 4, identity/sign-in 1), and 16 of the 20 such declarations in the tree do not
resolve. Two shapes, both verified against `examples/ecommerce-app-fe`:

- routes and layout: the records name `apps/shop/src/app/<route>/page.tsx`; the files are
  `apps/shop/src/app/[lang]/<route>/page.tsx` (same for `app/layout.tsx` and for `apps/landing`) — a
  `[lang]` segment the declaration never learned;
- components: the records name `src/components/{AppNav,ProductTile,SiteHeader}.tsx`; no such file exists
  anywhere in the app. The tree is now folder-per-component — `src/components/layouts/ShopLayout/index.tsx`,
  `src/components/pages/{CartPage,BrowsePage,AccountPage,CheckoutPage,ShopRootPage}/index.tsx`.

`scripts/work-remap-path.mjs` (v8-5) is the tool for the first shape and `check-work-surfaces.mjs`'s (v8-2)
`UI_ROUTE_GHOST` should meet the second from the code side; the byte layer sees both first because it only
has to `existsSync` a declaration.

```
SUSPECT examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/index.yaml: ui.provenance.*.path names input examples/ecommerce-app-fe/apps/shop/src/app/cart/page.tsx, which is not on disk under the skill root - a declared input the Work tree does not keep [EVIDENCE_ARTIFACT_GHOST]
```

**`INPUT_BYTES_MOVED` — 34 SUSPECTs over 20 distinct inputs.** `brand/index.yaml` (stamped by 7 todo ui
records), `knowledge/ui/proof/anatomy-source.yaml` (5 ecommerce ui records, all carrying the same retired
digest), `features/checkout/fr/place-order/index.yaml` (4), the frontend's `catalog.ts`/`config/index.ts`/
`identity.ts` (4), and 12 todo `fr`/`br`/`sds` records stamped by the ui records that were drawn from them.
The pattern is a *record's* edit invalidating the
digest another record holds of it — the `recordDigest` refusal the base gate already raises for
`evidence.yaml` (`check-example-work.mjs` concept 10), extended to `index.yaml` declarations the base gate
never reads. This class is also the one that moves fastest: it was 27 lines an hour before the stamped run.

**`PROMPT_INPUT_GHOST` — 2 SUSPECTs.** `recur/ui/schedule/assets/schedule-refused.anatomy-initial.prompt.txt`
and `task/ui/list/assets/list-many-tasks.anatomy-initial.prompt.txt` declare "the supplied grammar-reference
PNGs below are ACTUAL component renders and are the binding anatomy source" and then name
`brand/assets/grammar-reference/{app-shell,sign-in-card,task-composer,task-list,buttons,inputs}.png`. None of
those six exist — the dir holds only `empty-state.png`, `primitives.png`, `sign-in-screen.png`,
`tasks-screen.png`. The records' own `referencedImages` (31 values) all resolve, so this is a gap between
what the prompt says it was fed and what custody kept, which is why it is a SUSPECT over prose rather than a
refusal over a field.

## 4. What came back clean, and how much was actually opened

Straight from the two `BYTE_CENSUS` lines in `v86-run-a.txt` - the script prints what it opened, not only
what it flagged, so every zero below carries its own denominator:

```
INFO examples/ecommerce-app-be/.starciwork/index.yaml: 262 declared path(s) resolved, 246 of them opened on disk and 114 hash-compared against a stamped sha256 (130 declarations carried one); 0 run folder(s) read for media magic and size (0 files); 12 prompt file(s) read; 12 generated asset(s) owed a prompt; 5 receipt file(s) binding 12 generation call(s); 2 uat accounts file(s) looked for [BYTE_CENSUS]
INFO examples/todo-app-backend/.starciwork/index.yaml: 581 declared path(s) resolved, 575 of them opened on disk and 286 hash-compared against a stamped sha256 (292 declarations carried one); 11 run folder(s) read for media magic and size (60 files); 24 prompt file(s) read; 18 generated asset(s) owed a prompt; 0 receipt file(s) binding 0 generation call(s); 7 uat accounts file(s) looked for [BYTE_CENSUS]
```

| Code | Live findings | Candidates, from the census | Reading |
| --- | --- | --- | --- |
| `ASSET_MAGIC` | 0 | 821 declared files + 60 run media files = 881 head reads | every committed raster opens with `89504e470d0a1a0a` and every recording with `1a45dfa3`; the renamed-fake shape is not present on today's trees, and the fixture proves the rule catches it when it is |
| `ASSET_EMPTY` | 0 | same 881 files | no 0-byte placeholder among what the declarations name |
| `ASSET_STAMP` | 0 | 422 stamped declarations | all are 64-hex digests - but see §6.3: a non-hex stamp used to be *skipped* silently, until the fixture caught it |
| `ASSET_DIGEST` | 30 refused · 34 suspected | 400 stamps actually hash-compared; of the other 22 stamped declarations, an earlier test in the same chain decided first (absent, not a file, 0 bytes, or wrong magic) | 30 of the tree's own bytes moved out from under their stamp; 34 borrowed inputs did the same |
| `PROMPT_MISSING` | 0 | 30 generated assets owed a prompt | each one's `promptPath` (or `<asset>.prompt.txt`) is beside it |
| `PROMPT_EMPTY` | 0 | 36 prompt files read | all non-whitespace |
| `RUN_MEDIA_FAKE` | 0 | 11 run folders, 60 media files | the two settled runs (`uat.login.sign-in` on `runs/20260918T174721Z-023dd8d9`, `uat.task.create` on `runs/20260919T112844Z-5c10a673`) clear both floors with real EBML/PNG bytes; no run holds a stub |
| `RECEIPT_ORPHAN` | 0 | 5 receipt files, 12 generation calls (24 of their declarations are hash-compared) | all 12 artifacts and prompts exist and hash to what the receipt stamped; no `toolOutputBasename` disagrees with its artifact's extension |
| `RESOURCE_FILE_MISSING` | 0 | 9 `accounts:` declarations (7 todo + 2 ecommerce) + 3 `work/resource` file sets | the base gate's `if existsSync` gap is closed and nothing falls through it today |
| `EVIDENCE_ARTIFACT_GHOST` (run dir) | 0 | 13 run declarations over 11 distinct folders | every `evidence.yaml run:` names a directory that exists |
| `FEATURE_DONE_INCOMPLETE` | 0 | 10 parent records (8 todo, 2 ecommerce) | **latent**: no parent in either tree carries `state` at all (§6.1), so the rule cannot fire yet |

## 5. The bug this found for the fleet

**Stamped digests have no re-stamp path, and 30 of the 400 stamps this run hash-compared (7.5 %) no longer
describe their bytes.** The declaration is written once — by `scripts/example-evidence.mjs` or by hand — and
nothing compares it afterwards. `example-evidence.mjs` is the closest thing to a re-stamp path
(`recordStaleEvidence`, lines 183-192, calls `stampedRecord()` which re-reads the file), but it runs only for
the files *it* seals, and only when an evidence run is recorded; the `assets[].sha256` on a
`work/implementation` record's `index.yaml` is not in its reach at all.

So the fleet has an asymmetry: `evidence.codeDigest` freshness is guarded by the gate — 71 `CODE_DIGEST_STALE`
refusals on the base gate at both of this lane's stamps — while the byte stamps on the artifacts that same
evidence names are unguarded, and the ones inside `index.yaml` are doubly so. Concretely what a fix needs, in
rough order of cost:

1. Wire `check-work-artifacts.mjs` into the gate composition the way `check-work-deep.mjs` is wired, so a
   re-capture that forgets its stamp fails loudly instead of silently.
2. Give the writer the mirror of `CODE_DIGEST_STALE`: when a capture rewrites an asset, re-stamp every
   `assets[].sha256`/`promptSha256` that names it, in both `index.yaml` and `evidence.yaml`. Today's
   evidence for why: `features/task/ui/list` carries two different digests for the same file in one node.
3. Decide what a *historical* run manifest means. Two of the six ghost-video runs declare `outcome: pass`
   (§3) - either the recording is retained, or the manifest stops listing it, or a pruned asset is marked
   pruned instead of carrying a sha256 and a byte count. Those 6 refusals are waiting on that decision, not
   on a fix.

## 6. False positives found and fixed, with measured rates

1. **`FEATURE_DONE_INCOMPLETE` cannot fire on this layout yet.** No `work/feature`/`work/catalog` record in
   either tree carries `state` (`features/task/index.yaml` is 4 lines: schema, id, title, description), so
   the rule is latent and says so in `PARENT_STATE_UNUSED` rather than reporting a clean 10 parents as a
   pass. It is implemented and fixture-proven for the day a parent does claim done.
2. **The first working run refused 97 lines; 61 of them no longer refuse, and every reason is named.** Kept as
   `v86-run1.txt` (97 refused / 74 suspected: `EVIDENCE_ARTIFACT_GHOST=72, ASSET_DIGEST=57,
   ASSET_MISSING=40, PROMPT_INPUT_GHOST=2`), `v86-run2.txt` (43/45) and the stamped run (36 refused / 52
   suspected). Each reduction is named, not smoothed over:
   - **duplicate + mislabelled manifest declarations** — every run-manifest line appeared twice, once
     labelled `<run>/index.yaml`, a file that does not exist (§2.2);
   - **~34 phantom `ASSET_MISSING`** — host-relative values (`ui.supersededDirection.path`,
     `directionReview.anatomySources[].path`, `ui.artworkSlots[].master.path`) resolved under the node dir
     instead of the root they name, so files that exist looked absent (§2.3);
   - **7 wrong `ASSET_DIGEST`** — the superseded-direction stamps, which describe retired bytes (§2.5);
   - **27 digest gaps moved out of the refusal tier** — they name borrowed bytes, which the Work tree cannot
     make stop moving (§2.1); they are still reported, as `INPUT_BYTES_MOVED`.
   What is left refusing is what a fix has to address. Each of the four causes now has a test.
3. **A falsy stamp was a silent pass.** `sha256: 0000…` is not a hex digest to the YAML reader, it is the
   number `0`, and `if (!found.digest) return` skipped it — verified against `core/yaml.mjs`
   (`parseYaml('sha256: ' + '0'.repeat(64))` yields the number 0). Now `ASSET_STAMP` refuses any stamp that
   is not 64 hex characters, so a malformed digest is a finding instead of a hole.
4. **CRLF was ruled out as the explanation before believing it.** `.gitattributes` says `* text=auto
   eol=lf` with `*.png binary`, so a checkout-normalisation artifact was the benign hypothesis for the 30
   digest refusals. Measured (`v86-crlf.mjs`): the mismatched `.html` and `.prompt.txt` files contain no
   carriage returns at all, and their raw and LF-normalised digests are identical — and neither equals the
   stamp. The hypothesis is dead; the gaps are real byte drift.

## 7. Gate verification (the fleet's trees move under every run)

`node scripts/check-example-work.mjs` checks both trees in one run and the v7 lanes are live in them, so a
total is not evidence about this lane. Both runs are kept and the refusal lines are compared as sets
(`ex-testing/lint/scratch/v86-diff.mjs`, the `_v75-diff.mjs` precedent):

| | stamp | summary line | refusal mix |
| --- | --- | --- | --- |
| before the first write | 19:07:47 | `311 record(s), 2505 ref(s), 120 evidence file(s): 152 refused, 4 warned` | 71 `CODE_DIGEST_STALE`, 51 `RENDER_CHECK_FAILED`, 24 `recordDigest …`, 4 `BLOCKER_UNROOTED`, 2 other |
| intermediate | 19:44:43 | `313 record(s), 2510 ref(s), 120 evidence file(s): 128 refused` | 71 `CODE_DIGEST_STALE`, 23 `RENDER_CHECK_FAILED`, 28 `recordDigest …` |
| after the last write | 20:14:48 | `313 record(s), 2661 ref(s), 120 evidence file(s): 89 refused` | 41 `CODE_DIGEST_STALE`, 23 `RENDER_CHECK_FAILED`, 23 `recordDigest …` |
| closing run, after the report | 20:22:19 | `313 record(s), 2661 ref(s), 120 evidence file(s): 67 refused` | 26 `CODE_DIGEST_STALE`, 19 `RENDER_CHECK_FAILED`, 16 `recordDigest …` |

**Read the totals as a trend, not as this lane's result:** 152 → 128 → 89 → 67 refusals across 75 minutes, with
`CODE_DIGEST_STALE` falling 71 → 26. A fleet-wide re-stamp sweep is running through the same trees while this
lane measures byte drift, and the delta vs the 19:07:47 baseline is now **+30 / −119 lines**. None of it is
attributable here - this lane wrote no tree file - but it does mean the counts in §3-§4 are a snapshot of a
tree being repaired under the check.

Set delta, before → after-the-last-write (`v86-gate-diff-last.txt`): **101 lines only in before** — 47
`RENDER_CHECK_FAILED`, 31 `CODE_DIGEST_STALE`, 19 `recordDigest …`, 4 `BLOCKER_UNROOTED`; **34 lines only in
after** — 18 `recordDigest …`, 15 `RENDER_CHECK_FAILED`, 1 `CODE_DIGEST_STALE`. Every one of the 135 lines
names a file this lane never opened, and the shape of the churn is other lanes' work: capture PNGs being
re-captured (which is what moves this lane's `ASSET_DIGEST` refusals, §3), code digests being re-stamped
(71 → 41 stale lines while this lane ran), and records edited under each other's `recordDigest`. Two records
appeared (311 → 313), the ref count grew by 156, and 4 `WARN` lines went away mid-lane. This lane's write
set, complete:

```
$ git status --porcelain scripts/check-work-artifacts.mjs tests/work-artifacts.spec.mjs ex-testing/lint
?? ex-testing/lint/
?? scripts/check-work-artifacts.mjs
?? tests/work-artifacts.spec.mjs
```

One hazard worth the coordinator's attention: an attempt shortly before the 19:44:43 run **crashed** the base
gate — `Error: Invalid or unsupported YAML` from `core/yaml.mjs:7370` via `check-example-work.mjs:75`, i.e. a
torn read of a tree's top-level `index.yaml` while a lane rewrote it. Both catalogs parsed cleanly when checked
immediately afterwards, and the retry produced the row above. `check-example-work.mjs` has no per-file
resilience for that path (it has one for records, via `try { data = parseYaml(...) } catch { continue }`), so
one torn write takes the whole gate down without naming the file.

## 8. What it does not check, and who owns it

| Excluded | Why, and where it belongs |
| --- | --- |
| `evidence.codeDigest.files[].path` (2,284 values) and repository freshness | `check-example-work.mjs` re-hashes the owned dirs and refuses `CODE_DIGEST_STALE`; the census says how many files here carry one (73 of 107 todo, 8 of 13 ecommerce). Stated in `CODE_DIGEST_NOT_MINE` INFO |
| `owners[].path`, `module`, `composes[].module` | module *directories*, resolved by `scripts/example-ownership.mjs resolveOwnedDirs` and refused by the base gate as `OWNER_PATH_MISSING` |
| `brand.sources[].path`, `brand.grammar.inspectedFiles[].path`, `brand.color.tokens[].source.path` | 41 values measured, 31 resolve against the frontend repository root or a `node_modules` that this checkout has not installed; a base rule for them needs the brand record to name its repository. Belongs to a brand-custody lane, and the measurement is in `v86-explore.txt` so nobody re-derives it |
| `provenance.tool`, `decryptWith`, `command`, `*.import`, `promptExample.originalLocation` | command strings and package specifiers, not tree paths; `check-work-replay.mjs` (v8-1) owns liveness of the commands |
| `runs/<id>/result.md` contents, ledger round-trip | `check-example-work.mjs` (`LEDGER_*`) and v8-1's replay lane |
| prose lines in a prompt that do not claim an input | `PROMPT_INPUT_GHOST` mines only input lines (§3) |
| writing anything back | this lane is read-only; re-stamping is `example-evidence.mjs`'s job (§5.2) |

## 9. Commands and evidence

```bash
node scripts/check-work-artifacts.mjs                          # both trees: 36 refused, raw exit marker EXIT_NONZERO
node scripts/check-work-artifacts.mjs --tree examples/ecommerce-app-be/.starciwork   # 0 refused, EXIT_ZERO
node --test tests/work-artifacts.spec.mjs                      # 14 tests, 14 pass, EXIT_ZERO
node --test tests/example-work-gate.spec.mjs tests/work-artifacts.spec.mjs   # 37 tests, 37 pass
npm test                                                        # 2190 tests, 1908 pass, 273 fail (see below)
```

Determinism: two consecutive full runs are byte-identical (`v86-run-a.txt` = `v86-run-b.txt`,
SHA256 `e5a3efae…`, both markers `EXIT_NONZERO`), because each tier is sorted before printing.

Test selection was checked, not assumed (`tests/*.spec.mjs` runs real `node:test`, and the tally is
`tests 14 / pass 14 / fail 0` in `v86-tests.txt`, marker `EXIT_ZERO`).

`npm test` exits nonzero and this lane did not make it so: 273 failures across 46 spec files, none of them
`work-artifacts.spec.mjs` (its 14 tests pass *inside* the full run), and the failure text is environmental
plus pre-existing — 30 disk-space errors while copying example `node_modules` into `C:\Users\…\Temp` (C: had
10.3 GB free at the time) and `Runtime payload is missing static dependency
hosts/headless/host.mjs -> ../../model/index.mjs` in `build-entry`/`npm-package`/`public-package`. The last
is not this lane's either: `hosts/headless/host.mjs:7` really does import `../../model/index.mjs`,
`model/index.mjs` really exists, `scripts/runtime-modules.txt` has no entry for it, and
`git status --porcelain hosts model scripts/runtime-modules.txt core` is empty — the gap is committed.

Evidence kept (`ex-testing/lint/scratch/`, all `v86-*`; every `.txt` has its `.code`/`.flag` exit marker
beside it, per this host's habit of hiding real exit codes behind wrapper zeros):

- gate: `v86-gate-before.txt` (19:07:47), `v86-gate-final.txt` (19:44:43), `v86-gate-last.txt` (20:14:48),
  `v86-gate-diff-final.txt`, `v86-gate-diff-last.txt`, differ `v86-diff.mjs`;
- this script: `v86-run1.txt` (first working run, 97 refused), `v86-run2.txt`, `v86-run3.txt` (the
  superseded-direction fix), `v86-run-a.txt` (the stamp), `v86-run-b.txt` (determinism repeat),
  `v86-run-c.txt` (post-stamp verification), `v86-tree-todo.txt`, `v86-tree-ec.txt`;
- tests: `v86-tests.txt`, `v86-pack-specs.txt`, `v86-npm-test.txt`;
- the measurement passes written before any rule was implemented: `v86-explore.mjs`/`.txt` (which declared
  path shapes exist and how they resolve), `v86-media.mjs`/`.txt` (size + magic census over every kept
  artifact and run media), `v86-digests.mjs`/`.txt` (every `{path, sha256}` pair in both trees compared to
  disk), `v86-crlf.mjs` (the line-ending hypothesis, disproved).

## 10. Open items

1. **The 25 login/recur refusals are another lane's in-flight re-capture.** Whoever lands those captures owes
   the records their new stamps; if instead the working-tree bytes are noise to be reverted, the refusals go
   away by themselves. The five `features/task/ui/list/evidence.yaml` lines - the ones that disagreed with
   the *committed* bytes, not merely with a working tree - were re-stamped by another lane at 20:11 while
   this report was being written, which is the §5 asymmetry resolved by hand once somebody happened to look.
2. 16 ecommerce `frontendContext` ghosts are a `[lang]` path remap: `scripts/work-remap-path.mjs` (v8-5) can
   rewrite them, and `check-work-surfaces.mjs` (v8-2) should catch the same event from the route side. Not
   fixed here: `.starciwork` and the frontend tree are outside this lane.
3. The six grammar-reference anatomy PNGs the prompts name are missing from custody. Either they should be
   retained (the prompts call them "the binding anatomy source") or the prompt text should stop claiming
   they were supplied. That is an authoring decision, so it is a SUSPECT, not a refusal.
4. **Six run manifests declare a recording that is not there, two of them under `outcome: pass`** (§3). Either
   the video is restored, or the manifest stops listing it, or pruned assets get a shape that says "pruned"
   instead of a sha256 and a byte count. This is the finding to hand a lane that may touch `uat` history.
5. Nothing wires this script into a gate run yet — lane ownership allowed exactly one new script file, and
   `checks/` was not this lane's to touch. §5.1 is the proposal.
