---
id: fe-patterns-naming-index
title: INDEX.md
slug: /fe/patterns/naming
sidebar_label: naming
sidebar_position: 0
description: Binding rules for how a module-level function is declared, what a reader-triggered function is called, and which language a file or route name is written in.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `naming`

## Law

Naming here is the mechanical half: the spellings that are the same in every file regardless of what
the file is for. How a module-level function is declared, what a thing that responds to a reader is
called, and which language a path is written in.

These are not preferences. Both forms of each pair work, and that is exactly why they are rules —
nothing corrects the second spelling, so a file written on a Tuesday reads differently from its
neighbour, and every diff afterwards carries noise that has nothing to do with the change.

**This is binding, not advisory.** Every module-level declaration, every function a reader's action
runs, and every path segment resolves to a code below. There is no file small enough to be exempt: a
three-line helper is `NAMING-1` for the same reason a route folder is `NAMING-3`.

What a component is called FOR — the thing rather than its first caller — is deliberately not
settled here. That question is answered per layer, because the failure it prevents is different at
each one, and a single answer stated here would be wrong at four layers to be right at one.

## Situation Codes

Every situation this module governs carries a code, `NAMING-<n>`. The code names the SITUATION. The
codes are cited from other law files and from task records, so a number, once issued, is never
reused for a different meaning and never renumbered.

| Code | What it requires | What it forbids |
|---|---|---|
| `NAMING-1` | A module-level function is an arrow const, exported by name | `function X() {}` at module level; `export default function` |
| `NAMING-2` | Anything a reader's action runs is named `onX` — at the declaration, at the call site and in the props type | `handleX` as a local, as a prop, or as a field in a props type |
| `NAMING-3` | A file, folder and route segment is written in the one language every reader shares | A path segment in a second language, whether accented or romanised |

