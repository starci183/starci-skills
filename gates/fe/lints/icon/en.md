---
title: Icon
---

# Icon

The input is code that is already written — one source file, one hunk of a diff. The output is a
**verdict**: whether the file was in scope at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses no icon, no vendor and no size. It refuses one, and it must be able to point at
the literal it refuses on.

## Law

An icon is a closed product meaning. The caller names the MEANING and the ROLE; one leaf turns that
pair into a concrete drawing. Types close the meaning and role unions, so the escapes left over are
the ones types cannot see: a call site that imports a glyph package directly, a leaf that quietly adds
a second vendor, and a size written as neither of the steps the roles offer.

Five rules exist in the rule module, and this file documents five. Their identity is the published
name — the string that appears in a build log and in a disable comment — and no numeric code is
invented for them here. **Four of the five hold a law code**: `ICON-6`, `ICON-7`, `ICON-1` (its size
half only) and `ICON-10`. The fifth holds none: the rule module heads
`rank-artwork-is-a-closed-set` with `ICON-11`, but in the law `ICON-11` says every tile carries a
leading-role glyph at size five — a statement about plate versus glyph size, with nothing to do with
award artwork. So one rule and two exemption branches enforce a decision the law never published, and
a reader who follows the code from the message to the law lands on an unrelated sentence. Recorded
rather than repaired, because inventing the mapping would be inventing the law.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-vendor-icon-outside-icon-leaf` | `ICON-6` | An `import` whose source resolves to a glyph package, made from a source file that is not the icon leaf |
| `heroicons-is-the-glyph-vendor` | `ICON-7` | An `import` whose source resolves to a glyph package outside the two approved families — from **any** source file, the icon leaf included |
| `no-off-scale-glyph-size` | `ICON-1` (size half only) | A `size-` utility written as a decimal fraction or an arbitrary bracket value, in a class attribute or in a variable holding a static class string |
| `no-decorative-icon-in-metric-cell` | `ICON-10` | A JSX element named `Icon` inside the one repeated metric-cell file |
| `rank-artwork-is-a-closed-set` | **none in the law** | An award-artwork identifier named outside the rank leaf, or an identifier inside that leaf which is not one of the four approved ones |

The codes this shelf names and no rule holds: `ICON-2`, `ICON-3` and `ICON-4` — which of the three
roles takes which of the three sizes — have **no rule at all**, and neither do integer sizes off the
scale, so `ICON-1` is held only in the half its rule can see. `ICON-11` — every tile carries a
leading-role glyph at size five — has no rule either; the rule that cites its label enforces something
else. `ICON-13` is documented, typed and exported as the closed reaction identity set, and no rule
reads it. Each of these is unenforced rather than covered, and a green run says nothing about any of
them.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file. Four of the
   five rules require `/src/` in the path; `no-decorative-icon-in-metric-cell` requires its own path
   and nothing else.
2. **Check the exemptions, which are pairs.** The icon leaf is exempt from the caller rule only. The
   rank leaf is exempt from both import rules for exactly one package. Test files are exempt from the
   artwork rule. No file is exempt from a rule wholesale.
3. **Read the nodes the rules actually stand on** — `ImportDeclaration` source strings, static class
   text from a class attribute or a variable init, `JSXIdentifier` element names, and every string
   `Literal`. A value that never reaches one of those nodes was never judged.
4. **Emit one block per finding.** One wrong `import` from an ordinary file violates **both** import
   rules and is reported twice, with two different messages, by design.
5. **Write the `hatch` line** whenever an open hatch would have hidden the same failure.
6. **Do not report what no rule watches.** Role-to-size, integer sizes off the scale, the reaction
   identity set and the tile-glyph statement have no machine; a verdict that claims otherwise is wrong
   about the module.

## `no-vendor-icon-outside-icon-leaf` — ICON-6

**What it reports.** `vendor` — one report per offending `import`: any source file except the icon
leaf naming a glyph package. Importing at the call site decides three things at once — which library,
which drawing, how big — and the next screen answers all three differently.

**How it detects.** Visits `ImportDeclaration`; reads `node.source.value`. A source matches when it
equals or starts with one of ten package prefixes, or when it is an external specifier (not starting
with `.` or `@/`) whose text matches `/(?:icon|glyph|lucide|feather|tabler|fortawesome)/i`. File gate:
`context.filename`, back-slashes normalised to forward, must contain `/src/` and must not end with
`/leaves/Icon/index.tsx`. One exemption: filename ends with `/leaves/RankMark/index.tsx` **and** the
source is exactly the award package.

**What it cannot see.** `require("lucide-react")`, `await import("lucide-react")` and a lazily-loaded
component built from a dynamic import: only the `ImportDeclaration` node is visited.
`export { Caret } from "lucide-react"` — a re-export carries a source too, but it is a different node
type, so a one-line barrel launders the whole package. Anything outside a `/src/` path segment: a
package-style folder, a root-level route folder or a sibling workspace is unlinted, and a file there
may import freely and re-export under a neutral name. And a **second** icon leaf — the gate is a path
suffix, so any folder anywhere ending `leaves/Icon/index.tsx` receives the same freedom as the real
one.

**Boundary.** This rule asks whether the file is the icon leaf. Whether the package itself is allowed
at all is `heroicons-is-the-glyph-vendor`.

## `heroicons-is-the-glyph-vendor` — ICON-7

**What it reports.** `vendor` — a glyph package outside the two approved families (the outline 24
family for the title and leading roles, the solid 16 family for the chip role) imported from **any**
source file. This rule deliberately keeps no leaf exemption: owning the meaning map is not a licence
to open a second drawing vocabulary inside it.

**How it detects.** Same `ImportDeclaration` visitor and same glyph test as the rule above, minus the
leaf gate: every file containing `/src/` is scanned. A hit is dropped only when the source is exactly
`@heroicons/react/24/outline` or `@heroicons/react/16/solid`, or when it is the same
rank-leaf-plus-package pair.

**What it cannot see.** A glyph catalogue whose package name carries none of the six name signals and
is on no list — pictogram, emoji and mark packages routinely qualify. A local `.svg` or a hand-written
SVG component: relative specifiers are excluded before any test, so a second drawing vocabulary can be
assembled entirely from local files. And in the opposite direction,
`import type { Icon } from "lucide-react"` reports even though nothing ships — the mirror-image defect,
a report where there is no escape.

**Boundary.** Same vendor is not enough: only the two exact family strings are dropped, so the 20
family is a third family and reports.

## `no-off-scale-glyph-size` — ICON-1

**What it reports.** `offScale` — a `size-` utility written as a decimal fraction (`size-4.5`) or as an
arbitrary bracket value (`size-[18px]`). The third step is the one nobody applies consistently: the
writer picks it for a reason that is true on their screen, and everyone afterwards copies the nearest
of the three.

**How it detects.** Visits `JSXAttribute` whose `name.name` is `className` or `class`, and every
`VariableDeclarator`. Extracts static text from a string `Literal`, from a `TemplateLiteral` with zero
expressions, or through a `JSXExpressionContainer` wrapping either. Tests that text against
`/\bsize-(?:\d+\.\d+|\[[^\]]+\])/` and reports the first match only.

**What it cannot see.** This is the leakiest rule on the shelf. The name says glyph size, but the
detection carries no fragment of glyph context at all: it is only "a `size-` utility written as a
fraction or a bracket", so an avatar at `size-[44px]` reports while `size-9` on a glyph does not.
**Integer sizes off the scale pass entirely**, and that is the easier way of writing the same mistake —
a size two rungs above the largest role, or one below the smallest, passes silently. The two-utility
form, a separate width and height in any unit, is not the utility the pattern watches. Objects and
arrays pass: a class string inside `{ icon: "…" }` or `["…"]` is neither a class attribute nor a
variable init with a string, so the tidiest place to keep class strings is the blindest. Any
class-joining call — a helper, a variant builder, a conditional list — passes, because static text is
never taken from a call expression. An interpolated size passes: a template literal with even one
expression returns nothing to test. And the match is not global, so the second offender in one string
is never examined.

**Boundary.** It tests neither role nor icon. Which of the three sizes belongs to which role —
`ICON-2`, `ICON-3`, `ICON-4` — is not this rule's question, and is nobody's.

## `no-decorative-icon-in-metric-cell` — ICON-10

**What it reports.** `decorative` — a JSX tag literally named `Icon` inside exactly one file: the
repeated labelled-progress metric cell. That cell's reference is all text, so a glyph here invents
emphasis and repeats meaning the words already close, multiplied across the whole grid.

**How it detects.** Visits `JSXOpeningElement`; reports when `node.name.type === "JSXIdentifier"` and
`node.name.name === "Icon"`. The file gate **is** the whole rule: the filename must end with
`/composites/LabelledProgressRow/index.tsx`, otherwise the visitor is never installed.

**What it cannot see.** The filename. The rule exists only for one path; renaming the file, or moving
the row's markup into a sibling file in the same folder, deletes the rule with no diff to it. Any tag
that is not literally `Icon`: an alias at the import, a member expression, a tile or badge component
that renders a glyph internally, or a glyph handed in as a prop. And every other compact fact cell in
the product: the law is general, the rule is one file, and the tenth metric cell written next week is
outside it by default.

**Boundary.** The rule does not distinguish a feature glyph from a status glyph. Inside that file,
every `Icon` tag reports.

## `rank-artwork-is-a-closed-set` — none

**What it reports.** Two things, by two messages. `outside` — an award-artwork identifier named
**outside** the rank leaf, because the place-to-artwork map must sit in one place so a second screen
cannot answer it differently. And `unknown` — an identifier named **inside** that leaf which is not
one of the four approved ones, because the exemption bought four medals, not a whole catalogue.

**How it detects.** Visits every `Literal`; ignores non-strings and any string not starting with the
artwork-collection prefix `fluent-emoji-flat:`. File gates: must contain `/src/`, must not match
`/\.test\.tsx?$/`. Filename ending with `/leaves/RankMark/index.tsx` selects the closed-set branch;
every other file takes the "named outside the leaf" branch.

**What it cannot see.** An interpolated identifier: building the string from a place number makes both
branches disappear at once — the closed set and the ownership check — and it is the way somebody would
naturally write a place-to-artwork map. A different artwork collection: only one prefix is recognised,
so a medal or trophy taken from any other collection in the same catalogue passes, inside the leaf and
out. Test files, by name: the exemption is deliberate and argued, but it is unbounded — any file
ending `.test.tsx` may name any identifier anywhere in the tree. And a second rank leaf, by the same
path-suffix reasoning as the icon leaf.

**Boundary.** The same string carries two different messages depending on where it stands. Which
branch runs is decided by the filename, before the value is read at all.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | `context.filename` (or `getFilename()`) has back-slashes normalised to forward slashes before any suffix test, so a path gate behaves the same on both platforms |
| `/src/` gate | Four of the five rules require the path to contain `/src/`; `no-decorative-icon-in-metric-cell` is gated on its own path and nothing else |
| glyph-source test | Shared by both import rules: a source matches when it equals or starts with one of ten package prefixes, or when it is an external specifier (not starting with `.` or `@/`) matching `/(?:icon\|glyph\|lucide\|feather\|tabler\|fortawesome)/i` |
| static-text extractor | Reads a string `Literal`, a `TemplateLiteral` with zero expressions, or either of those through a `JSXExpressionContainer`; a call expression yields nothing |
| size pattern | `/\bsize-(?:\d+\.\d+\|\[[^\]]+\])/`, first match only, not global |
| artwork prefix | The one collection prefix `fluent-emoji-flat:`; a string not starting with it is ignored before any branch runs |
| exemption shape | Every exemption is a pair — a file **and** a value — and each path gate is a suffix test, so it names a shape of path rather than a unique file |

Detection is purely syntactic. No module is resolved, no type is consulted, no code runs, and nothing
reaches outside the linted file.

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `import { X } from "@phosphor-icons/react/dist/ssr"` | Packages are matched as a **prefix**, not by equality. The subpath is exactly the escape the module was written after |
| A Windows-shaped path in the gate | Every filename is normalised to forward slashes before any suffix test |
| `class="size-[18px]"` instead of `className` | The attribute test accepts both spellings |
| `className={"size-[18px]"}` or `` className={`size-[18px]`} `` | The static-text extractor unwraps an expression container and reads a template literal that carries no expressions |
| `const ICON = "size-[18px]"`, used far away | Every `VariableDeclarator` with a static string init is scanned, so the plainest form of constant laundering is covered for this one rule |
| A glyph catalogue nobody listed | An external specifier carrying `icon`, `glyph`, `lucide`, `feather`, `tabler` or `fortawesome` in its name is treated as a glyph package even though it appears in no list |
| The rank leaf importing a *different* vendor | The exemption is a pair — that file **and** that one package. Any other package from that file still reports |
| A fifth medal added inside the rank leaf | Inside the leaf, an identifier carrying the artwork prefix must be one of the four; anything else reports |
| The rank identifiers copied into another file | Outside the leaf, any identifier with that prefix reports on sight, so the map cannot be answered twice |
| Adding a vendor from inside the icon leaf | The vendor rule deliberately keeps no leaf exemption, so the leaf is bound by it like every other file |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Rule | Way of writing it that is NOT caught |
|---|---|
| `no-vendor-icon-outside-icon-leaf` | `require("lucide-react")`, `await import("lucide-react")`, and a lazily-loaded component built from a dynamic import. Only the `ImportDeclaration` node is visited |
| `no-vendor-icon-outside-icon-leaf` | `export { Caret } from "lucide-react"`. A re-export carries a source too, but it is a different node type, so a one-line barrel launders the whole package |
| `no-vendor-icon-outside-icon-leaf` | Anything outside a `/src/` path segment. A package-style folder, a root-level route folder or a sibling workspace is unlinted, and a file there may import freely and re-export under a neutral name |
| `no-vendor-icon-outside-icon-leaf` | A **second** icon leaf. The gate is a path suffix, so any folder anywhere ending `leaves/Icon/index.tsx` receives the same freedom as the real one |
| `heroicons-is-the-glyph-vendor` | A glyph catalogue whose package name carries none of the six name signals and is on no list — pictogram, emoji and mark packages routinely qualify |
| `heroicons-is-the-glyph-vendor` | A local `.svg` or a hand-written SVG component. Relative specifiers are excluded before any test, so a second drawing vocabulary can be assembled entirely from local files |
| `heroicons-is-the-glyph-vendor` | `import type { Icon } from "lucide-react"` reports even though nothing ships — the mirror-image defect, a report where there is no escape |
| `no-off-scale-glyph-size` | Integer sizes off the scale. The pattern admits only a decimal fraction or a bracket value, so a size two rungs above the largest role, or one below the smallest, passes silently. This is the same mistake the rule exists for, written the easier way |
| `no-off-scale-glyph-size` | The two-utility form. A separate width and height, in any unit, is not the utility the pattern watches |
| `no-off-scale-glyph-size` | Objects and arrays. A class string inside `{ icon: "…" }` or `["…"]` is neither a class attribute nor a variable init with a string, so the tidiest place to keep class strings is the blindest |
| `no-off-scale-glyph-size` | Any class-joining call — a helper, a variant builder, a conditional list. The argument is a call expression, and static text is never taken from one |
| `no-off-scale-glyph-size` | An interpolated size. A template literal with even one expression returns nothing to test |
| `no-off-scale-glyph-size` | The second offender in one string: the match is not global, so one report is emitted and the rest of the class list is never examined |
| `no-decorative-icon-in-metric-cell` | The filename. The rule exists only for one path; renaming the file, or moving the row's markup into a sibling file in the same folder, deletes the rule with no diff to it |
| `no-decorative-icon-in-metric-cell` | Any tag that is not literally `Icon`: an alias at the import, a member expression, a tile or badge component that renders a glyph internally, or a glyph handed in as a prop |
| `no-decorative-icon-in-metric-cell` | Every other compact fact cell in the product. The law is general; the rule is one file, and the tenth metric cell written next week is outside it by default |
| `rank-artwork-is-a-closed-set` | An interpolated identifier. Building the string from a place number makes both branches disappear at once — the closed set and the ownership check — and it is the way somebody would naturally write a place-to-artwork map |
| `rank-artwork-is-a-closed-set` | A different artwork collection. Only one prefix is recognised, so a medal or trophy taken from any other collection in the same catalogue passes, inside the leaf and out |
| `rank-artwork-is-a-closed-set` | Test files, by name. The exemption is deliberate and argued, but it is unbounded: any file ending `.test.tsx` may name any identifier anywhere in the tree |
| `rank-artwork-is-a-closed-set` | A second rank leaf, by the same path-suffix reasoning as the icon leaf |
| none | Everything `ICON-2`, `ICON-3`, `ICON-4`, `ICON-11` and `ICON-13` state — which role takes which size, the tile's leading-role glyph at size five, and the closed reaction identity set. Documented, typed, exported, unenforced |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename` (or `getFilename()`), normalised to forward slashes |
| import source | the string value on an `ImportDeclaration` |
| class text | static string from a class attribute or a variable init |
| element name | `JSXIdentifier` on a `JSXOpeningElement` |
| string value | any string `Literal` in the file |

