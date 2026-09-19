# Lane v6-2 — author `knowledge/grammars/common/DNA.yaml` (clears all 53 RENDER_PROOF_INCOMPLETE)

Date: 2026-09-19. Scope honored: wrote `knowledge/grammars/common/DNA.yaml` (new),
`knowledge/grammars/index.yaml` (+18 lines, the `common` entry), this report, and read-only scratch
tools under `ex-testing/lint/scratch/v6-2-*.mjs`. No `examples/**` file and no `packages/**` file was
modified — `git status --porcelain knowledge` shows exactly `M knowledge/grammars/index.yaml` and
`?? knowledge/grammars/common/`. One build step was unavoidable and is called out in §1.

## 1. What landed

| Artifact | Size | What it is |
|---|---|---|
| `knowledge/grammars/common/DNA.yaml` | 1436 lines / 57502 bytes | snapshot of `@starci/grammar/common` @ 0.4.13: 108 token names, 42 renderers with 135 emitted classes and 174 claim entries, 6 observations, 3 guidance rules, 10 gaps |
| `knowledge/grammars/index.yaml` | +18 | `topics[]` + `families[]` entry for `common`, with an explicit `scope:` note that Common has a DNA snapshot and no family boundary, idiom set or playbook |
| `.dist/knowledge/**` | rebuilt | **required**: `checks/brand.mjs` `defaultGrammarRoot()` prefers `.dist/knowledge/grammars` over the authored tree, so the gate cannot see an authored-only file. Ran `node scripts/compile-knowledge.mjs` → `{"ok":true,"files":77,"stale":[]}`. `.dist` is gitignored (`.claude/.gitignore: /.dist/`). |

That rebuild also refreshed four outputs that were **already stale before this lane touched anything**
(`knowledge/application-stacks.json`, `knowledge/ui/proof/anatomy-source.json`,
`knowledge/ui/proof/INDEX.json`, `knowledge/grammars/INDEX.json`) — the last three `knowledge/ui`
commits never rebuilt `.dist`. `compile-knowledge --check` now passes tree-wide, which it did not before.

## 2. Method — measured, not typed

Every row of both tables came from `ex-testing/lint/scratch/v6-2-dna.mjs` (read-only), and the file was
assembled by `v6-2-assemble.mjs`, so no table was hand-copied and the snapshot cannot disagree with the
measurement that produced it. `provenance.method` records the rules:

- **tokens[]** — every custom property named in `packages/grammar/src/common/styles.css` outside a
  comment (comments are blanked first, so prose about `--h1`/`--field-*`/`--radius-*` never became a row).
  A row says whether Common **assigns** it (`assignedBy: common`, with the value, the number of rules
  that assign a different value, and the line) or only **reads** it inside a `var()`
  (`assignedBy: family` for the `--starci-core-*` namespace, `host` for the generic/system names the same
  fallback chain reaches), with `uses`, the first `commonFallback`, and `source: <file>:<line>`.
  Result: **108** names — 12 assigned by Common (5 `--grammar-*` rhythm + 7 derived structural),
  of which 7 are also read back, and 96 read-only.
- **renderers[]** — the 42 components `src/common/renderers.ts` re-exports, cross-checked against the
  frozen `COMMON_GRAMMAR_COMPONENTS` map in `src/common/registry.tsx` (the two lists are **equal**: 42
  names, no orphan either way). `classes` = grammar class literals in the component's own module
  directory plus the class constants it imports by name; `claims` = ids in a literal
  `data-contract="…"`; `computedClaims` = ids that appear only inside an assembled expression.

Three independent cross-checks ran before authoring:

| Check | Result |
|---|---|
| Census vs `knowledge/grammars/starci/DNA.yaml` (same package version, same physical renderers) | claim-id **unions agree for 42/42**; classes agree except 13 `census-only` rows (§6) |
| Census vs installed `examples/todo-app-frontend/node_modules/@starci/grammar` @ 0.4.13 | `src/common/styles.css` sha256 `9f70f3e7…cb10` **equals** the installed `dist/common/styles.css` byte-for-byte, and equals the digest the todo brand record (rev 3) already cites for that file |
| Census vs the 65 kept captures | the classes the canon resolves are the classes the browser actually rendered (§4) |

