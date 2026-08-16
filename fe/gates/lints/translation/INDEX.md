---
id: fe-lints-translation-index
title: INDEX.md
slug: /gates/lints/translation
sidebar_label: translation
sidebar_position: 0
description: What a machine can and cannot see of the copy law — two rules, their detection mechanisms, and the ways of writing they miss.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `translation`

## Law

Copy is data. It is resolved by the half that owns the request and handed down already decided, so no
component below a block ever says a word of its own. The law is written in
[`canon/patterns/translation.md`](../../../canon/patterns/translation.md) and carries codes under the
prefix `COPY-`.

This shelf documents something narrower and more useful at review time: **which parts of that law a
build can actually fail on, and which parts it cannot.** A law with no rule is known to be
unenforced. A rule believed to be closed while it is leaking is worse, because nobody looks.

Two rules are published. Four of the law's six codes have no rule at all.

## Rules

Source: [`sources/fe/translation.mjs`](../../../../sources/fe/translation.mjs). Both rules ship in
`@starci/eslint-canon-fe` under the prefix `starci-fe/`, both are `type: "problem"`, and both are
`error` in the exported `recommended` set.

| Rule | Code it enforces | What it reports |
|---|---|---|
| `no-copy-resolution-below-block` | `COPY-1` | Message `resolves`, once per matching call, on the whole `CallExpression`, naming the called identifier. |
| `no-hardcoded-copy-in-vocabulary` | `COPY-2` | Message `hardcoded` on a watched attribute, naming attribute and text; message `text` on element text, naming the text. |

**Finding, recorded rather than papered over.** `COPY-3` (a key never crosses the line), `COPY-4` (a
resolved string obeys the data fence), `COPY-5` (the dictionary is not source) and `COPY-6` (a value
the program matches on is not copy) have **no rule in this file**. `COPY-5` is structurally
satisfied — dictionary content does not live in the four watched folders — but `COPY-3`, `COPY-4`
and `COPY-6` are unenforced law. `COPY-3` is the expensive one: a prop named `labelKey` carrying
`"quest.title"` is a single lowercase token with no whitespace, which is exactly what neither rule
looks at.

## Detection

