---
id: fe-lints-tokens-index
title: INDEX.md
slug: /fe/lints/tokens
sidebar_label: tokens
sidebar_position: 0
description: What the four token lint rules actually see in source, and the ways of writing they do not.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `tokens`

## Law

The token law is held by a closed union first. Every tier above the leaves takes its classes from a
typed entry, so an off-scale value there does not fail review — it fails to compile, and there is
nothing left for a rule to patrol.

These rules exist for the one place the union does not reach: the leaf folder, which writes its own
class strings and is exempt from the entry rules by policy. That is where a fractional step, a
bracketed length or a hand-assembled heading can still be typed and still pass the compiler.

Two facts follow from that, and both shape every rule below.

**They read constants as well as markup.** The last off-scale value in the source these were
written for lived in a module constant, where every rule that walked only JSX attributes looked
straight past it. Hoisting hides a value; it does not license one.

**One of them checks a promise, not a shape.** A class naming a theme token is a REQUEST for a CSS
variable. When the variable does not exist the class is still emitted, the element still renders,
and the union is still satisfied — the only dead value a closed type cannot catch.

The law these enforce is `patterns/tokens.md`, whose codes carry the prefix `TOKEN-`.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-fractional-step` | `TOKEN-3` | The first fractional measurement in a static class string — `gap-1.5`, `p-2.5`, `size-3.5` — naming the matched class in the message |
| `no-arbitrary-value` | `TOKEN-4` | Two separate messages from one string: a bracketed length in a sizing or spacing family, and a `#`-hex colour in a colour family |
| `no-hand-rolled-heading` | `TOKEN-5` | One message when a large text size and a heavy weight appear in the same static class string; names no class, because the finding is the pair |
| `no-unresolved-token-class` | `TOKEN-9` | Each class naming a theme token whose CSS variable is defined nowhere in the stylesheet it found, naming both the class and the missing variable |

Four rules are published, one per code, and the file exports exactly four. Three carry a
`-- TOKEN-n --` banner in the source; the fourth carries none, and its mapping to `TOKEN-9` is read
from its doc comment and message text rather than from a banner. See `audit.md`.

Five codes in the law have no rule at all. `TOKEN-1` and `TOKEN-2` are held by the union and want
none. `TOKEN-6` is the sentence explaining why this file exists. `TOKEN-7` and `TOKEN-8` are laws
with no machine — recorded in `audit.md`, not hidden here.

## Detection

Three of the four share one walker; understanding it is understanding three quarters of this shelf.

