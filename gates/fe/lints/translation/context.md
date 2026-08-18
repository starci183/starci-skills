---
title: Translation
runtime: true
source: en.md
sourceHash: 3a1e213c637f4e11adb464395d035ca49d26560caabf0d1a7036339af019c1d8
contextVersion: 1
---

# Translation

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was inside the folder gate at all, which published rule fired, what it reported and on
which node, which law code that maps to, and the open hatch that would have hidden the same failure.
This module chooses no wording. It refuses one, and it must be able to point at the string it refuses
on.

## Law

Copy is data. It is resolved by the half that owns the request and handed down already decided, so no
component below a block ever says a word of its own. The law carries codes under the prefix `COPY-`.

This shelf documents something narrower and more useful at review time: **which parts of that law a
build can actually fail on, and which parts it cannot.** A law with no rule is known to be unenforced.
A rule believed to be closed while it is leaking is worse, because nobody looks.

The law states six codes. **Two rules are published. Four of the six codes have no rule at all.**

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `no-copy-resolution-below-block` | `COPY-1` | Message `resolves`, once per matching call, on the whole `CallExpression`, naming the called identifier |
| `no-hardcoded-copy-in-vocabulary` | `COPY-2` | Message `hardcoded` on a watched attribute, naming attribute and text; message `text` on element text, naming the text |

`COPY-3` (a key never crosses the line), `COPY-4` (a resolved string obeys the data fence), `COPY-5`
(the dictionary is not source) and `COPY-6` (a value the program matches on is not copy) have **no rule
in this file**. `COPY-5` is structurally satisfied — dictionary content does not live in the four
watched folders — but `COPY-3`, `COPY-4` and `COPY-6` are unenforced law, not covered law. `COPY-3` is
the expensive one: a prop named `labelKey` carrying `"quest.title"` is a single lowercase token with no
whitespace, which is exactly what neither rule looks at.

Both rules ship in `@canon-fe` under the prefix `starci-fe/`, both are `type: "problem"`,
and both are `error` in the exported `recommended` set.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the folder gate returned an empty visitor object and neither rule existed for that
   file.
2. **The gate is the path.** The file must contain `/src/components/<dir>/` with `<dir>` one of
   `leaves`, `shells`, `composites`, `branches`. Anything else — a different tier folder, a different
   root, a relative filename — switches both rules off at once.
3. **Check the exemptions.** Dictionary content is exempt by structure, not by judgement; there is no
   configurable allowlist, because both rules declare `schema: []`.
4. **Read the nodes.** For `COPY-1`, every `CallExpression` with a bare `Identifier` callee. For
   `COPY-2`, every `JSXAttribute` in the watched set of five and every `JSXText`.
5. **Emit one block per finding**, naming the node and the predicate that fired.
6. **Write the `hatch` line whenever an open hatch applies** — including on a file that reports nothing,
   where silence is the hatch rather than compliance.
7. **Do not report what no rule watches.** Four of the six codes have no machine; a verdict that claims
   otherwise is wrong about the module.

## `no-copy-resolution-below-block` — COPY-1

**What it reports.** Message `resolves`, once per matching call, on the whole `CallExpression`, naming
the called identifier.

**How it detects.** The folder gate first. Then it visits every `CallExpression`, requiring
`callee.type === "Identifier"` and `callee.name` to match
`/^(?:useTranslations|useLocale|useFormatter|getTranslations)$/`. It reports the call node. Anywhere in
a gated file fires: inside a component body, at module top level, inside a callback, inside a plain
helper in the same file.

**What it cannot see.** No import path is read, no module specifier is checked, no scope binding is
resolved — the rule matches a **spelling**, not a symbol. An alias at the import,
`import { useTranslations as useCopy }`, no longer matches the name. A member-form callee,
`i18n.useTranslations()`, is a `MemberExpression` and is rejected before the name test. A laundered
binding, `const t = useTranslations; t()`, calls under a different name. Any resolver whose name is not
one of the four — `useI18n`, `useMessages`, `useT`, `getLocale`, `useNow`, `useTimeZone`, or a project
wrapper `useCopy()` — is a closed-set miss: a wrapper one file away drags the same runtime in and
reports nothing. And moving the call to a file **outside** the four folders, then importing it back in,
leaves the dependency exactly where it was with no report at all.

**Boundary.** This rule judges calls. Whether a string sitting in the markup is copy is `COPY-2`.

## `no-hardcoded-copy-in-vocabulary` — COPY-2

**What it reports.** Message `hardcoded` on a watched attribute, naming attribute and text; message
`text` on element text, naming the text.