THIS MODULE HAS THREE CODES AND ENDS WITH THREE. The flat law it re-expresses carries a fourth
prohibition — a name that says WHERE it is used rather than what it is — with no code attached,
because that rule is stated per layer and not here. Not issuing a fourth number is a decision, not
an oversight: a code issued here would be cited here, and the answer would be missing at the layer
that actually owns it.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a rule in
[`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs) reports it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | Held by | What the tier does not reach |
|---|---|---|---|
| `NAMING-1` | `enforced` | `starci-fe/prefer-arrow-export` | The `FunctionDeclaration` shape only. `const X = function () {}` keeps the keyword the law refuses but is a `FunctionExpression` and is never visited; `export default () => {}` is an arrow with no name to grep at its call sites, which is half of why `export default function` is refused, and it passes |
| `NAMING-2` | `enforced` | `starci-fe/handler-on-prefix` | Three node kinds — a declarator with an `Identifier` id, a JSX attribute name, a `TSPropertySignature` key. An object-literal property, a destructured parameter and a class method carry the same prefix unvisited. The positive half is unread entirely: `submit` and `doClaim` satisfy the rule and not the law |
| `NAMING-3` | `enforced` | `starci-fe/no-second-language-in-path` | `ROMANISED` is a fixed list of twenty segments, so an accent-free second-language segment outside it passes. A folder holding no linted file is never visited, and a language other than the one the list was built from is not covered at all |

All three codes have a rule with a name. None is `documented`. What is NOT true is that any of the
three is held whole — each rule is narrower than the law it holds, and every gap above is restated in
[`audit.md`](./audit.md) with what a rule would have to see, because a tier table that rounds
"partly" up to "enforced" is how a repository comes to believe it is protected.

## Anchor

Real code each code can be checked against. A law that cannot be pointed at in real code is a
proposal, not a law.

| Code | Anchor | What to look for |
|---|---|---|
| `NAMING-1` | [`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs) | The file obeys the rule it publishes. Every declaration in it — `MODULE_LEVEL_PARENTS`, `segmentsOf`, all three rule objects — is a const, and each appears above its first use. Read it top to bottom and nothing is referenced before it exists; that property is the whole argument, and it is visible rather than asserted |
| `NAMING-1` | [`sources/fe/naming.test.mjs`](../../../sources/fe/naming.test.mjs) | The invalid triple: a named export, a bare module-level declaration, and `export default function Route()`. Beside it the valid case `export const E = () => { function inner() {…} }` — the nested declaration that is deliberately allowed, written as a test rather than as a sentence |
| `NAMING-2` | [`sources/fe/naming.test.mjs`](../../../sources/fe/naming.test.mjs) | The invalid triple is one function in three positions: a local, a JSX attribute, a field in a props type. That triple is the argument for the rule's reach. The valid cases `handled` and `handler` are the argument for its narrowness — a rule that fired on them would be noise, and noise is unread |
| `NAMING-2` | [`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs) | `flag` and its `/^handle[A-Z]/` test, and the three visitors that call it. The visitor list IS the reach; anything not in it is outside the rule regardless of what it is named |
| `NAMING-3` | [`sources/fe/naming.mjs`](../../../sources/fe/naming.mjs) | `SECOND_LANGUAGE_PATH` and `ROMANISED` — two instruments for one law, because the filesystem drops diacritics. Then `segmentsOf`, and the `replace(/[()[\]]/g, "")` in the finder: route-group parentheses are punctuation around a name, not part of it |
| `NAMING-3` | [`sources/fe/naming.test.mjs`](../../../sources/fe/naming.test.mjs) | The valid cases `capacity` and `DangerBadge`. They are the reason `ROMANISED` is a list rather than a pattern, and they are the case a cleverer rule fails |

Every anchor above is lint source inside the trust tree, which is the code this repository can
actually open. The flat law also named two files in a product repository; those are not reproduced
here, because this shelf names no repository and because a path this repository cannot open is not
something a reader can check. That limit is recorded in [`audit.md`](./audit.md) rather than papered
over with a path nobody can verify.

## Inputs

| Input | Evidence required |
|---|---|
| position | Whether this is a declaration, a local, a prop, a field in a props type, a JSX attribute or a path segment |
| scope | Whether the declaration's parent is the module or a function body |
| trigger | Whether a reader's action is what runs it, or it computes a value |
| boundary | Which slot the name is passed into, and what that slot already calls it |
| audience | Who reads the name: this file only, every call site, or every person who quotes the URL |
| language | Whether the words are content a person reads or an address a person and a machine both resolve |

## Invariants

- Every module-level declaration has the same silhouette, so a reader scanning the file is not
  parsing two grammars for one idea.
- A const cannot be used before it exists, so the order of a file states something a reader can rely
  on.
- An export has a name at the point it is exported, so a grep for it finds a definition.
- A name that crosses a boundary is the same word on both sides of it.
- `on` marks that a reader's action is what runs the thing. A computed value does not take it.
- A path is an address, not content. The words a person READS live in the locale catalogue.
- A path check is two-part, because a path cannot carry diacritics and half the evidence is lost
  before the rule sees the name.
- Every naming position resolves to exactly one code, or to the per-layer rule this module names and
  does not restate.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **A nested declaration is not module-level** (`NAMING-1`). Hoisting inside one body does not
  destroy the order of a file, because the body is read as one unit. The exemption is exercised in
  the twin test, not merely asserted here.
- **A value is not a handler** (`NAMING-2`). `on` on something a reader never triggers is a false
  statement about the thing, and this rule does not ask for it.
- **`handled` and `handler` are words, not the pattern** (`NAMING-2`). The pattern is `handle`
  followed by a capital. Widening past it buys one more catch and costs every reader's attention.
- **The locale catalogue carries the second language** (`NAMING-3`). A translation dictionary IS the
  other language; that is content, and switching it is the point.
- **English words shaped like the romanised list stay** (`NAMING-3`). `capacity` and `dangerous` open
  with the same letters as list entries. A rule that refused English words is one a repository turns
  off, and a rule that is off holds nothing.

## Output

```text
position: <declaration | local | prop | type field | jsx attribute | path segment>
code: <NAMING-1 | NAMING-2 | NAMING-3>
tier: <enforced: <rule name> | documented>
verdict: <keep | rename | rewrite as an arrow const | move the words to the locale catalogue>
reason: <what the current spelling costs at the next boundary it crosses>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping of every code, and
[`audit.md`](./audit.md) only while reviewing the canon or deciding whether a gap is worth a rule.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary TSX. Where the rule reaches a private
component, the module names the ROLE of that component — the leaf that owns a state, the slot a
handler is passed into — never its identifier in one codebase.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md).
