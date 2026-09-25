# The brand is proven by machines

A brand record states what the product looks like: its colour tokens, the mascot, the glyph set, the family
whose grammar it overrides. A stated brand is worth nothing. The stylesheet that actually ships can carry a
different purple, the mascot a designer approved can be absent from the tree, an `@iconify` import can sit in
a component nobody reopened, and a token the record names can be a name no grammar declares — styling
nothing, while the record reads as applied.

`scripts/checks/brand.mjs` re-derives each of those claims from the artefacts themselves and reports every
one it could not reproduce. The brand is **bound** to the source, not copied from it; **proven**, not stated.

Nothing in this module renders, installs, commits or edits. Every check reads. The colour mathematics is
implemented in this file — sRGB ↔ linear ↔ OKLab ↔ oklch, and the WCAG 2.x contrast ratio — so a brand is
never proven by a dependency that may not be installed.

## Running it

```
node scripts/checks/brand.mjs <work-root> [--source <repository-root>] [--stage decide|verify] [--json]
```

`<work-root>` is the Work tree that owns the brand record (`<tree>/brand/index.yaml`; a repository root works
too, resolving `<repo>/.starciwork/brand/index.yaml`). `--source` is the frontend repository root that the
record's `sources[].path` entries are relative to. Without it the two checks that read shipped source skip
and say so. `--json` emits the whole result; otherwise one line per check. The exit code is 1 when any check
failed, and 1 for a broken input — a missing record, a node that is not `kind: brand`, a record with no
`brand:` specification. That last group is a broken input, not a failed check: reporting it as a check would
make "no brand" look like a brand with nothing wrong. `--stage` is `decide` (brand.decide, the default) or `verify`
(review.verify; `brand.decide` / `review.verify` are accepted as aliases) and only changes how a planned token is
judged (below); an unknown stage is a broken input.

In code:

```
runBrandChecks({tree, sourceRoot=null, grammarRoot=<host>/knowledge/grammars, stage='decide'})
  → {schema, ok, stage, checks:[{id, outcome, detail, evidence}], brand:{rev, family, revSource, record}}
```

`ok` is true only when no check **failed**. A `skip` never makes a brand proven — it records a claim that
stayed unproven, and the detail says why. `brand.rev` is the record's declared `rev`/`revision` when it has
one (`revSource:'declared'`) and otherwise the first twelve hex digits of the sha256 of the record's own
bytes (`revSource:'content-digest'`), so a result always names exactly what was checked.

Every check is exported on its own and takes a plain context — `{brand, tree, brandDir, sourceRoot, family,
grammarRoot}` — so each is callable and testable without a tree on disk.

## The checks

### 1. `tokens-match-source`

**Inputs:** `brand.color.tokens[]`, `brand.sources[]` of kind `css` or `tokens`, `--source`.

Every declared source file is parsed and every `color.tokens[].token` looked up in it. A stylesheet is read
as CSS custom properties — `--name: value;` inside any block, with the selector that carries it; comments are
stripped and `!important` does not leak into the value. A JSON/YAML token file is read by key in three
authored shapes: a `tokens: [{name,value}]` list (the shape the grammar DNA uses), flat `--token: value`
keys, and a nested object whose key path spells the token (`starci.core.accent` is `--starci-core-accent`).

The comparison happens in OKLab, so `#7547ff` and `oklch(56.50% 0.2534 286.60)` are one colour and a
near-miss is still a miss. The tolerance is `TOKEN_TOLERANCE` = 0.5 on the ×100 ΔE scale: well below a
just-noticeable difference (roughly 2), wide enough to absorb hex/oklch rounding. Each token is reported with
a status — `match`, `differs`, `absent`, `only-in-dark-scope`, `unparseable-brand-value`,
`unparseable-source-value` — and anything but `match` fails the check with both values in `evidence`.

`only-in-dark-scope` exists because a `color.tokens[].value` is the default value. A declaration found only
under `[data-theme="dark"]` or a `prefers-color-scheme: dark` query does not prove the light token, so it is
reported rather than accepted. (`:root:not([data-theme="light"])` inside a dark query is a dark scope: a
negated light theme is not a light one.)

The check skips — never passes — when `--source` is absent, when the brand declares no colour token, when it
names no `css`/`tokens` source, or when not one declared source file could be read from the given root. A
declared file this repository does not carry is reported per file with its reason, which is also how a record
whose `sources[]` span two repositories behaves: run the check once per repository root.