**How it detects.** The same folder gate, then two visitors. `JSXAttribute`: the attribute name must be
a `JSXIdentifier` and one of `aria-label`, `placeholder`, `title`, `alt`, `aria-description`; the value
must be a string `Literal`, or a `JSXExpressionContainer` whose `expression.type === "Literal"` with a
string value — anything else yields `null`. `JSXText`: `node.value` coerced and trimmed. Both visitors
feed one test: the string contains whitespace (`/\s/`) **and** begins with an ASCII capital
(`/^[A-Z]/`). Deliberately crude, per the source comment: a test that argues about what counts as a
sentence is a test nobody trusts.

**What it cannot see.** The house prop-bag shape, `<Input props={{ placeholder: "Search courses" }} />`
— the attribute is named `props`, and the literal sits in an `ObjectExpression` no visitor steps into.
A constant laundering the literal, `const PLACEHOLDER = "Search courses"` then
`placeholder={PLACEHOLDER}`. Anything but a plain `Literal` in the container — a template literal, a
concatenation, a ternary, a call. Copy in an expression container as element content,
`<span>{"Search courses"}</span>`, which is neither `JSXText` nor `JSXAttribute`. Interrupted text,
`<span>Search {count} courses</span>`, which dissolves into `"Search"` and `"courses"`. Single-word
copy — `Submit`, `Close`, `Avatar` — which has no whitespace. Copy that does not begin with an ASCII
capital, `aria-label="close dialog"`, and every sentence beginning `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`, `Á`, `Ổ`:
the rule meant to protect readers of another language is blind to copy already written in it. Any
attribute outside the five — `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `label`,
`description`, `emptyMessage`, `errorMessage`, `tooltip`. Spread,
`<Input {...{ placeholder: "Search courses" }} />`, which is a `JSXSpreadAttribute`. Arrays and
objects, `const TABS = ["Overview", "Recent activity"]`, mapped into markup later.

**Boundary.** This rule judges strings standing in markup. A call that fetches a string is `COPY-1`; a
key crossing the line is `COPY-3`, which has no rule.

## Detection

| Part | Mechanism |
|---|---|
| folder gate, both rules | Evaluated once in `create`. `context.filename` (falling back to `context.getFilename()`), coerced with `String()`, every `\` replaced by `/`, then a substring test for `/src/components/<dir>/` where `<dir>` is one of `leaves`, `shells`, `composites`, `branches` |
| out of scope | A file that fails the gate gets an empty visitor object — the rule installs nothing and cannot fire. It costs nothing and sees nothing |
| separator normalisation | The gate normalizes `\` to `/` before the substring test, so a Windows path decides the same way |
| resolver match | `CallExpression` with `callee.type === "Identifier"`, name tested against `/^(?:useTranslations|useLocale|useFormatter|getTranslations)$/` |
| attribute reader | `attributeText`: a string `Literal`, or a `JSXExpressionContainer` whose `expression.type === "Literal"` with a string value; anything else is `null` |
| sentence predicate | `/\s/` **and** `/^[A-Z]/`, shared by the `JSXAttribute` and `JSXText` visitors |
| outside the file | Nothing. No type information, no import resolution, no cross-file analysis, no knowledge of what a symbol refers to |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| `placeholder={"Search courses"}` — braces around the literal | `attributeText` unwraps a `JSXExpressionContainer` whose expression is a `Literal`. The braces buy nothing |
| Text broken over three source lines with indentation | `JSXText` is trimmed before the predicate runs, so leading and trailing whitespace does not disguise it |
| A component authored on Windows, so the path has backslashes | The gate normalizes `\` to `/` before the substring test. The folder gate is not platform-dependent |
| Renaming the result — `const tr = useTranslations()` | The rule matches the **callee**, not the variable it lands in |
| Resolving outside a component body — at module top level, inside a callback, inside a plain helper in the same file | The visitor is `CallExpression` with no enclosing-function condition. Anywhere in a gated file fires |
| Copy in a helper file that sits inside one of the four folders | The gate is per **file path**, not per component. A `hooks.ts` beside the component is gated too |
| A deeply nested folder — `.../src/components/leaves/a/b/c/component.tsx` | Substring test, not a depth test |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Scope | What passes |
|---|---|
| `no-hardcoded-copy-in-vocabulary` | **The house prop-bag shape.** `<Input props={{ placeholder: "Search courses" }} />` — `props` is not in the watched set and the `ObjectExpression` is never inspected. This is the shape the law's own counter-example is written in |
| `no-hardcoded-copy-in-vocabulary` | **Constants launder literals.** `const PLACEHOLDER = "Search courses"` then `placeholder={PLACEHOLDER}`. Nobody has to be malicious — this is what tidying up looks like |
| `no-hardcoded-copy-in-vocabulary` | **Anything but a plain literal in the container** — template literal, concatenation, ternary, call: `attributeText` returns `null` |
| `no-hardcoded-copy-in-vocabulary` | **Copy in an expression container as element content.** `<span>{"Search courses"}</span>` is neither node type |
| `no-hardcoded-copy-in-vocabulary` | **Interrupted text.** `<span>Search {count} courses</span>` — interpolating one value dissolves a sentence into two tokens |
| `no-hardcoded-copy-in-vocabulary` | **Single-word copy.** `<span>Submit</span>`, `aria-label="Close"`, `alt="Avatar"`. A reader in another language sees every one of these exactly as written |
| `no-hardcoded-copy-in-vocabulary` | **Copy that does not start with an ASCII capital.** `aria-label="close dialog"`, and every sentence beginning `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`, `Á`, `Ổ` |
| `no-hardcoded-copy-in-vocabulary` | **Any attribute outside the five**, and **spread**, and **arrays and objects** mapped into markup |
| `no-copy-resolution-below-block` | **Aliased or member-form resolution**, and **any resolver whose name is not one of four** — the rule matches spelling, not the symbol behind it |
| both | **Filename and folder scoping.** A tier folder spelled `leaf/`, `atoms/`, `overlays/`, `pages/`, or a component under `ui/leaves/`. Folder names are the cheapest thing in a repository to change, and a new tier folder is a silent hole rather than a failing build |
| both | **A relative filename.** Programmatic linting, or stdin with a relative `--stdin-filename`, yields `components/leaves/…` with no leading slash; the gate tests for `/src/components/leaves/`, both rules deactivate, and the run is green for the wrong reason |
| both | **Resolution moved one file out.** A hook in `hooks/` that calls the runtime, imported by a leaf: the dependency the rule exists to prevent is still there, and the call is not in a gated file |
| neither | **Everything `COPY-3`, `COPY-4` and `COPY-6` forbid** — a key crossing the line, a resolved string breaking the data fence, a matched-on value treated as copy |

## Rules

1. The identity of a rule is its **published name**. The name in the build log, in a disable comment and
   in this document is the same string; a second numeric identifier would make two names for one thing.
2. The folder gate runs in `create`. Outside the four folders the rules install no visitor at all, so
   out of scope means the rule did not exist for that file, not that the file passed.
3. Only rules that exist in the source are recorded here. A rule that ought to exist and does not is an
   open risk, not a published rule.
4. Neither rule is fixable. Every report is real work: the string is lifted to the connected half and
   given a key, not deleted.
5. Every report is `error` in `recommended`; there is no advisory tier.
6. Both rules match text — a folder substring, a callee spelling, a character class. Neither resolves a
   binding, so any rename defeats them and any alias hides from them.
7. Each rule carries at least one honest open hatch, or an argument for why it is closed. Writing
   "none" for brevity destroys the purpose of this shelf.

## Exceptions

- **Dictionary content** is exempt by structure rather than by judgement: it does not live under the
  watched folders, so no gate has to make a decision about it. It releases `COPY-5`, and only by
  structure.
- **A value the program matches on** (`COPY-6`) has no machine-readable mark. The law asks for the line
  to be marked with the reason; the rule cannot read a comment, so the only channel that actually
  silences a report is a disable directive — and a disable directive carries no obligation to state a
  reason. The law's mark and the rule's silencer are two different things.
- **No inline exemption exists for anything else.** With `schema: []` there is no allowlist, so a
  repository that disagrees changes the package, not its config.

## Output

A run emits one line per report, carrying the published rule name:

```text
<file>:<line>:<col>  error  <message>  starci-fe/no-copy-resolution-below-block
<file>:<line>:<col>  error  <message>  starci-fe/no-hardcoded-copy-in-vocabulary
```

A verdict is one block per finding:

```text
file:   <path as the rule sees it, forward slashes>
scope:  <in | out — the folder substring that decided it>
rule:   <published name>
sees:   <the node and the predicate that fired, or would have>
misses: <the open hatch that applies to the code under review>
```

A clean file inside the gate emits one block with `sees: nothing fired` and a `misses:` line naming the
hatch that applies. A file outside the gate emits one block with `scope: out`, `rule: none` and
`sees: no visitor installed — unjudged, not clean`.
