# Lane v7-8 — REPORT: `_derived/` rebuild, both trees (Phase 2)

Date: 2026-09-19. Scope: `_derived/**` in `examples/todo-app-backend/.starciwork` (todo-be) and
`examples/ecommerce-app-be/.starciwork` (ec-be). Read `_common.md` (fully — see the caveat in
"Notes"), `v6-3-REPORT.md` and `v6-4-REPORT.md` first, as instructed.

**Files this lane wrote: 8, all inside `_derived/`** — `index.yaml`, `frontier.md`,
`critique.yaml`, `critique.md` in each of the two trees. **Zero records, zero evidence files,
zero product source files were edited**, in either tree. Everything else under
`ex-testing/lint/` in this report's support of it is scratch.

---

## 1. Phase-1 wait — honored, no timeout fallback used

`ex-testing/lint/done/` was **empty** when the lane started. Poll loop: 60 s interval,
90-min budget, log at `ex-testing/lint/scratch/v7-8-wait.log`.

| event | time |
| --- | --- |
| wait began | 18:22:40 (0/5) |
| first phase-1 marker (`v7-2.done`) | 18:37:05 |
| `v7-1.done` / `v7-3.done` / `v7-5.done` | 18:42:45 / 18:47:35 / 18:47:43 |
| last marker (`v7-4.done`) → **5/5** | **19:47:13** |
| 90-min deadline (never reached) | 19:52:40 |

Wait consumed 84.5 min of the 90-min budget; `v7-4` (edges/blockers/decisions — the lane most
likely to move `blockedBy`/`conflictsWith`, and therefore the derived graph) finished last, 5.5
min before the fallback. **The rebuild below reflects final phase-1 record content.**

## 2. Item 1 — a derive writer DOES exist (the "regenerate by hand" branch does not apply)

**Flagged prominently, because the brief anticipated the opposite:** there is no need to
reverse-engineer the shape and hand-write it. Two writers, each with a `--write` flag, plus one
separate freshness gate:

- `node scripts/example-derive.mjs --work <tree> --write` → `_derived/index.yaml`, `_derived/frontier.md`
- `node scripts/example-critique.mjs --work <tree> --write` → `_derived/critique.yaml`, `_derived/critique.md`
- `node scripts/check-example-derived.mjs` → the gate (no `--write`; it recomputes and compares)

Nothing in `_derived/` was typed by hand. Comparison is structural for `index.yaml`/`critique.yaml`
(`canonicalJSON`, key-sorted) and **byte-exact** for `critique.md`. Neither script has a `--help`;
a missing `--work` prints its usage line and exits 2.

## 3. Items 2 & 3 — rebuilt, and the gate is clean for both trees

Baseline before this lane (18:20:xx):

```
REFUSED D:\Repositories\starci-academy-backend\.claude\examples\todo-app-backend/.starciwork/_derived/index.yaml is missing or stale; run `node scripts/example-derive.mjs --work D:\Repositories\starci-academy-backend\.claude\examples\todo-app-backend\.starciwork --write` to refresh it
REFUSED D:\Repositories\starci-academy-backend\.claude\examples\todo-app-backend/.starciwork/_derived/critique.yaml or critique.md is missing or stale; run `node scripts/example-critique.mjs --work D:\Repositories\starci-academy-backend\.claude\examples\todo-app-backend\.starciwork --write` to refresh them
2 work tree(s) checked: 2 refused
```

After the rebuild — verbatim, at 19:49:14, 19:53:28, 19:56:46 and again at **19:59** (last verified
clean, 2.5 min after the final write — the output held; all 8 file digests unchanged since
19:53:28, i.e. stable across 5+ min of live v8-wave churn):

```
2 work tree(s) checked: every derived index is fresh and no record authors derived vocabulary
```

Both trees, gate exit code 0 (captured through a marker file, not `%ERRORLEVEL%` — see
`v7-8-*-rebuild.txt` / `v7-8-converge*.txt`). A double-`--write` pass produced **byte-identical**
digests for all 8 files (`p1 == post` in `scratch/v7-8-final-rebuild.txt`), confirming
`computeDerived`/`computeCritique` are pure functions of the tree as their comments claim.

