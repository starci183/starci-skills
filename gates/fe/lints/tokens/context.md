# Tokens

## LOADS

None.

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
for every finding, which published rule fired, which law code it enforces, which node it fired on, and
the exact text it matched. This module chooses nothing. It refuses, and it must be able to point at
the character it refuses on.

## Law

The token law is held by a closed union first. Every tier above the leaves takes its classes from a
typed entry, so an off-scale value there does not fail review — it fails to compile, and there is
nothing left for a rule to patrol.

These rules exist for the one place the union does not reach: the leaf folder, which writes its own
class strings and is exempt from the entry rules by policy. That is where a fractional step, a
bracketed length or a hand-assembled heading can still be typed and still pass the compiler.

Two facts follow, and both shape every rule below.

**They read constants as well as markup.** The last off-scale value in the source these were written
for lived in a module constant, where every rule that walked only JSX attributes looked straight past
it. Hoisting hides a value; it does not license one.

**One of them checks a promise, not a shape.** A class naming a theme token is a REQUEST for a CSS
variable. When the variable does not exist the class is still emitted, the element still renders, and
the union is still satisfied — the only dead value a closed type cannot catch.

The law these enforce carries the prefix `TOKEN-` and is owned by the tokens pattern, not by this
file. A rule name is this module's only identifier; the law code is a mapping, not a second name.

## Published rules

| Rule | Law code | What it reports |
|---|---|---|
| `no-fractional-step` | `TOKEN-3` | The first fractional measurement in a static class string — `gap-1.5`, `p-2.5`, `size-3.5` — naming the matched class in the message |
| `no-arbitrary-value` | `TOKEN-4` | Two separate messages from one string: a bracketed length in a sizing or spacing family, and a `#`-hex colour in a colour family |
| `no-hand-rolled-heading` | `TOKEN-5` | One message when a large text size and a heavy weight appear in the same static class string; names no class, because the finding is the pair |
| `no-unresolved-token-class` | `TOKEN-9` | Each class naming a theme token whose CSS variable is defined nowhere in the stylesheet it found, naming both the class and the missing variable |

Four rules are published, one per code, and the file exports exactly four.

Five codes in the law have no rule at all, and that is a decision rather than a gap. `TOKEN-1` and
`TOKEN-2` are held by the union and want none. `TOKEN-6` is the sentence explaining why this file
exists. `TOKEN-7` and `TOKEN-8` are laws with no machine — they are enforced by review, and a reader
must not read their silence here as permission.

## Reading a diff

1. **Check the gate first.** If the file's path does not contain `/src/`, no rule here runs at all.
   The file is not clean; it is unjudged. Say which, because they look identical in a report.
2. **Collect the static class text**, not just the markup: a class attribute, a variable initialiser,
   and a `classes` property all carry it.
3. **Run each rule against the text it can read.** One string can produce findings from more than one
   rule, and `no-arbitrary-value` can produce two of its own.
4. **Emit one verdict block per finding**, naming the matched text. A finding a reader cannot locate
   is not a finding.
5. **When the text is not static, record it as unread rather than clean.** An interpolation, a merge
   helper or a concatenation makes the whole string invisible to every rule here.
6. **Do not extend a rule to a case it does not name.** The open hatches below are the shipped
   behaviour; a verdict that reports one of them is wrong about the machine.

## `no-fractional-step` — TOKEN-3

**What it reports.** The first fractional measurement in one static class string, naming the class it
matched.