## 3. Task 4 verification — the two readers that refused now answer

`node ex-testing/lint/scratch/v6-2-verify.mjs` (verbatim, abridged to the assertions the brief asked for):

```text
schema starci/knowledge-source@1: valid
id=grammar.common.dna family=common schema=starci/knowledge-source@1
tokens=108 renderers=42 gaps=10 observations=6

[authored] root=knowledge/grammars
  grammarTokenNames: error=null names=108 file=knowledge/grammars/common/DNA.yaml
  cardClassesOf:     error=null classes=["starci-core-form-surface","starci-core-frameless-surface","starci-core-surface","starci-core-surface-card"]
  PASS both return error:null with non-empty results
[built (.dist)] root=.dist/knowledge/grammars
  grammarTokenNames: error=null names=108 file=.dist/knowledge/grammars/common/DNA.json
  cardClassesOf:     error=null classes=[ same four ]
  PASS both return error:null with non-empty results
[default] root=.dist/knowledge/grammars        PASS (same)
```

`v6-2-audit.mjs` then re-derives the file's own `identity.counts` from its tables, and
`v6-2-anchors.mjs` follows **every** citation with a needle the cited line must contain:
**26/26 anchored gap-evidence paths land on a line carrying the text the gap claims, and 108/108 token
rows cite a line that actually names that token.** Both tools caught real mistakes on the first pass,
which is why they exist:

- `counts.tokensReadByCommon` was authored as 103 (names appearing in a `var()`) while only 96 rows carry
  `readBy: common` — the other 7 both assign and read. The counts block now names all four numbers
  (`tokensAssignedByCommon: 12`, `tokensAssignedAndAlsoReadByCommon: 7`, `tokensReadOnlyByCommon: 96`,
  `tokensReadByCommon: 103`) instead of one ambiguous one.
- Seven anchors were wrong and are fixed in the shipped file: `GrammarRoot/index.tsx:11→17`,
  `spacing.ts:1→2`, `conformance.ts:26→32`, `dna.ts:116→95`, `dna.ts:158→162`,
  `SurfaceCard/classNames.ts:31→28` (the line that actually writes `starci-core-surface-card--fill`), and
  the `--fill` gap's `classNames.ts` reference itself, which the first draft pointed at a comment.

Remaining audit lines: token and renderer names unique, all 39 gap-evidence paths resolve, and
`.dist/knowledge/grammars/common/DNA.json` agrees with the authored YAML (108 tokens, 42 renderers).


## 4. The delta on `node scripts/check-example-work.mjs`