**A token the app has not written yet.** An owner can rule a token into the product before the app's theme
declares it - the value read off a reference render, the theme written later by interface.implement. Such a
token carries `valueSource: {path, value, token?, line?, sha256?}`: the reference file relative to the same
`--source` root (for example `starci-academy-fe/src/app/globals.css`, only ever read), the exact value it
declares, the custom property it declares it under when that is not the brand token's own name (the brand's
`--starci-surface-tertiary` read from Academy's `--surface-tertiary`), and optionally the line and the file's
sha256. The token is looked up in the declared sources as usual - never in the reference file itself, even when
`sources[]` also lists it:

- **Found in an app source:** the normal match applies (`match`, `differs`, …); the reference no longer
  counts and the finding carries `plannedTokenWritten: true`.
- **Absent, stage `decide`:** the reference is read. `planned-from-reference` - a passing status - when it
  declares the property in its default scope with exactly `value` (whitespace and case aside), that value is
  the brand value within `TOKEN_TOLERANCE`, and a declared sha256 still names the file. Otherwise the token
  fails as `value-source-invalid`, `reference-unreadable`, `reference-digest-mismatch`, `reference-absent`,
  `reference-only-in-dark-scope`, `reference-differs` or `unparseable-reference-value`, with the reason.
- **Absent, stage `verify`:** `planned-source-missing`, a failure: by review.verify the app theme is written,
  and a planned token still missing from it is refused on its reference. At this stage a brand with planned
  tokens whose declared sources cannot be read (or that names none) fails instead of skipping.

### 2. `contrast-aa`

**Inputs:** `brand.color.tokens[]` (`value`, `foreground`, `role`), `brand.color.policy.minContrast`,
`brand.color.policy.contrastExceptions[]`, and the owner answer receipts under `<work>/kernel-evidence/`.

Every token that declares a `foreground` is a text pair and must reach `policy.minContrast`, defaulting to
the WCAG AA floor of 4.5:1. The `primary` token against a declared `surface` token is a non-text indicator
and must reach 3:1. Both ratios are reported per pair, with the floor they were held to, so a near-miss is
visible rather than just failed. The check skips when the brand declares no `foreground` anywhere and no
surface — there is then no pair to measure.

A pair below its floor passes only through an owner-accepted exception in `policy.contrastExceptions`, never
by lowering the global floor to the weakest accepted pair:

```yaml
contrastExceptions:
  - foreground: --danger-foreground   # declared color.tokens names, exactly
    background: --danger
    ratio: 3.45                       # the WCAG ratio the owner accepted
    reason: Academy danger red, owner answer A
    acceptedBy: ctx_eb5a945a39ea      # the owner ask's dispatch id
    receipt: .starciwork/kernel-evidence/<workflow>/serve-ask/answer-<ms>.json   # optional
```

An exception covers a pair when its `background` is the pair's background token and its `foreground` token is
the pair's foreground colour. A pair no token declares as a fill — muted text on a surface, link ink on the
canvas — is measured from the exception's two tokens, so an accepted pair is never unmeasured. The exception is
refused, and the check fails, when either token is undeclared, the pair is listed twice, `reason` is empty,
the pair now measures more than `CONTRAST_EXCEPTION_TOLERANCE` = 0.05 from `ratio` (the colour changed after
the owner answered), or no `starci/ask-answer@1` receipt with `dispatchId` = `acceptedBy` and
`answeredBy: owner` is on disk — at `receipt` inside the repository, else the newest one under
`<work>/kernel-evidence/*/serve-ask/`. An auto-accepted answer is not the owner's. Every pair the record does
not list is still held to `minContrast`. Evidence lists each exception with its status: `applied`,
`unneeded` (the pair meets the floor anyway) or `refused` with the reason.

### 3. `primary-danger-distinct`

**Inputs:** the `primary` and `danger` tokens, `brand.color.policy.dangerMayMatchPrimary`.

Destructive must not look like primary. The OKLab ΔE between the two roles is measured on the ×100 scale
(black against white is 100) and must be at least `MIN_PRIMARY_DANGER_DELTA` = 20 — a fifth of the whole
perceptual range. Below that, a user reads "delete" as "continue".