| Rule | Mechanism |
|---|---|
| *shared gate* | `context.filename` is normalised to forward slashes, then tested with `.includes("/src/")`. A file whose path does not contain that segment gets no visitors at all — every rule here returns `{}` |
| *shared walker* | Three visitors: `JSXAttribute` where `node.name.name` is exactly `className` or `class`; every `VariableDeclarator`, reading `node.init`; and `Property` where `node.computed` is false and `node.key.type === "Identifier"` with `node.key.name === "classes"` |
| *shared reader* | A node yields text only when it is a string `Literal`, a `TemplateLiteral` with `expressions.length === 0`, a `JSXExpressionContainer` wrapping one of those, or an `ArrayExpression` whose members reduce to text and are joined with a single space. Anything else yields `null` |
| `no-fractional-step` | One regex against the joined text: an alternation of 25 family names — `gap`, `gap-x`, `gap-y`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`, `space-x`, `space-y`, `inset`, `top`, `bottom`, `left`, `right`, `size`, `w`, `h` — followed by `-\d+\.\d+`, bounded by `\b` at both ends. `String.match`, so the first hit only |
| `no-arbitrary-value` | Two regexes against the same text. The length regex is 21 families — the spacing and sizing set plus `min-w`, `min-h`, `max-w`, `max-h`, minus the positional ones — followed by `-\[` up to the first `]`. The colour regex is 10 families — `text`, `bg`, `border`, `ring`, `from`, `to`, `via`, `fill`, `stroke`, `shadow`, `decoration` — followed by literally `-[#` and one hex digit |
| `no-hand-rolled-heading` | Two regexes, both required to `test` true on one string: `text-(xl\|2xl\|3xl\|4xl\|5xl)` and `font-(bold\|extrabold\|black)` |
| `no-unresolved-token-class` | Filesystem, not AST, for its evidence. From the linted file's directory it walks up at most 12 levels, and at each level tests `existsSync` for five relative paths — `src/app/globals.css`, `apps/app/src/app/globals.css`, `apps/expert/src/app/globals.css`, `apps/landing/src/app/globals.css`, `packages/ui/src/styles/globals.css` — reading and joining every one it finds, cached per directory for the run. If nothing is found the rule returns `{}`. Otherwise it splits the class text on whitespace, strips one leading `[a-z-]+:` variant and one leading `!`, and tests three patterns: `^max-w-app-(...)$`, `^max-h-(...)$`, `^min-h-(...)$`. A capture in the set `screen full fit auto none min max prose dvh svh lvh dvw svw lvw px` is skipped. Otherwise the derived variable — `--container-app-<n>`, `--max-height-<n>`, `--min-height-<n>` — is looked for with `String.includes` on the stylesheet text |

## Escape Hatches

### Closed

| A reader might expect this to slip past | Why it does not |
|---|---|
| Hoisting the value out of markup: `const GLUE = "inline-flex gap-1.5"` | The `VariableDeclarator` visitor reads every declarator's initialiser, markup or not. This is the case the rules were written for |
| Splitting the string into array members: `["flex", "p-1.5"]` | `ArrayExpression` members are reduced and joined with a space before any regex runs |
| Putting it in a typed entry: `{ classes: ["gap-4", "size-3.5"] }` | The `Property` visitor matches the key `classes` and reads its array the same way |
| Backticks instead of quotes: `` const G = `gap-1.5` `` | A `TemplateLiteral` with no expressions is read as text |
| A responsive or state variant: `md:gap-1.5`, `hover:p-2.5` | `\b` matches after `:`, so the family still anchors |
| An important marker: `!py-1.5` | Same boundary; `!` is not a word character |
| A negative margin: `-mt-1.5` | Same boundary; the hyphen before `mt` is not a word character |
| Writing `class` instead of `className` | The attribute test accepts both spellings |
| Splitting a heading across two array members: `["text-2xl", "font-bold"]` | The members are joined first, so both regexes see one string |
| Hiding a bracketed length behind a variant: `lg:max-w-[62rem]` | The length regex is unanchored and matches mid-string |
| `min-h-screen` under the unresolved-token rule | Deliberately skipped. It is a name the framework resolves itself, and reporting it would send an author to define a variable nothing reads. Measured on two repositories the first time the rule ran: two findings, both this list |

### Open

| Rule | What it does not catch |
|---|---|
| *all four* | **One interpolation launders the whole string.** A `TemplateLiteral` with any expression yields `null`, so `` className={`gap-1.5 ${extra}`} `` is invisible — including the literal part that would have failed on its own |
| *all four* | **A merge helper is a wall.** `className={cn("p-1.5", state)}` is a `CallExpression`; the reader has no case for it and returns `null`. This is the ordinary way conditional classes are written, so it is not an evasion — it is the default |
| *all four* | **Any object key that is not `classes`.** `const S = { root: "gap-1.5" }` passes: the declarator's initialiser is an `ObjectExpression`, which yields `null`, and the `Property` visitor only fires on the exact key `classes`. The brief's "constants launder literals" hatch is closed for a bare constant and wide open one nesting level down |
| *all four* | **Quoting or computing that key closes the rule.** `{ "classes": "gap-1.5" }` has a `Literal` key, not an `Identifier`, and `{ ["classes"]: … }` is `computed` — both skipped by the same two guards |
| *all four* | **A slot-map attribute is not a class attribute.** An attribute named anything but `className` or `class` — a per-part map such as `classNames={{ base: "p-1.5" }}` — fails the name test, and its object value would yield `null` anyway |
| *all four* | **Filename scoping.** Everything is gated on the path containing `/src/`. A layout with no `src` directory, a co-located route folder, a docs or story tree, or a package that puts source at `lib/` has none of these rules — silently, with no message saying so. The test is also case-sensitive, so `/Src/` on a case-insensitive filesystem is out of scope too |
| *all four* | **Concatenation.** `"gap-" + step` and `"p-1.5 " + base` are `BinaryExpression`s, and a conditional member inside an array — `[wide && "p-1.5"]` — is a `LogicalExpression`. All yield `null`, and in the array case the surviving members are still checked, so the file reports clean on a partial read |
| `no-fractional-step` | **Four sizing families are missing from the list.** `min-w-3.5`, `min-h-1.5`, `max-w-2.5` and `max-h-1.5` are fractional steps in families the regex does not name — and the arbitrary-value rule names those four only for brackets, so nothing sees them |
| `no-fractional-step` | **Logical and axis properties are missing.** `ps-1.5`, `pe-1.5`, `ms-1.5`, `me-1.5`, `inset-x-1.5` and `inset-y-1.5` are off the ladder and off the list. `inset` is named; its two axis forms are not |
| `no-fractional-step` | **One message per node.** `match` returns the first hit, so `"gap-1.5 p-2.5 size-3.5"` reports once. Three passes to clear one string, and an author who fixes the named class and sees a new message can reasonably read it as the rule having missed the first time |
| `no-arbitrary-value` | **Type, tracking, leading, grid, duration and aspect take brackets freely.** `text-[28px]`, `tracking-[0.2em]`, `leading-[1.15]`, `grid-cols-[14rem_1fr]`, `duration-[250ms]`, `aspect-[4/3]` — none of those families is in the length list, and none carries `#`, so none is reported. The rule's name promises the system; its regex covers spacing and sizing |
| `no-arbitrary-value` | **A raw colour that is not hex is not a raw colour here.** `bg-[rgb(37,99,235)]`, `text-[hsl(210_20%_98%)]` and `shadow-[0_1px_2px_rgba(0,0,0,.08)]` all escape the palette and all pass, because the colour regex requires the literal three characters `-[#` |
| `no-arbitrary-value` | **Inline style is not a class.** `style={{ padding: "6px", color: "#2563eb" }}` is neither a class attribute nor class text, and it is the most direct way to write both things this rule forbids |
| `no-hand-rolled-heading` | **`font-semibold` is not a heavy weight.** `text-2xl font-semibold` is the most common spelling of a hand-rolled heading in ordinary source and the rule does not fire. The weight list is `bold`, `extrabold`, `black` only |
| `no-hand-rolled-heading` | **The size list stops at `5xl`.** `text-6xl font-bold` — a display heading, larger than anything the rule watches — passes. So does `text-[2rem] font-bold`, which no rule on this shelf sees at all |
| `no-hand-rolled-heading` | **The pair must live in one string.** Size on the parent and weight on the child, size in a constant and weight at the call site, or a `<strong>` supplying the weight by tag: each half is legal alone, and the rule only ever looks at one node's text |
| `no-unresolved-token-class` | **No stylesheet, no rule.** If none of the five candidate paths exists within 12 levels, the rule returns `{}` and reports nothing — the safe choice, and indistinguishable from a clean run. A repository that keeps its theme anywhere else has this rule disabled and no way to notice |
| `no-unresolved-token-class` | **Three families out of every family that names a token.** Only `max-w-app-*`, `max-h-*` and `min-h-*` are checked. A dead `w-app-*`, `rounded-*`, `shadow-*`, `text-*` or `gap-*` token — the same failure, the same silence — is not this rule's business, and `max-w-*` without the `app-` segment is not either |
| `no-unresolved-token-class` | **A second variant turns it off.** The strip is one `[a-z-]+:` prefix, so `lg:hover:min-h-panel` still carries `hover:` when the anchored pattern runs and matches nothing. A variant beginning with a digit — `2xl:min-h-panel` — is never stripped at all, for the same reason |
| `no-unresolved-token-class` | **Usage counts as definition.** The check is `String.includes` on the joined stylesheet text. A `var(--min-height-panel)` reference, a commented-out declaration, or a longer name containing the shorter one all satisfy it, so a variable that is read everywhere and declared nowhere reads as defined |

## Inputs

| Input | Evidence required |
|---|---|
| filename | `context.filename`, normalised; must contain `/src/` |
| class text | A static string reachable from a class attribute, a variable initialiser or a `classes` property |
| stylesheet | For `no-unresolved-token-class` only: the text of every candidate stylesheet found above the file |

## Invariants

- A rule reports what it can point at in one node's static text; it never infers across nodes.
- A file outside the source gate produces no findings from any rule here, not a partial set.
- A rule with no evidence stays quiet rather than reporting everything as suspect.
- The published rule name is the rule's only identifier. The law code it enforces is a mapping, not a second name.
- No rule here is authoritative about the tiers the union already holds.

## Exceptions

- **The framework's own names.** Under `no-unresolved-token-class`, a capture in the reserved set resolves without a theme variable and is skipped by design, not by oversight.
- **Missing stylesheet.** The same rule disables itself rather than calling every token dead. Recorded as an open hatch above because silence and cleanliness look identical.
- **Non-static text.** Every rule treats an unreadable expression as absent, never as a finding. That choice is what makes the merge-helper hatch unavoidable at this design.

## Output

```text
rule: <no-fractional-step | no-arbitrary-value | no-hand-rolled-heading | no-unresolved-token-class>
code: <TOKEN-3 | TOKEN-4 | TOKEN-5 | TOKEN-9>
node: <JSXAttribute | VariableDeclarator | Property>
matched: <the class the message names, or the pair, or the missing variable>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine,
`example.md` for failing and passing source plus the code that slips through, and `audit.md` while
reviewing whether these rules still hold the law.

## Scope

This module documents enforcement only. It names no product and no repository; the rule identifiers
and the package name are shipped strings and are reproduced verbatim.

## Version Rule

Increment all five records by `0.01` for an accepted change to a rule or to this documentation, and
record it in `changelog.md`.