Baseline captured before any write (`v6-2-baseline.txt`); the table is the last run on the shipped bytes
(`v6-2-final.txt`), which matches the mid-flight run exactly. Raw exits recorded with a marker
file (this box's cmd.exe hides them): **both runs exit nonzero** — the tree still refuses work, this lane
removed one class of refusal, not all of them.

```text
tag                         before  after   delta
RENDER_PROOF_INCOMPLETE        53      0    -53
RENDER_CHECK_FAILED            47     53     +6
CODE_DIGEST_STALE              79     71     -8   (not this lane)
OWNER_PATH_MISSING             10      5     -5   (not this lane)
(untagged)                     11      5     -6   (not this lane)
ALL REFUSED                   200    134    -66

check id                    before  after   delta
entity-list-in-card            53      6    -47   (53 skips → 6 fails, 47 pass)
palette-off-brand              45     45      0   (different lane, as briefed)
primary-absent                  2      2      0   (different lane)
```

`-53 +6 -8 -5 -6 = -66` accounts for the whole move with nothing unexplained. The three non-render
deltas are other lanes working in this shared tree at the same time — the run summary itself changed
under this lane: `290 record(s), 2507 ref(s)` before vs `295 record(s), 2518 ref(s)` after. Attribution
of the 53 is exact because the baseline's 53 were **one** message, byte-identical in all 53:
`No card class is known for this render (the host carries no DNA snapshot for grammar family
`common`), so a card could not be told from a section.`

Card classes against the markup the browser kept (65 `.html` files under
`examples/todo-app-backend/.starciwork/features`):

| class the canon resolves | appears in |
|---|---|
| `starci-core-surface` | 55 captures |
| `starci-core-surface-card` | 55 captures |
| `starci-core-frameless-surface` | 20 captures |
| `starci-core-form-surface` | 8 captures |

No `-surface`/`-surface-card` class appears in any capture that the canon does not name. Adding
`starci-core-form-surface` to the canon — SurfaceCard applies it **beside** `starci-core-surface-card` on
the same element when `measure: form`, so it marks a card, never a region inside one — changes **zero**
verdicts: `v6-2-sensitivity.mjs` re-ran all 65 captures with and without it
(`outcomes changed by the form-surface row=0`).

## 5. What the gate now measures instead of skipping

6 of the 53 captures fail `entity-list-in-card` — new, real refusals for the owners of those two
implementation records, not regressions:

- `features/plan/impl/todo-app-frontend/usage` — `running-page-desktop`, `running-page-mobile`,
  `running-page-at-cap`, `running-page-under-cap`: 3–7 `starci-core-text` items in a `div` inside
  `starci-core-surface`.
- `features/recur/impl/todo-app-frontend/schedule` — `running-page-active-desktop`,
  `running-page-active-mobile`: 7 `li` items in a `div` inside `starci-core-surface`.

The anchor in each case is `starci-core-surface`; in the recur sample that element also carries
`starci-core-list-shell`, and its parent carries `card card--transparent starci-core-surface-card`. So
these fire where **`SurfaceListCard` renders its own collection** — the one component whose job is a list
of rows. Whether each is the COLLECTION-1 defect ("a card is one item") or the rule meeting the
component that legitimately owns collections is a ruling for that record's owner and the rule owner; this
lane only made it measurable, and it is deliberately not recorded as a grammar gap. The other 47 captures
pass the check.

## 6. Findings this lane surfaced but did NOT touch (out of scope)

All are package- or snapshot-side; the brief restricts this lane to `knowledge/grammars/**`.

1. **`@starci/grammar/common` supplies no colour.** Common's sheet assigns 12 properties and not one is a
   colour; the 108-name vocabulary it reads falls back to system keywords (`Canvas`, `CanvasText`,
   `Highlight`, `GrayText`, `ButtonBorder`, `LinkText`). `src/common/styles.spec.ts:21` enforces this by
   asserting the sheet does **not** contain `--starci-core-accent: #7547ff`. A brand bound to
   `identity.family: common` is bound to anatomy, not palette — this is the direction the palette-off-brand
   lane has to settle.
2. **The published rhythm does not reach the published anatomy from Common alone.** `common/styles.css`
   reads no `--grammar-*` name anywhere; the aliasing lives in the family sheet
   (`core/styles.css:34`: `--starci-core-inline-gap: var(--grammar-inline-gap)`). A page importing only
   `@starci/grammar/common/styles.css` can set `--grammar-region-gap` on its root and change no gap.
3. **`GrammarRoot`'s `theme` prop is inert without a family.** No shipped Common rule reads
   `data-grammar-theme`; every rule that does is conjoined with `[data-grammar-family="<id>"]`
   (`core/styles.css:78`, `heritage/styles.css:50`, `offset-pop/styles.css:61`).
4. **Two emitted class hooks paint nothing**: `starci-core-rank-artwork` (no selector in any sheet) and
   `starci-core-surface-card--fill` (the fill form is drawn by `[data-grammar-surface-height="fill"]` on
   the same element). 133 of the 135 emitted classes do have a rule.
5. **`MARGIN-AUTO` is stamped but not in the generated catalog.** `PageContainer` stamps it on every root;
   `rule-catalog.generated.ts` publishes MARGIN-0..6, so `defineGrammarRuleConformance` rejects the id as
   `unknown` even though `knowledge/ui/presentation/margin.yaml:204` authors it.
6. **The sibling `starci/DNA.yaml` class table is 13 rows short.** The Common census found classes the
   snapshot does not list, all confirmed in source and in the rendered markup — notably
   `starci-core-text-action` (`core/primitive/actionStyles.ts:13`, present on every `TextAction` in the
   captures), plus `grammar-common-root` on `GrammarRoot`, `starci-core-leading-number`,
   `starci-core-static-row`/`-copy`, `starci-core-horizontal-scroll-region`, `starci-core-surface-label`,
   `starci-core-form-surface`(×2)/`-scroll-viewport`, `starci-core-visually-hidden`,
   `starci-core-page-container`, `starci-core-button`, `starci-core-icon-tile`, `starci-core-icon-button`.
   Not edited here: `starci/**` is outside this lane's exclusive scope, and `cardClassesOf` already
   resolves correctly for `starci` through its `FALLBACK_CARD_CLASSES`.
7. **`packages/` is still untracked** in `.claude`'s git (`?? packages/`), the v5-3 relocation not yet
   committed. Every `source:`/`evidence:` path in the snapshot is a working-tree path under it; if that
   move lands at a different path the tables need a re-capture, which is what the digests in
   `provenance.digests` make detectable.

## 7. Verification run

| Gate | Result |
|---|---|
| `node scripts/compile-knowledge.mjs --check` | `{"ok":true,"stale":[]}` (77 outputs, 76 YAML, 323 rules) — it reported 5 stale before this lane rebuilt, 4 of them pre-existing (§1) |
| `schemas/knowledge-source.schema.yaml` validation of the new file | valid (also re-validated through the compiler path) |
| `node --test tests/compile-knowledge.spec.mjs` | 9 pass / 0 fail |
| `node --test tests/knowledge-yaml.spec.mjs` | 8 pass / 0 fail |
| `node --test tests/brand-checks.spec.mjs` | 12 pass / 0 fail |
| `node --test tests/render-checks.spec.mjs` | 12 pass / 0 fail |
| `node --test tests/example-work-gate.spec.mjs` | 23 pass / 0 fail |
| `node scripts/check-example-work.mjs` | exit **nonzero** (134 refused) — delta in §4 |
| `v6-2-verify.mjs` | PASS for the authored root, the `.dist` root and the default root (§3) |
| `v6-2-audit.mjs` | all counts and internal-consistency lines ok (§3) |
| `v6-2-anchors.mjs` | 26/26 gap anchors + 108/108 token anchors land on the cited text (§3) |
| `v6-2-sensitivity.mjs` | 65 captures re-run with and without `starci-core-form-surface`: 0 verdict changes (§4) |

Three failures in the combined `node --test` run of seven specs are **not this lane's** and none is
caused by an authored-knowledge or `.dist/knowledge` change:

- `tests/grammar-guards.spec.mjs:1` — `Cannot find module 'typescript/package.json'`: the host's
  `typescript` devDependency is not installed in `.claude/node_modules` (environment gap; the spec fails
  the same way run alone, with this lane's files absent from the picture).
- `tests/pattern-coverage.spec.mjs:261` — `Error: store-paths-removed:reports` thrown by
  `kernel/store.mjs:62`.
- `tests/pattern-coverage.spec.mjs:314` — `assert.ok(frozen.reasons.includes('outside-allowlist:.starciwork/_local/workflows/wfc/rogue.json'))`.

Both `pattern-coverage` failures are run-state/allowlist plumbing under `.starciwork/_local`, a code path
this lane never reads. Flagging them for the coordinator rather than fixing them.

## 8. What a reader must not conclude from this snapshot

`provenance.limitations` carries the full text; the sharp edges are:
**no props tables** (`propsType` names the exported type; the closed value sets were not re-derived — the
StarCi Core snapshot's `closedValues` is a different census); **no rendered DOM** (vendor classes such as
`button--md`, `textfield`, `typography--h1` and the consumer's own Tailwind utilities ride along on the
same elements, so `classes[]` is not a complete class list); **no runtime behaviour** — nothing was
executed in a browser, and static reading proves no contrast, focus, motion or state claim; **no values
for read-only tokens** on purpose, because those values belong to a family sheet, not to Common; and
`--color-white`/`--color-black` are **deliberately absent** — they appear in no grammar source at this
version, so `checks/brand.mjs` `tokens-in-grammar` will still report those two of the todo brand's eleven
tokens as missing. That is the brand importing outside the grammar, and it is a brand-lane decision
(declare them outside the grammar canon, or stop checking them against it), not a hole this lane could
honestly paper over by inventing two token names.