The owner may overrule it: with `policy.dangerMayMatchPrimary: true` the check is a `pass` carrying the note
*the owner allows danger to share the primary hue; destructive actions must carry an icon and a verb*, and it
still reports the measured ΔE. A permitted exception is recorded, not hidden. The check skips when either
role is missing, and fails when a value is not a colour this runtime can parse — an unknown distance is not a
safe one.

### 4. `mascot-assets-present`

**Inputs:** `brand.mascot.assets[]` (`path`, `purpose`, `sha256`), the Work tree.

A mascot that is named but absent is a mascot nobody can draw with. Each declared path is resolved under the
brand record's directory and then under the tree root (so both `assets/x.svg` and `brand/assets/x.svg` work),
must exist as a real file, and must be one of `.png`, `.svg`, `.webp`, `.jpg`, `.jpeg`. The bytes are hashed:
a declared `sha256` is verified (`verified` / `sha256-mismatch`), and an undeclared one is reported as
`present-unpinned` with the computed hash, so the owner can pin the asset they actually reviewed. A path that
escapes the tree is `escapes-tree` and fails. The check skips when no mascot asset is declared.

### 5. `icon-set-only`

**Inputs:** `brand.iconography.set`, `.custom`, `.forbidden`, `--source`.

The glyph set is closed, so the source has to say so. Every `*.ts`/`*.tsx` file under the repository root is
scanned (`node_modules`, `dist`, `.next`, `build`, `out`, `coverage`, dot-directories and symlinks excluded;
`.d.ts` skipped) and every module specifier it imports — static, re-exported, dynamic `import()`, `require()`
— is judged. A specifier matching `iconography.forbidden` is an offender wherever it appears. Any other
icon-looking package (its name carries `icon`, or it is one of the well-known glyph packages) is an offender
unless `set` or `custom` names it, by exact match or as a package prefix (`@heroicons/react` covers
`@heroicons/react/24/outline`). Relative and aliased imports are the product's own files and are never judged
here.

Offenders are reported with file, line, specifier and reason, capped at `OFFENDER_CAP` = 20 with
`offenderCount` and `capped` naming the full size. The check skips without `--source`, when the brand
declares neither a set nor anything forbidden, and when no TypeScript file was found at all: nothing scanned
is nothing proven.

### 6. `tokens-in-grammar`