**Per-feature derived files: none exist.** The writers emit exactly those four files per tree and
nothing else; `_derived/` in both trees contains precisely `critique.md`, `critique.yaml`,
`frontier.md`, `index.yaml`. Brief item 2's "(+ any per-feature derived files)" is therefore
satisfied vacuously — there is no per-feature derivation to rebuild. (A fifth derived file,
`_derived/deep-baseline.json`, is defined by `check-work-deep.mjs` and is **v7-13's** per
`_common.md` §"Deep check"; neither tree has one yet. I did not write it — that custody belongs to
v7-13 and writing it here would collide. **This means "clean `_derived`" and "complete `_derived`"
are currently different claims.**)

### What phase-1 changed, as absorbed by the rebuild (why waiting mattered)

| | todo-be before | todo-be after | ec-be before | ec-be after |
| --- | --- | --- | --- | --- |
| records in derived index | 270 | 272 | 29 | **41** |
| tally total | 207 | 209 | 15 | **21** |
| done / todo / stale / blocked | 70/28/80/29 | 65/28/86/30 | 4/5/4/2 | **8/11/0/2** |
| gaps (open unbuilt-module) | 35 (0) | 36 (0) | 3 (0) | 3 (0) |
| frontier entries | 31 | 29 | 5 | **11** |
| critique: blast radius / fan-in | 30 / 13 | 30 / 13 | 2 / 1 | **4 / 2** |
| critique: designed-vs-leftover todos | 27 | 33 | 2 | 2 |
| `usedBy` `conflictsWith` / `tension` edges | 6 / 3 | **0 / 5** | 0 / 0 | 0 / 0 |

The last row is the concrete payoff: the index shipped before this lane described `conflictsWith`
edges that v7-4 had already removed, and omitted the cart/account/fr records v7-2/v7-12 authored
(`ec-be` grew 29 → 41 records). The rebuilt `ec-be` frontier now opens with
`br.checkout.cart`, `fr.checkout.cart.{add,clear,list}`, `br.identity.account`,
`fr.identity.account` and both `gap.*.live-proof` records — none of which the stale index knew
about.

## 4. Item 4 — `proves` in `_derived`: CONFIRMED GAP, reported not patched

v6-4's note is correct and still true after the rebuild. In `scripts/example-derive.mjs`,
`proves` appears nowhere in `EDGE_KIND_ORDER` or `EDGE_FIELD_NAMES` (only in a prose comment), so
`classifyEdge()` returns `null` for the trail `proves` and `buildUsedBy()` files the hit in
`unclassifiedEdges`. Measured on the freshly rebuilt output:

| tree | `proves` edges in `unclassifiedEdges` | distinct targets | targets carrying a `usedBy.proves` bucket |
| --- | --- | --- | --- |
| todo-be | **79** | 65 | **0** |
| ec-be | **10** | 6 | **0** |

So the reverse-edge index cannot answer "who proves *this*?" — the single question the
`impl → br/fr/sds/contract` spine exists to answer, and (per v6-4) the tree's most load-bearing
edge. 158 of todo-be's 309 unclassified hits are real pointers of exactly this kind. Not
hand-patched: `_derived/index.yaml` reports `proves` truthfully as unclassified.

Two related observations, same root cause (the layout enumerates fewer edge kinds than the records
use): `example-critique.mjs` works around it privately — `buildProvesUsedBy()` reconstructs the
reverse `proves` index from raw records so blast radius is right — which proves the information is
derivable and simply is not published by the derive step. Fix belongs in `example-derive.mjs`
(add `proves` to `EDGE_FIELD_NAMES` and `EDGE_KIND_ORDER`), not in this lane's output.