## Rules

1. A rule's identity is its published name; nothing here assigns it a number.
2. Detection is purely syntactic. No module is resolved, no type is consulted, no code runs.
3. A file is in scope only when its path carries `/src/`, except the metric-cell rule, which is gated
   on its own path and nothing else.
4. Every exemption is a pair — a file **and** a value. No file is exempt from a rule wholesale.
5. A path gate is a suffix test, so it names a shape of path rather than a unique file.
6. The module's own severity opinion is `error` for all five; the consuming configuration remains the
   authority on what is actually switched on.

## Exceptions

Each exemption is closed, and each is written as a pair.

- **The icon leaf** is exempt from the caller rule only. It may name a glyph package; it may not name
  a package outside the two approved families, because the vendor rule keeps no leaf exemption — that
  is deliberate, since the most dangerous escape comes from whoever believes they hold the authority.
- **The rank leaf** is exempt from both import rules, for exactly one package. A different package
  from that file, or that package from a different file, still reports.
- **The four award identifiers** are the complete vocabulary of the rank leaf. A fifth reports as
  `unknown`; any of the four reports outside the leaf as `outside`.
- **Test files** are exempt from the artwork rule, so a twin test can prove the set is closed by
  naming both a member and a non-member.
- **Everything outside `/src/`** is not examined by four of the five rules. This is a scope decision,
  not a grant, and it is the widest open hatch on the shelf.