| Rule | Mechanism |
|---|---|
| *both* | **Folder gate, evaluated once in `create`.** `context.filename` (falling back to `context.getFilename()`), coerced with `String()`, every `\` replaced by `/`, then a substring test for `/src/components/<dir>/` where `<dir>` is one of `leaves`, `shells`, `composites`, `branches`. A file that fails the gate gets an empty visitor object — the rule installs nothing and cannot fire. |
| `no-copy-resolution-below-block` | Visits every `CallExpression`. Requires `callee.type === "Identifier"` and `callee.name` to match `/^(?:useTranslations\|useLocale\|useFormatter\|getTranslations)$/`. Reports the call node. No import path is read, no module specifier is checked, no scope binding is resolved — the rule matches a **spelling**, not a symbol. |
| `no-hardcoded-copy-in-vocabulary` | Two visitors. `JSXAttribute`: attribute name must be a `JSXIdentifier` and one of `aria-label`, `placeholder`, `title`, `alt`, `aria-description`; the value must be a string `Literal`, or a `JSXExpressionContainer` whose `expression.type === "Literal"` with a string value — anything else yields `null`. `JSXText`: `node.value` coerced and trimmed. |
| `no-hardcoded-copy-in-vocabulary` (predicate) | Both visitors feed one test: the string contains whitespace (`/\s/`) **and** begins with an ASCII capital (`/^[A-Z]/`). Deliberately crude, per the source comment: a test that argues about what counts as a sentence is a test nobody trusts. |

## Escape Hatches

### Closed — looks like it would slip past, and does not

| Way of writing | Why it still fires |
|---|---|
| `placeholder={"Search courses"}` — braces around the literal | `attributeText` unwraps a `JSXExpressionContainer` whose expression is a `Literal`. The braces buy nothing. |
| Text broken over three source lines with indentation | `JSXText` is trimmed before the predicate runs, so leading and trailing whitespace does not disguise it. |
| A component authored on Windows, so the path has backslashes | The gate normalizes `\` to `/` before the substring test. The folder gate is not platform-dependent. |
| Renaming the result — `const tr = useTranslations()` | The rule matches the **callee**, not the variable it lands in. |
| Resolving outside a component body — at module top level, inside a callback, inside a plain helper in the same file | The visitor is `CallExpression` with no enclosing-function condition. Anywhere in a gated file fires. |
| Copy in a helper file that sits inside one of the four folders | The gate is per **file path**, not per component. A `hooks.ts` beside the component is gated too. |
| A deeply nested folder — `.../src/components/leaves/a/b/c/component.tsx` | Substring test, not a depth test. |

### Open — the rule genuinely does not catch this

| Way of writing | Why it is invisible |
|---|---|
| **The house prop-bag shape.** `<Input props={{ placeholder: "Search courses" }} />` | The `JSXAttribute` is named `props`, which is not in the watched set. The literal sits in an `ObjectExpression` **inside** the container and is never inspected. This is the shape the law's own counter-example is written in. |
| **Constants launder literals.** `const PLACEHOLDER = "Search courses"` then `placeholder={PLACEHOLDER}` | The literal is at a `VariableDeclarator`; the attribute holds an `Identifier`. Neither visitor is standing there. Nobody has to be malicious — this is what tidying up looks like. |
| **Anything but a plain literal in the container.** A template literal, a concatenation, a ternary, a call | `attributeText` accepts `Literal` only. `` placeholder={`Search courses`} `` returns `null` and the report never happens. |
| **Copy in an expression container as element content.** `<span>{"Search courses"}</span>` | That is a `JSXExpressionContainer`, not `JSXText`, and it is not a `JSXAttribute`. Both visitors miss it. |
| **Interrupted text.** `<span>Search {count} courses</span>` | The `JSXText` nodes are `"Search "` → trimmed `"Search"` (no whitespace, fails) and `" courses"` → trimmed `"courses"` (no whitespace, lowercase, fails). Interpolating one value dissolves a sentence into two tokens. |
| **Single-word copy.** `<span>Submit</span>`, `aria-label="Close"`, `alt="Avatar"` | No whitespace, so it is not prose by this test. A reader in another language sees every one of these exactly as written. |
| **Copy that does not start with an ASCII capital.** `aria-label="close dialog"`, and every sentence beginning `Đ`, `Ê`, `Ô`, `Ơ`, `Ư`, `Á`, `Ổ`… | `/^[A-Z]/` is ASCII-only. A capitalized non-ASCII first letter fails the test, so copy already written in the other language is invisible to the rule meant to protect readers of that language. |
| **Any attribute outside the five.** `aria-placeholder`, `aria-roledescription`, `aria-valuetext`, `label`, `description`, `emptyMessage`, `errorMessage`, `tooltip` | Closed set of five names. A component's own copy-bearing prop is not in it. |
| **Spread.** `<Input {...{ placeholder: "Search courses" }} />` | `JSXSpreadAttribute` is a different node type; the `JSXAttribute` visitor never sees it. |
| **Arrays and objects.** `const TABS = ["Overview", "Recent activity"]`, then mapped into markup | The literals are in an `ArrayExpression`. Nothing watches there. |
| **Aliased or member-form resolution.** `import { useTranslations as useCopy }`, or `i18n.useTranslations()`, or `const t = useTranslations; t()` | The first is an `Identifier` with a non-matching name; the second is a `MemberExpression` callee, rejected before the name test; the third calls a laundered binding. The rule matches spelling, not the symbol behind it. |
| **Any resolver whose name is not one of four.** `useI18n`, `useMessages`, `useT`, `getLocale`, `useNow`, `useTimeZone`, or a project wrapper `useCopy()` | Closed set. A wrapper one file away drags the same runtime in and reports nothing. |
| **Filename and folder scoping.** A tier folder spelled `leaf/`, `atoms/`, `overlays/`, `pages/`, or a component under `src/ui/leaves/` rather than `src/components/leaves/` | Folder names are the cheapest thing in a repository to change, and a new tier folder is a silent hole rather than a failing build. |
| **A relative filename.** Programmatic linting, or piping stdin with a relative `--stdin-filename`, yields `src/components/leaves/…` with no leading slash | The gate tests for `/src/components/leaves/`. Without the leading separator the substring is absent, both rules deactivate, and the run is green for the wrong reason. |
| **Resolution moved one file out.** A hook in `src/hooks/` that calls the runtime, imported by a leaf | The dependency the rule exists to prevent is still there; the call is not in a gated file. |

## Inputs

| Input | What the rule actually gets |
|---|---|
| File path | `context.filename`, or `context.getFilename()` where the former is absent. Used only for the folder gate. |
| Syntax tree | One file's AST. `CallExpression`, `JSXAttribute`, `JSXText` nodes. |
| Options | None. Both declare `schema: []`, so neither the folder list nor the resolver list can be configured at the call site. |
| Types | None. No type information, no import resolution, no cross-file analysis, no knowledge of what a symbol refers to. |

## Invariants

- The folder gate runs in `create`. Outside the four folders the rules install no visitor at all, so
  they cost nothing and see nothing.
- Neither rule is fixable. Every report is real work: the string is lifted to the connected half and
  given a key, not deleted.
- Every report is `error` in `recommended`; there is no advisory tier.
- Both rules match text — a folder substring, a callee spelling, a character class. Neither resolves
  a binding, so any rename defeats them and any alias hides from them.
- One rule, one published name. The name in the build log, in a disable comment and in this document
  is the same string.

## Exceptions

- **Dictionary content** is exempt by structure rather than by judgement: it does not live under the
  watched folders, so no gate has to make a decision about it.
- **A value the program matches on** (`COPY-6`) has no machine-readable mark. The law asks for the
  line to be marked with the reason; the rule cannot read a comment, so the only channel that
  actually silences a report is a disable directive — and a disable directive carries no obligation
  to state a reason. The law's mark and the rule's silencer are two different things.
- **No inline exemption exists for anything else.** With `schema: []` there is no allowlist, so a
  repository that disagrees changes the package, not its config.

## Output

A run emits one line per report, carrying the published rule name:

```text
<file>:<line>:<col>  error  <message>  starci-fe/no-copy-resolution-below-block
<file>:<line>:<col>  error  <message>  starci-fe/no-hardcoded-copy-in-vocabulary
```

A review of this shelf states three things, in this order:

```text
rule:   <published name>
sees:   <the node and the predicate that fired, or would have>
misses: <the open hatch that applies to the code under review>
```

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine at
all, `example.md` for the failing and passing code plus the code that slips through, `audit.md` while
reviewing whether these rules still match the source, and `changelog.md` for what changed.

## Scope

This module documents enforcement only. It names no product, no component library and no repository;
the only proper nouns are published identifiers — rule names, the package they ship in, and the
strings the rules match on.

## Version Rule

Increment all five records by `0.01` for an accepted change to what the rules do or to what this
shelf claims about them, and record it in `changelog.md`. A rule added to or removed from the source
is a change here, not a note.