**Also found, unprompted:** `provenBy` is in the vocabulary but currently dead here — **zero**
classified `provenBy`/`contractProvider`/`contractConsumer` buckets in either tree, because no
record authors `provenBy` any more (v7-1's marker: "removed all 6 hand-authored provenBy blocks").
v6-3 finding 5 is resolved, and the derived index no longer amplifies a hand-authored proof claim.

## 5. Remaining gate refusals observed, verbatim

None attributable to this lane — `_derived` is clean in both trees at the final check. The
mid-flight ones that document the churn problem (§7):

```
REFUSED D:\Repositories\starci-academy-backend\.claude\examples\todo-app-backend/.starciwork/_derived/index.yaml is missing or stale; run `node scripts/example-derive.mjs --work ... --write` to refresh it
2 work tree(s) checked: 1 refused
```

Sibling gate context (not my gate, run once for scale, ~18:33) — verbatim tail line:

```
311 record(s), 2505 ref(s), 115 evidence file(s): 154 refused, 4 warned
```

## 6. Two more derive-tool gaps (found while rebuilding, neither hand-patched)

**(a) `_derived/frontier.md` is not freshness-gated.** `check-example-derived.mjs` compares only
`index.yaml` (via `runDerive`) and `critique.yaml` + `critique.md` (via `runCritique`);
`runDerive` *writes* `frontier.md` but its `ok` never considers it. Proven mechanically, not just
read off the source: I appended a marker line to todo-be's `frontier.md` (digest
`78FD1C09…` → `5C326936…`) and ran the gate — the only refusals printed were for **ec-be**; the
corrupted todo file produced **no** refusal. The file was then restored by `--write` to a
byte-exact match with the pre-probe digest (`restore exact: True`,
`scratch/v7-8-frontier-probe.txt`). A reader can be handed a `frontier.md` describing a tree that
no longer exists and every gate stays green.

