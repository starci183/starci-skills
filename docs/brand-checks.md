# The brand is proven by machines

A brand record states what the product looks like: its colour tokens, the mascot, the glyph set, the family
whose grammar it overrides. A stated brand is worth nothing. The stylesheet that actually ships can carry a
different purple, the mascot a designer approved can be absent from the tree, an `@iconify` import can sit in
a component nobody reopened, and a token the record names can be a name no grammar declares — styling
nothing, while the record reads as applied.

`checks/brand.mjs` re-derives each of those claims from the artefacts themselves and reports every
one it could not reproduce. The brand is **bound** to the source, not copied from it; **proven**, not stated.

Nothing in this module renders, installs, commits or edits. Every check reads. The colour mathematics is
implemented in this file — sRGB ↔ linear ↔ OKLab ↔ oklch, and the WCAG 2.x contrast ratio — so a brand is
never proven by a dependency that may not be installed.

## Running it

```
starci brand check <work-root> [--source <repository-root>] [--json]
```

`<work-root>` is the Work tree that owns the brand record (`<tree>/brand/index.yaml`; a repository root works
too, resolving `<repo>/.starciwork/brand/index.yaml`). `--source` is the frontend repository root that the
record's `sources[].path` entries are relative to. Without it the two checks that read shipped source skip
and say so. `--json` emits the whole result; otherwise one line per check. The exit code is 1 when any check
failed, and 1 for a broken input — a missing record, a node that is not `kind: brand`, a record with no
`brand:` specification. That last group is a broken input, not a failed check: reporting it as a check would
make "no brand" look like a brand with nothing wrong.

In code:

```
runBrandChecks({tree, sourceRoot=null, grammarRoot=<host>/knowledge/grammars})
  → {schema, ok, checks:[{id, outcome, detail, evidence}], brand:{rev, family, revSource, record}}
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

### 2. `contrast-aa`

**Inputs:** `brand.color.tokens[]` (`value`, `foreground`, `role`), `brand.color.policy.minContrast`.

Every token that declares a `foreground` is a text pair and must reach `policy.minContrast`, defaulting to
the WCAG AA floor of 4.5:1. The `primary` token against a declared `surface` token is a non-text indicator
and must reach 3:1. Both ratios are reported per pair, with the floor they were held to, so a near-miss is
visible rather than just failed. The check skips when the brand declares no `foreground` anywhere and no
surface — there is then no pair to measure.

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

**Inputs:** `brand.identity.family`, `knowledge/grammars/<family>/DNA.yaml` (`DNA.json` once built).

A brand overrides real tokens; it never invents names. Every `color.tokens[].token` must be a token name the
family's DNA declares. A name the grammar does not carry would style nothing, and the record would read as
applied while the product looked untouched. The grammar root defaults to the host's canon, preferring the
built `.dist` copy, as ordinary runtime does. The check skips, with the reason, when the brand declares no
family or the host carries no DNA snapshot for it — an unreadable canon proves nothing either way.

## What is not proven here

`typography`, `logo`, `imagery`, `color.scales`, `color.dark`, `mascot.allowedIn`/`forbiddenIn` and
`brand.forbidden` are read as part of the record but no check re-derives them yet. A dark palette, a mascot
placement rule and a forbidden treatment are claims about rendered surfaces; proving them needs a walk with
screenshots, not a file read. Until then they are stated, and this document says so rather than letting a
green run imply otherwise.