**How it detects.** One regex over the joined text: an alternation of 25 family names — `gap`,
`gap-x`, `gap-y`, `p`, `px`, `py`, `pt`, `pb`, `pl`, `pr`, `m`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`,
`space-x`, `space-y`, `inset`, `top`, `bottom`, `left`, `right`, `size`, `w`, `h` — followed by
`-\d+\.\d+`, bounded by `\b` at both ends. It uses `String.match`, so only the first hit is reported.

**What it cannot see.** Four sizing families are missing from the list: `min-w-3.5`, `min-h-1.5`,
`max-w-2.5` and `max-h-1.5` are fractional steps in families the regex does not name. Logical and axis
properties are missing too — `ps-1.5`, `pe-1.5`, `ms-1.5`, `me-1.5`, `inset-x-1.5`, `inset-y-1.5`.
And because `match` returns the first hit, `"gap-1.5 p-2.5 size-3.5"` reports once: three passes to
clear one string, and an author who fixes the named class and then sees a new message can reasonably
read it as the rule having missed the first time.

**Boundary.** A bracketed length is `TOKEN-4`, not this rule. This rule only ever sees a decimal step
in a named family.

## `no-arbitrary-value` — TOKEN-4

**What it reports.** Two independent messages from the same string: a bracketed length in a spacing or
sizing family, and a hex colour in a colour family.

**How it detects.** Two regexes over the same text. The length regex names 21 families — the spacing
and sizing set plus `min-w`, `min-h`, `max-w`, `max-h`, minus the positional ones — followed by `-\[`
up to the first `]`. The colour regex names `text`, `bg`, `border`, `ring`, `from`, `to`, `via`,
`fill`, `stroke`, `shadow` and `decoration`, followed by literally `-[#` and one hex digit.

**What it cannot see.** Type, tracking, leading, grid, duration and aspect take brackets freely:
`text-[28px]`, `tracking-[0.2em]`, `leading-[1.15]`, `grid-cols-[14rem_1fr]`, `duration-[250ms]`,
`aspect-[4/3]` are in no list and carry no `#`. A raw colour that is not hex is not a raw colour here:
`bg-[rgb(37,99,235)]`, `text-[hsl(210_20%_98%)]` and `shadow-[0_1px_2px_rgba(0,0,0,.08)]` all escape
the palette and all pass. And inline style is not a class at all — `style={{padding: "6px", color:
"#2563eb"}}` is the most direct way to write both of the things this rule forbids.

**Boundary.** The rule's name promises the whole system; its regexes cover spacing, sizing and hex
colour. Anything outside those families is not this rule's silence to explain.

## `no-hand-rolled-heading` — TOKEN-5

**What it reports.** One message when a large text size and a heavy weight appear in the same static
class string. It names no class, because the finding is the PAIR, not either half.

**How it detects.** Two regexes, both required to `test` true against one string:
`text-(xl|2xl|3xl|4xl|5xl)` and `font-(bold|extrabold|black)`.

**What it cannot see.** `font-semibold` is not a heavy weight here, so `text-2xl font-semibold` — the
most common spelling of a hand-rolled heading in ordinary source — does not fire. The size list stops
at `5xl`, so `text-6xl font-bold` passes, and `text-[2rem] font-bold` is seen by no rule on this shelf
at all. The pair must also live in one string: size on the parent and weight on the child, size in a
constant and weight at the call site, or a `<strong>` supplying the weight by tag are each legal
alone.

**Boundary.** Either half on its own is not a violation, and no rule here promotes it into one.

## `no-unresolved-token-class` — TOKEN-9

**What it reports.** Each class naming a theme token whose CSS variable is defined nowhere in the
stylesheet the rule found, naming both the class and the missing variable.

**How it detects.** Filesystem, not AST. From the linted file's directory it walks up at most 12
levels and at each level tests `existsSync` for five relative paths — `app/globals.css`,
`apps/app/src/app/globals.css`, `apps/expert/src/app/globals.css`,
`apps/landing/src/app/globals.css`, `packages/ui/src/styles/globals.css` — reading and joining every
one it finds, cached per directory for the run. If nothing is found the rule returns `{}`. Otherwise
it splits the class text on whitespace, strips one leading `[a-z-]+:` variant and one leading `!`, and
tests three patterns: `^max-w-app-(...)$`, `^max-h-(...)$`, `^min-h-(...)$`. A capture in the reserved
set — `screen full fit auto none min max prose dvh svh lvh dvw svw lvw px` — is skipped. Otherwise the
derived variable, `--container-app-<n>`, `--max-height-<n>` or `--min-height-<n>`, is looked for with
`String.includes` over the stylesheet text.

**What it cannot see.** No stylesheet, no rule: if none of the five candidates exists within 12
levels the rule reports nothing, which is indistinguishable from a clean run. Only three families are
checked, so a dead `w-app-*`, `rounded-*`, `shadow-*`, `text-*` or `gap-*` token — the same failure,
the same silence — is out of scope, and so is `max-w-*` without the `app-` segment. A second variant
turns it off, because the strip is one `[a-z-]+:` prefix: `lg:hover:min-h-panel` still carries
`hover:` when the anchored pattern runs, and `2xl:min-h-panel` is never stripped at all. Finally,
usage counts as definition: the check is `String.includes`, so a `var(--min-height-panel)` reference,
a commented-out declaration, or a longer name containing the shorter one all read as defined.

**Boundary.** This is the only rule here that checks a promise rather than a shape, and the only one
whose evidence comes from outside the linted file.

## Detection

Three of the four share one machine; understanding it is understanding three quarters of this shelf.

| Part | Mechanism |
|---|---|
| shared gate | `context.filename` is normalised to forward slashes, then tested with `.includes("/src/")`. A file whose path does not contain that segment gets no visitors at all — every rule here returns `{}` |
| shared walker | Three visitors: `JSXAttribute` where `node.name.name` is exactly `className` or `class`; every `VariableDeclarator`, reading `node.init`; and `Property` where `node.computed` is false and `node.key.type === "Identifier"` with `node.key.name === "classes"` |
| shared reader | A node yields text only when it is a string `Literal`, a `TemplateLiteral` with `expressions.length === 0`, a `JSXExpressionContainer` wrapping one of those, or an `ArrayExpression` whose members reduce to text and are joined with a single space. Anything else yields `null` |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `const GLUE = "inline-flex gap-1.5"` | The `VariableDeclarator` visitor reads every declarator's initialiser, markup or not. This is the case the rules were written for |
| `["flex", "p-1.5"]` | `ArrayExpression` members are reduced and joined with a space before any regex runs |
| `{classes: ["gap-4", "size-3.5"]}` | The `Property` visitor matches the key `classes` and reads its array the same way |
| `` const G = `gap-1.5` `` | A `TemplateLiteral` with no expressions is read as text |
| `md:gap-1.5`, `hover:p-2.5` | `\b` matches after `:`, so the family still anchors |
| `!py-1.5` | Same boundary; `!` is not a word character |
| `-mt-1.5` | Same boundary; the hyphen before `mt` is not a word character |
| `class` instead of `className` | The attribute test accepts both spellings |
| `["text-2xl", "font-bold"]` | The members are joined first, so both heading regexes see one string |
| `lg:max-w-[62rem]` | The length regex is unanchored and matches mid-string |
| `min-h-screen` | Deliberately skipped under `no-unresolved-token-class`. It is a name the framework resolves itself, and reporting it would send an author to define a variable nothing reads |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| all four | **One interpolation launders the whole string.** A `TemplateLiteral` with any expression yields `null`, so `` className={`gap-1.5 ${extra}`} `` is invisible — including the literal part that would have failed on its own |
| all four | **A merge helper is a wall.** `className={cn("p-1.5", state)}` is a `CallExpression`; the reader has no case for it. This is the ordinary way conditional classes are written, so it is not an evasion — it is the default |
| all four | **Any object key that is not `classes`.** `const S = {root: "gap-1.5"}` passes, and quoting or computing the key — `{"classes": …}`, `{["classes"]: …}` — closes the rule by the same two guards |
| all four | **A slot map is not a class attribute.** `classNames={{base: "p-1.5"}}` fails the name test, and its object value would yield `null` anyway |
| all four | **Filename scoping.** Everything is gated on the path containing `/src/`, case-sensitively. A package that puts source at `lib/`, a docs or story tree, or `/Src/` on a case-insensitive filesystem is out of scope silently, with no message saying so |
| all four | **Concatenation.** `"gap-" + step` is a `BinaryExpression` and `[wide && "p-1.5"]` is a `LogicalExpression`; both yield `null`, and in the array case the surviving members are still checked, so the file reports clean on a partial read |

## Rules

1. A rule reports what it can point at in one node's static text; it never infers across nodes.
2. A file outside the source gate produces no findings from any rule here — not a partial set.
3. A rule with no evidence stays quiet rather than reporting everything as suspect.
4. The published rule name is the rule's only identifier. The law code it enforces is a mapping, not a
   second name.
5. No rule here is authoritative about the tiers the union already holds.

## Exceptions

- **The framework's own names.** Under `no-unresolved-token-class`, a capture in the reserved set
  resolves without a theme variable and is skipped by design, not by oversight.
- **Missing stylesheet.** The same rule disables itself rather than calling every token dead. It is
  recorded as an open hatch above because silence and cleanliness look identical.
- **Non-static text.** Every rule treats an unreadable expression as absent, never as a finding. That
  choice is what makes the merge-helper hatch unavoidable at this design.

## Output

One block per finding:

```text
rule: <no-fractional-step | no-arbitrary-value | no-hand-rolled-heading | no-unresolved-token-class>
code: <TOKEN-3 | TOKEN-4 | TOKEN-5 | TOKEN-9>
node: <JSXAttribute | VariableDeclarator | Property>
matched: <the class the message names, or the pair, or the missing variable>
```

A file with no finding emits no block. A file outside the gate emits no block either, and the two are
not the same result.