**(b) An authored `state` outside derive's vocabulary silently disappears from the tally.**
Five ec-be `work/ui-screen` records author `state: uninvestigate`
(`features/checkout/ui/{cart,landing-home,shop-browse,stock-refused}/index.yaml:4`,
`features/identity/ui/sign-in/index.yaml:4`). `example-derive.mjs`'s own doc comment asserts "This
tree's simpler schema has no `invalid`/`uninvestigate` concept", yet `effectiveStateOf()` passes
the authored value straight through and `bucketOf()` maps anything that is not
done/suspended/blocked/todo to `null` → the record is skipped. Measured on the shipped output:
**ec-be has 27 records with a lifecycle state but `tally.overall.total: 21`** (5 dropped for
`uninvestigate`, 1 for having no feature). todo-be: 210 stateful, total 209 (only `brand`, which
sits outside `features/`, dropped). The cause is upstream: `check-example-work.mjs` validates the
closed state vocabulary **only for `work/gap`** (line 186) — nothing refuses an undefined state on
a ui-screen. This is the tool that exists to make "the honest tally" readable, quietly under-
reporting a quarter of ec-be's stateful records. Left unfixed deliberately: the records are `ui/`
(another lane's family — v7-1/v7-2 both forbid `ui/`), and my brief forbids making derived output
look complete.

## 7. What I could NOT prove, and why — `_derived` cannot be the last thing that is true

I cannot claim "the derived index is fresh"; I can claim **"fresh as of 19:53:28"**, and the
honest reason for the weaker claim is structural, not sloppiness:

1. **Derived output is a function of product source bytes, not just records.**
   `staleness()` → `resolveOwnedDirs`/`hashOwnedDirs` re-hashes `src/**` on every run. A pure
   code change — which no lane in this fleet is allowed to make, and which `check-example-work.mjs`
   prices as stale evidence — re-stales `_derived` with no record touched at all. Phase 2 can
   therefore never be *last* in principle, only *later*.
2. **The wave my brief gates on is not the wave still writing.** `v8-1.done`, `v8-2.done`,
   `v8-4.done`, `v8-5.done` appeared during the wait, and v8 lanes are writing now: render assets
   at 19:50:21, and a bulk pass at **19:49:57 touching 27 `index.yaml` files plus `workspace.yaml`
   and `brand/index.yaml` in the same second** — 43 s after my rebuild went clean at 19:49:14,
   flipping todo-be back to `1 refused` by 19:51:58. `_common.md` names only `v7-1..v7-5`, so this
   lane correctly proceeded and then had to converge twice more (19:49:14, 19:53:28).
3. **A byte-only rewrite of a record stales its proof, so "nothing semantic changed" is not a
   safe statement.** Because `recordDigest` hashes the record's own bytes, the 19:49:57 bulk touch
   flipped todo-be `brand` from `done` to `suspended` in the rebuilt index without any field
   changing. That is the same mechanism v6-4 measured as a *false-stale* on renames (Q1: "moved is
   indistinguishable from modified"), now visible in the derived layer.

**Recommendation for the fleet:** the phase marker a `_derived` rebuild must wait for is "no writer
is active", not "phase 1 is done". Cheapest correct fix is to stop treating `_derived` as a
hand-built artifact at all and run the two `--write` commands as the last step of the fleet (or a
pre-commit/CI step), so freshness is never a race a lane can lose.

## 8. Record↔code contradictions left unresolved (observed, out of custody)

- The five `state: uninvestigate` ui-screens, each of which also carries the comment "Generation is
  complete for this bounded draw request. State remains uninvestigate for proposed design" —
  a screen whose generation is complete is holding a state no vocabulary defines, no gate refuses,
  and no tally counts (§6b).
- todo-be still sits at **86 `suspended`** records against 65 `done` — evidence re-capture is not
  finished; v7-1's and v7-2's own markers say their recordDigest refusals "await the evidence
  lane". The derived index reports this truthfully (`code-digest-mismatch`, `digest-mismatch`,
  `evidence-marked-stale`); it is not something a `_derived` rebuild can or should clear.
- `_derived/deep-baseline.json` absent in both trees → `DEP_STALE`/`NORM_UNRECORDED` are inert
  until v7-13 runs. Out of this lane's scope by ownership, not by oversight.

## 9. Reproduce

```
node scripts/example-derive.mjs   --work examples/todo-app-backend/.starciwork --write
node scripts/example-critique.mjs --work examples/todo-app-backend/.starciwork --write
node scripts/example-derive.mjs   --work examples/ecommerce-app-be/.starciwork --write
node scripts/example-critique.mjs --work examples/ecommerce-app-be/.starciwork --write
node scripts/check-example-derived.mjs
```

Final digests of the 8 written files (19:53:28; verify against a later gate run before trusting,
per §7):

```
todo-be  index.yaml     BFA3372E30B912A8C257B96491B473FC15943BC6D3A719661C0BB140AE5716EA
todo-be  frontier.md    F47C513F8A733C523F4AAB6D3428E24A99831E4768DC27D7B11CF212A5727E08
todo-be  critique.yaml  8D2EEAA66145DA50DD661B754B3B5B0150019F5891CB62AF4F1800EDD50E3CA4
todo-be  critique.md    9671D1E3A46843BC4A4F95BC0D8C9CB0291B7721F8A3EFCE1CE6AF6231DA0B29
ec-be    index.yaml     44C912912F68C98CE53E6A57DD4C6BD759D0F05846DC4D0B491764F8CB26DD45
ec-be    frontier.md    932501F559C26278E12D3B456557B86F22D689E7E9CA82DCCCA225F79D1E16AA
ec-be    critique.yaml  263F5A53FC54945DF08D16545760950D49DEEA326988DE24A3469572387F6638
ec-be    critique.md    10F380AD22FD93AA00B7DCD9C3D33EBE20F09A0C6F2156460C398CD6F1A5040F
```

## Notes

- `_common.md` was **truncated on my first read** (default read limit) and the missing section was
  load-bearing — §"Deep check (new — v7-13 must run it)" introduces `check-work-deep.mjs`, which
  also writes into `_derived/`. Re-read in full before this lane's custody conclusions; if another
  lane briefs off `_common.md` with a single default read, it has the same blind spot.
- Scratch/support artifacts (not deliverables): `ex-testing/lint/scratch/v7-8-{wait.ps1,wait.log,
  round*.out/round*.code, rebuild.ps1, trial-rebuild.txt, final-rebuild.txt, converge.ps1,
  converge*.txt, frontier-probe.ps1/txt, analyse*.mjs, analyse*-final.txt,
  baseline-derived-check.txt/.code, work-gate.txt/.code}`.
- Tooling caveat that changed a conclusion: `grep_search` returned *"Search did not complete … No
  valid matches were returned; do not treat this as no matches"* for one query over `examples/`.
  The follow-up `Select-String` run found 20 hits, including the five `state: uninvestigate`
  records that became §6b. A silent-empty result here would have cost the finding.