A planned token is held to this check like any other: its name must be one the family DNA declares (the
`starci` DNA declares the tertiary face as `--starci-surface-tertiary`, over the knob
`--starci-core-surface-tertiary`; HeroUI's `--surface-tertiary` is Common's, not the family's).

**Inputs:** `brand.identity.family`, `knowledge/grammars/<family>/DNA.yaml` in authored YAML.

A brand overrides real tokens; it never invents names. Every `color.tokens[].token` must be a token name the
family's DNA declares. A name the grammar does not carry would style nothing, and the record would read as
applied while the product looked untouched. The grammar root defaults to the host's canon, reading the source `knowledge/` tree
directly, as ordinary runtime does. The check skips, with the reason, when the brand declares no
family or the host carries no DNA snapshot for it — an unreadable canon proves nothing either way.

## Render checks

The six checks above read the record and the source. They cannot see an actual implementation render.
`scripts/checks/render.mjs` reads the two artefacts a downstream browser capture leaves behind — the PNG and the
markup it was rendered from, kept beside it as `<candidate>.html` — and answers the two canon rules of
2026-09-13 from them. Capture identity is structural: assets carrying `generation` are generated direction,
while PNG assets without `generation` are implementation captures regardless of prose provenance. It deliberately ignores `interface.draw` ImageGen direction assets: those pixels guide
the implementation but cannot prove exact Grammar components, DOM/render anatomy or API behavior.

The module is a library, not a verb — bin/starci.mjs routes no render command. The checks run through the
composition it exports:

```
runRenderChecks({uiDir, captureDir=null, brandTree, family=null, grammarRoot=<host>/knowledge/grammars})
  → {schema, ok, checks:[{id, outcome, detail, evidence}], candidates, node, brand, grammar}
```

`uiDir` is the design node that owns the captures (its `index.yaml` carries the `ui:` spec, its `assets/`
the candidates). `brandTree` is the Work tree, or a repository root, whose `brand/index.yaml` the render
was drawn against; it is not optional, because nothing binds a palette without it. `family` overrides the
grammar family the brand declares. `ok` is true only when no check failed; a broken input — no design
record, a node with no `ui:` spec, no brand record — throws, and `renderChecksFor` (below) records that as
one `skip`, never as a failed drawing.

| check | reads | fails when |
| --- | --- | --- |
| `palette-off-brand` | the capture's pixels | a colour bucket over 2% of the saturated pixels is farther than deltaE 6 from every brand colour token and every scale step |
| `primary-absent` | the capture's pixels | the brand's `role: primary` token appears in no bucket at all |
| `entity-list-in-card` | the kept markup | three or more repeated rows (`li`/`tr`, or siblings sharing one class) sit inside a card surface of the family |
| `mascot-slot-missing` | the design record | `brand.mascot.allowedIn` names a surface whose `ui.artworkSlots` declares no slot for the mascot |

**The decoder.** `decodePng` is the runtime's one PNG decoder, `scripts/work/png.mjs` on `node:zlib`: bit
depths 1 to 16, greyscale, RGB, palette and their alpha forms, non-interlaced, returned as 8-bit RGBA. An
interlaced image or a file the decoder cannot follow throws `unsupported png: <why>`, and the run records
the reason as a `skip` rather than reporting colours the file does not have.

**The colours.** `dominantColours` drops every pixel under half opaque, every lightness outside 0.12–0.95
(the page's paper and its ink) and every OKLab chroma under 0.04 (its greys), then buckets what remains on a
fixed OKLab grid of eight steps per axis and reports each bucket's mean. The comparison tolerance is
`PALETTE_TOLERANCE` = `TOKEN_TOLERANCE` × 12 = **deltaE 6** on the same x100 scale the brand checks use: a
capture is antialiased, composited and quantised again by the bucket mean, so the half-unit tolerance that
binds a token to a stylesheet is far too tight here, while six — about three just-noticeable differences —
still leaves a different hue a different hue. A bucket under **2%** of the saturated pixels is not judged:
that is the fringe of an antialiased glyph, not a filled button.

**The markup.** `checkEntityListInCard` scans tags, class attributes and nesting with a tolerant scanner
rather than a DOM library, which the runtime does not install. The card classes come from the family's own
`DNA.yaml` — the classes of its card renderers that name the card surface itself — and fall back to
`starci-core-surface` / `starci-core-surface-card` when the host carries no snapshot. A collection outside
every card passes, whether a `<section>` holds it or a heading introduces it.

**A check that cannot be performed is `skip` with its reason, never `pass`** — no markup kept beside a
capture, a PNG format the decoder does not read, a record that declares no capture, a brand that names no
mascot, a surface the brand does not allow the mascot on. A `skip` never makes a run `ok: false` and never
makes it green either, because an unproven claim must not read as a proven one.

`renderChecksFor({op, state, ctx, files})` is the kernel's hook: it finds the ui node from the operation's
design references, allowlist or changed files. For `frontend.implement`/`interface.implement`, it reads PNG and
matching markup recursively from the bound implementation node's `assets/`; a referenced UI node with no
capture, undecodable pixels, missing markup or unavailable brand audit is a failing missing proof. Non-UI
implementations still return null. For compatibility with earlier drawing records, the hook may read structurally classified
captures declared by the UI record; it returns **null** — not green — when that drawing carries only ImageGen
directions, so a generated picture is never reported as exact render proof. When the run cannot start at all — a tree with no brand record, a node with no `ui:`
spec — the hook answers a single check, `render-checks-unavailable`, as a `skip` carrying the reason: a
broken input is one unproven claim, never a failed drawing and never a passing one. The kernel records that
as `render-check-unavailable` and judges the drawing as it would have before these rules existed. The
knowledge these checks enforce is `COLLECTION-1`/`COLLECTION-2`
(`knowledge/ui/composition/collection.yaml`) and `BRAND-1` to `BRAND-3`
(`knowledge/ui/proof/brand.yaml`).

## What is not proven here

`typography`, `logo`, `imagery` and `brand.forbidden` are read as part of the record but no check
re-derives them. `mascot.forbiddenIn` is not read from the pixels either: the render checks prove that a
slot exists where the mascot is allowed, not that the character is absent where it is forbidden — that
needs recognising the mascot in the capture, which reading bytes does not do. A dark palette is compared
only when a capture is of the dark theme and the record declares `color.dark`; nothing here decides which
theme a given capture is of. Until those are proven they are stated, and this document says so rather than
letting a green run imply otherwise.
