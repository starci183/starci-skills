---
id: fe-lints-icon-index
title: INDEX.md
slug: /gates/lints/icon
sidebar_label: icon
sidebar_position: 0
description: What the icon lint rules can actually see, what they cannot, and which law code each one holds.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `icon`

## Law

An icon is a closed product meaning. The caller names the MEANING and the ROLE; one leaf turns that
pair into a concrete drawing. Types close the meaning and role unions, so the escapes left over are
the ones types cannot see: a call site that imports a glyph package directly, a leaf that quietly
adds a second vendor, and a size written as neither of the steps the roles offer.

This shelf does not restate that law. It records **enforcement**: for each published rule, the exact
syntax it watches, and — the part nobody writes down — the ways of writing the same mistake that it
does not watch at all.

Five rules exist in the rule module, and this file documents five. Their identity is the published
name, which is the string that appears in a build log and in a disable comment; no numeric code is
invented for them here.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-vendor-icon-outside-icon-leaf` | `ICON-6` | An `import` whose source resolves to a glyph package, made from a source file that is not the icon leaf. |
| `heroicons-is-the-glyph-vendor` | `ICON-7` | An `import` whose source resolves to a glyph package outside the two approved families — from **any** source file, the icon leaf included. |
| `no-off-scale-glyph-size` | `ICON-1` (size half only) | A `size-` utility written as a decimal fraction or an arbitrary bracket value, in a class attribute or in a variable holding a static class string. |
| `no-decorative-icon-in-metric-cell` | `ICON-10` | A JSX element named `Icon` inside the one repeated metric-cell file. |
| `rank-artwork-is-a-closed-set` | **none in the law — finding below** | An award-artwork identifier named outside the rank leaf, or an identifier inside that leaf which is not one of the four approved ones. |

**Finding — a rule pointing at a code the law does not carry.** The rule module heads
`rank-artwork-is-a-closed-set` with `ICON-11`, and both import rules skip an exemption branch under
the same label. In the law, `ICON-11` says every tile carries a leading-role glyph at size five: a
statement about plate versus glyph size, with nothing to do with award artwork. The award vocabulary
— one extra package, one extra file, four identifiers — is argued only in the rule module's own
comments. So one rule and two exemption branches enforce a decision the law never published, and a
reader who follows the code from the message to the law lands on an unrelated sentence. Recorded
rather than repaired here, because inventing the mapping would be inventing the law.

**Finding — a rule narrower than the code it holds.** `no-off-scale-glyph-size` is filed under
`ICON-1`, which fixes three roles at three sizes. The rule tests neither role nor icon: it tests one
utility prefix for two shapes of value. Everything about which of the three sizes belongs to which
role — `ICON-2`, `ICON-3`, `ICON-4` — is unenforced, and so are integer sizes off the scale.

**Finding — a vocabulary exported with no rule behind it.** The module exports the closed reaction
identity set. No rule reads it. `ICON-13` is therefore documented, typed and exported, and
unenforced by this module.

## Detection

| Rule | Mechanism |
|---|---|
| `no-vendor-icon-outside-icon-leaf` | Visits `ImportDeclaration`; reads `node.source.value`. A source matches when it equals or starts with one of ten package prefixes, or when it is an external specifier (not starting with `.` or `@/`) whose text matches `/(?:icon\|glyph\|lucide\|feather\|tabler\|fortawesome)/i`. File gate: `context.filename`, back-slashes normalised to forward, must contain `/src/` and must not end with `/leaves/Icon/index.tsx`. One exemption: filename ends with `/leaves/RankMark/index.tsx` **and** the source is exactly the award package. |
| `heroicons-is-the-glyph-vendor` | Same `ImportDeclaration` visitor and same glyph test, minus the leaf gate: every file containing `/src/` is scanned. A hit is dropped only when the source is exactly `@heroicons/react/24/outline` or `@heroicons/react/16/solid`, or when it is the same rank-leaf-plus-package pair. |
| `no-off-scale-glyph-size` | Visits `JSXAttribute` whose `name.name` is `className` or `class`, and every `VariableDeclarator`. Extracts static text from a string `Literal`, from a `TemplateLiteral` with zero expressions, or through a `JSXExpressionContainer` wrapping either. Tests that text against `/\bsize-(?:\d+\.\d+\|\[[^\]]+\])/` and reports the first match only. |
| `no-decorative-icon-in-metric-cell` | Visits `JSXOpeningElement`; reports when `node.name.type === "JSXIdentifier"` and `node.name.name === "Icon"`. File gate is the whole rule: the filename must end with `/composites/LabelledProgressRow/index.tsx`, otherwise the visitor is never installed. |
| `rank-artwork-is-a-closed-set` | Visits every `Literal`; ignores non-strings and any string not starting with the artwork-collection prefix `fluent-emoji-flat:`. File gates: must contain `/src/`, must not match `/\.test\.tsx?$/`. Filename ending with `/leaves/RankMark/index.tsx` selects the closed-set branch; every other file takes the "named outside the leaf" branch. |

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| `import { X } from "@phosphor-icons/react/dist/ssr"` | Packages are matched as a **prefix**, not by equality. The subpath is exactly the escape the module was written after. |
| A Windows-shaped path in the gate | Every filename is normalised to forward slashes before any suffix test, so a path gate behaves the same on both platforms. |
| `class="size-[18px]"` instead of `className` | The attribute test accepts both spellings. |
| `className={"size-[18px]"}` or `` className={`size-[18px]`} `` | The static-text extractor unwraps an expression container and reads a template literal that carries no expressions. |
| `const ICON = "size-[18px]"`, used far away | Every `VariableDeclarator` with a static string init is scanned, so the plainest form of constant laundering is covered for this one rule. |
| A glyph catalogue nobody listed | An external specifier carrying `icon`, `glyph`, `lucide`, `feather`, `tabler` or `fortawesome` in its name is treated as a glyph package even though it appears in no list. |
| The rank leaf importing a *different* vendor | The exemption is a pair — that file **and** that one package. Any other package from that file still reports. |
| A fifth medal added inside the rank leaf | Inside the leaf, an identifier carrying the artwork prefix must be one of the four; anything else reports. |
| The rank identifiers copied into another file | Outside the leaf, any identifier with that prefix reports on sight, so the map cannot be answered twice. |
| Adding a vendor from inside the icon leaf | The vendor rule deliberately keeps no leaf exemption, so the leaf is bound by it like every other file. |

### Open

| Rule | Way of writing it that is NOT caught |
|---|---|
| `no-vendor-icon-outside-icon-leaf` | `require("lucide-react")`, `await import("lucide-react")`, and a lazily-loaded component built from a dynamic import. Only the `ImportDeclaration` node is visited. |
| `no-vendor-icon-outside-icon-leaf` | `export { Caret } from "lucide-react"`. A re-export carries a source too, but it is a different node type, so a one-line barrel launders the whole package. |
| `no-vendor-icon-outside-icon-leaf` | Anything outside a `/src/` path segment. A package-style folder, a root-level route folder or a sibling workspace is unlinted, and a file there may import freely and re-export under a neutral name. |
| `no-vendor-icon-outside-icon-leaf` | A **second** icon leaf. The gate is a path suffix, so any folder anywhere ending `leaves/Icon/index.tsx` receives the same freedom as the real one. |
| `heroicons-is-the-glyph-vendor` | A glyph catalogue whose package name carries none of the six name signals and is on no list — pictogram, emoji and mark packages routinely qualify. |
| `heroicons-is-the-glyph-vendor` | A local `.svg` or a hand-written SVG component. Relative specifiers are excluded before any test, so a second drawing vocabulary can be assembled entirely from local files. |
| `heroicons-is-the-glyph-vendor` | `import type { Icon } from "lucide-react"` reports even though nothing ships — the mirror-image defect, a report where there is no escape. |
| `no-off-scale-glyph-size` | Integer sizes off the scale. The pattern admits only a decimal fraction or a bracket value, so a size two rungs above the largest role, or one below the smallest, passes silently. This is the same mistake the rule exists for, written the easier way. |
| `no-off-scale-glyph-size` | The two-utility form. A separate width and height, in any unit, is not the utility the pattern watches. |
| `no-off-scale-glyph-size` | Objects and arrays. A class string inside `{ icon: "…" }` or `["…"]` is neither a class attribute nor a variable init with a string, so the tidiest place to keep class strings is the blindest. |
| `no-off-scale-glyph-size` | Any class-joining call — a helper, a variant builder, a conditional list. The argument is a call expression, and static text is never taken from one. |
| `no-off-scale-glyph-size` | An interpolated size. A template literal with even one expression returns nothing to test. |
| `no-off-scale-glyph-size` | The second offender in one string: the match is not global, so one report is emitted and the rest of the class list is never examined. |
| `no-decorative-icon-in-metric-cell` | The filename. The rule exists only for one path; renaming the file, or moving the row's markup into a sibling file in the same folder, deletes the rule with no diff to it. |
| `no-decorative-icon-in-metric-cell` | Any tag that is not literally `Icon`: an alias at the import, a member expression, a tile or badge component that renders a glyph internally, or a glyph handed in as a prop. |
| `no-decorative-icon-in-metric-cell` | Every other compact fact cell in the product. The law is general; the rule is one file, and the tenth metric cell written next week is outside it by default. |
| `rank-artwork-is-a-closed-set` | An interpolated identifier. Building the string from a place number makes both branches disappear at once — the closed set and the ownership check — and it is the way somebody would naturally write a place-to-artwork map. |
| `rank-artwork-is-a-closed-set` | A different artwork collection. Only one prefix is recognised, so a medal or trophy taken from any other collection in the same catalogue passes, inside the leaf and out. |
| `rank-artwork-is-a-closed-set` | Test files, by name. The exemption is deliberate and argued, but it is unbounded: any file ending `.test.tsx` may name any identifier anywhere in the tree. |
| `rank-artwork-is-a-closed-set` | A second rank leaf, by the same path-suffix reasoning as the icon leaf. |

## Inputs

| Input | Evidence required |
|---|---|
| file path | `context.filename` (or `getFilename()`), normalised to forward slashes |
| import source | the string value on an `ImportDeclaration` |
| class text | static string from a class attribute or a variable init |
| element name | `JSXIdentifier` on a `JSXOpeningElement` |
| string value | any string `Literal` in the file |

## Invariants

- A rule's identity is its published name; nothing here assigns it a number.
- Detection is purely syntactic. No module is resolved, no type is consulted, no code runs.
- A file is in scope only when its path carries `/src/`, except the metric-cell rule, which is gated
  on its own path and nothing else.
- Every exemption is a pair — a file **and** a value. No file is exempt from a rule wholesale.
- A path gate is a suffix test, so it names a shape of path rather than a unique file.
- The module's own severity opinion is `error` for all five; the consuming configuration remains the
  authority on what is actually switched on.

## Exceptions

Each exemption is closed, and each is written as a pair.

- **The icon leaf** is exempt from the caller rule only. It may name a glyph package; it may not name
  a package outside the two approved families, because the vendor rule keeps no leaf exemption.
- **The rank leaf** is exempt from both import rules, for exactly one package. A different package
  from that file, or that package from a different file, still reports.
- **The four award identifiers** are the complete vocabulary of the rank leaf. A fifth reports as
  unknown; any of the four reports outside the leaf as misplaced.
- **Test files** are exempt from the artwork rule, so a twin test can prove the set is closed by
  naming both a member and a non-member.
- **Everything outside `/src/`** is not examined by four of the five rules. This is a scope decision,
  not a grant, and it is the widest open hatch on the shelf.

## Output

```text
rule:    <published rule name>
file:    <path as the gate saw it>
node:    <ImportDeclaration | JSXAttribute | VariableDeclarator | JSXOpeningElement | Literal>
value:   <the literal string that matched>
message: <vendor | offScale | decorative | unknown | outside>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why a machine is worth having for
it, `example.md` for the code that fires and the code that slips through, `audit.md` while reviewing
whether the enforcement still matches the law, and `changelog.md` for version history.

## Scope

This module documents the five rules published by the icon law's rule module, shipped in
`@starci/eslint-canon-fe`. It documents no rule that ought to exist: a rule that cannot be pointed at
is a proposal, and proposals are listed in `audit.md` as open risk instead.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the rule module is such a change; so is an open hatch that gets closed.