## Output

One block per finding:

```text
rule:    <published rule name>
file:    <path as the gate saw it>
scope:   <in | out — the gate that decided it>
node:    <ImportDeclaration | JSXAttribute | VariableDeclarator | JSXOpeningElement | Literal>
value:   <the literal string that matched>
message: <vendor | offScale | decorative | unknown | outside | none>
hatch:   <the open hatch that would have hidden this, or none>
```

A clean in-scope file emits one block with `scope: in`, `message: none` and the hatch that most nearly
applies. An out-of-scope file emits `scope: out` with the gate that excluded it and `message: none` —
it was not judged, not cleared.

## Worked example

**Input.** One block file, `components/blocks/LeaderboardRow/index.tsx`:

```tsx
import { Flame } from "lucide-react"
import { Iconify } from "@/components/leaves/Iconify"

const GLYPH = "shrink-0 size-[18px] text-current"

export const LeaderboardRow = ({ place }: Props) => (
  <div className="flex items-center gap-2">
    <Flame className={GLYPH} />
    <Iconify icon="fluent-emoji-flat:1st-place-medal" className="size-5" />
  </div>
)
```

The path carries `/src/`, is not the icon leaf, is not the rank leaf and is not a test file, so four
of the five rules are installed. The metric-cell rule is not: this path does not end with
`/composites/LabelledProgressRow/index.tsx`, so its visitor was never created.

