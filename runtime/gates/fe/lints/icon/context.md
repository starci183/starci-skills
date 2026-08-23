# Icon

## LOADS

None.

## Record

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

Four rules exist in the rule module, and this file documents four. Each holds one published law code:
`ICON-6`, `ICON-7`, `ICON-1` (its size half only) and `ICON-10`. Rank artwork receives no vendor
exemption; missing medal cuts live in `@starci/heroicons` and pass through the ordinary icon owner.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-vendor-icon-outside-icon-leaf` | `ICON-6` | An `import` whose source resolves to a glyph package, made from a source file that is not the icon leaf |
| `heroicons-is-the-glyph-vendor` | `ICON-7` | An `import` whose source resolves to a glyph package outside the two approved families — from **any** source file, the icon leaf included |
| `no-off-scale-glyph-size` | `ICON-1` (size half only) | A `size-` utility written as a decimal fraction or an arbitrary bracket value, in a class attribute or in a variable holding a static class string |
| `no-decorative-icon-in-metric-cell` | `ICON-10` | A JSX element named `Icon` inside the one repeated metric-cell file |

The codes this shelf names and no rule holds: `ICON-2`, `ICON-3` and `ICON-4` — which of the three
roles takes which of the three sizes — have **no rule at all**, and neither do integer sizes off the
scale, so `ICON-1` is held only in the half its rule can see. `ICON-11` — every tile carries a
leading-role glyph at size five — has no rule either; the rule that cites its label enforces something
else. `ICON-13` is documented, typed and exported as the closed reaction identity set, and no rule
reads it. Each of these is unenforced rather than covered, and a green run says nothing about any of
them.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means no visitor was installed and the rule did not exist for that file. Three of the
   four rules require `/src/` in the path; `no-decorative-icon-in-metric-cell` requires its own path
   and nothing else.
2. **Check the owner boundary.** The icon leaf is exempt from the caller rule only; it remains bound
   to the four approved Heroicons/StarCi subpaths. Rank has no second-vendor exemption.
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

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | `context.filename` (or `getFilename()`) has back-slashes normalised to forward slashes before any suffix test, so a path gate behaves the same on both platforms |
| `/src/` gate | Three of the four rules require the path to contain `/src/`; `no-decorative-icon-in-metric-cell` is gated on its own path and nothing else |
| glyph-source test | Shared by both import rules: a source matches when it equals or starts with one of ten package prefixes, or when it is an external specifier (not starting with `.` or `@/`) matching `/(?:icon\|glyph\|lucide\|feather\|tabler\|fortawesome)/i` |
| static-text extractor | Reads a string `Literal`, a `TemplateLiteral` with zero expressions, or either of those through a `JSXExpressionContainer`; a call expression yields nothing |
| size pattern | `/\bsize-(?:\d+\.\d+\|\[[^\]]+\])/`, first match only, not global |

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
4. A path gate is a suffix test, so it names a shape of path rather than a unique file.
5. The module's own severity opinion is `error` for all four; the consuming configuration remains the
   authority on what is actually switched on.

## Exceptions

- **The icon leaf** is exempt from the caller rule only. It may name a glyph package; it may not name
  a package outside the four approved subpaths, because the vendor rule keeps no leaf exemption — that
  is deliberate, since the most dangerous escape comes from whoever believes they hold the authority.
- **Everything outside `/src/`** is not examined by three of the four rules. This is a scope decision,
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