```text
rule:    no-vendor-icon-outside-icon-leaf
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/, does not end with /leaves/Icon/index.tsx
node:    ImportDeclaration
value:   lucide-react
message: vendor
hatch:   none
```

```text
rule:    heroicons-is-the-glyph-vendor
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    ImportDeclaration
value:   lucide-react
message: vendor
hatch:   none
```

One wrong `import` from an ordinary file reports twice, with two different messages. That is design,
not duplicated configuration.

```text
rule:    no-off-scale-glyph-size
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    VariableDeclarator
value:   shrink-0 size-[18px] text-current
message: offScale
hatch:   none
```

```text
rule:    rank-artwork-is-a-closed-set
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/, does not match /\.test\.tsx?$/, not the rank leaf
node:    Literal
value:   fluent-emoji-flat:1st-place-medal
message: outside
hatch:   none
```

**Repaired.** The call site names a meaning and a role, and hands the place to the rank leaf:

```tsx
import { Icon } from "@/components/leaves/Icon"
import { RankMark } from "@/components/leaves/RankMark"

const GLYPH = "shrink-0 size-9 text-current"

export const LeaderboardRow = ({ place }: Props) => (
  <div className="flex items-center gap-2">
    <Icon props={{ name: "streak", role: "leading" }} className={GLYPH} />
    <RankMark props={{ place }} />
  </div>
)
```

Both import findings and the artwork finding are gone. The size finding is not repaired — it is
hidden:

```text
rule:    no-off-scale-glyph-size
file:    src/components/blocks/LeaderboardRow/index.tsx
scope:   in — contains /src/
node:    VariableDeclarator
value:   shrink-0 size-9 text-current
message: none
hatch:   an integer size off the scale matches neither the decimal-fraction nor the bracket branch of the pattern, so the same mistake written the easier way is invisible rather than compliant
```

## Scope

This module documents enforcement, not law. It documents no rule that ought to exist: a rule that
cannot be pointed at is a proposal, not a gate. Rule names, message ids, regexes and path literals are
identifiers that ship in build output and are reproduced verbatim; everything written around them is
ordinary markup and ordinary calls. Whether a meaning belongs in the map, whether a role deserves a
size and whether a tile needs a glyph at all are decisions the law text owns, and no machine here
holds them.
