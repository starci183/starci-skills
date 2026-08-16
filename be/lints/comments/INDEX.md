---
id: be-lints-comments-index
title: INDEX.md
slug: /be/lints/comments
sidebar_label: comments
sidebar_position: 0
description: What a machine can and cannot see of the comments law, rule by rule.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `comments`

## Law

A comment answers the one question the code cannot: **why**. The law that states this lives in
`canon/patterns/comments.md` and carries five codes, `COMMENT-1` through `COMMENT-5`.

This module documents something narrower and more useful: **which part of that law a machine
actually holds**. A law is a sentence a reader obeys. A rule is a pattern a program matches. They
are never the same size, and the difference is the entire subject here.

Three rules ship. Five codes exist. The gap is not an oversight to be tidied away — one of the
codes cannot be checked by any program, and one of the rules holds only half of the code it is
named for. Both facts are stated below rather than rounded off, because **a leaky rule believed to
be closed is more dangerous than a law known to be unenforced.**

## Rules

Three rules are published, from the module's `rules` export, at `error` in its `recommended`
export. They ship in the package `@starci/eslint-canon-be` under the plugin prefix `starci-be/`.

| Rule | Code | What it reports |
|---|---|---|
| `require-export-jsdoc` | `COMMENT-1` | An exported class, interface, type alias, enum, function declaration, or `const` bound to a literal function expression, with no `/** … */` block before it |
| `require-enum-member-jsdoc` | `COMMENT-2`, existence half only | A member of an exported enum with no `/** … */` block before it |
| `no-non-ascii-source` | `COMMENT-4`, with `COMMENT-5` as its marker | A source line carrying a Vietnamese letter, an emoji, or one of twelve listed ornamental symbols |

Two findings live in this table.

**`COMMENT-3` has no rule.** "The comment says why, and the code says what" is enforced by nobody.
This is not a missing rule to be written; it is a code no program can hold, because deciding whether
a sentence restates the line beneath it requires understanding both. It is listed here so that
nobody reads a green build as evidence that `COMMENT-3` is satisfied.

**`COMMENT-2` is enforced at half strength, and the rule says so in its own message.** The code
demands that a member state the CONSEQUENCE of choosing it. A rule can see that a doc block exists
and never that it says anything. `/** The pending state. */` — the exact text the law prints as its
counter-example — passes.

**`COMMENT-5` is not a rule; it is the escape hatch of `no-non-ascii-source`.** Text a program
matches on or emits stays, marked `vn-ok`. The marker is what makes the third rule survivable, and
it is also that rule's widest open door.

## Detection

Read this table before trusting any of these rules. Every mechanism below was confirmed by running
the rules against constructed sources, not inferred from their names.

| Rule | Mechanism |
|---|---|
| `require-export-jsdoc` | Visits `ExportNamedDeclaration` and `ExportDefaultDeclaration`. Reads `node.declaration`; returns immediately when it is absent. For a `VariableDeclaration`, inspects `declarations[0].init` only and continues **only** if that init's type is `ArrowFunctionExpression` or `FunctionExpression`. Otherwise requires `declaration.type` to be one of `TSInterfaceDeclaration`, `TSTypeAliasDeclaration`, `TSEnumDeclaration`, `ClassDeclaration`, `FunctionDeclaration`. Then calls `sourceCode.getCommentsBefore(node)` and passes if **any** returned comment has `type === "Block"` and a `value` beginning with `*`. |
| `require-enum-member-jsdoc` | Visits `TSEnumDeclaration`. Returns unless `node.parent.type === "ExportNamedDeclaration"`. Iterates `node.members` and applies the same `getCommentsBefore` / `Block` / leading-`*` test to each member node. |
| `no-non-ascii-source` | Reads `context.filename`, normalises backslashes to forward slashes, and returns an empty visitor when the path matches `/(?:messages\|locales\|i18n)/`. Computes a fixture lane from `\.spec\.ts$`, `-spec\.ts$` or `/src/tests/`; inside that lane it builds a line-number set from the spans of `sourceCode.getAllComments()`. At `Program:exit` it walks `sourceCode.getLines()` — **raw text, not AST** — skips any line matching `\bvn-ok\b`, skips non-comment lines when in the fixture lane, strips the first occurrence of the string `Tiếng Việt`, then tests three character classes in order: Vietnamese letters, emoji ranges (`1F300–1FAFF`, `1F000–1F0FF`, `2600–27BF`, `FE0F`, `1F1E6–1F1FF`), and a twelve-character ornament literal. |

The third row is the one worth rereading. Because `no-non-ascii-source` never touches the AST, it is
immune to the laundering that defeats most literal-matching rules — gathering a string into a
constant, an array or an object does not hide it, since the characters are still on some line. It
buys that immunity by being unable to tell a comment from an identifier from a seed row.

## Escape Hatches

### Closed

| Way of writing it | Why it does not slip past |
|---|---|
| `// what this is for` above an export | `require-export-jsdoc` requires `type === "Block"`; a line comment is `Line` and never satisfies it |
| `/* what this is for */` above an export | The block's `value` must begin with `*`; a plain block comment's does not |
| Renaming the file to dodge `require-export-jsdoc` | Neither JSDoc rule reads `context.filename` at all, so there is no name to change |
| `export default class` / `export default function` | `ExportDefaultDeclaration` is visited by the same handler as the named form |
| A doc on the enum standing in for its members | `getCommentsBefore` is called on each member node; the declaration's own doc sits before the export node and is never returned for a member |
| Gathering a Vietnamese string into a constant, array or object | `no-non-ascii-source` scans raw lines, so no syntactic move relocates the characters out of its view |
| Splitting an offending string across a concatenation | Each fragment still occupies a line, and each line is scanned independently |

### Open

Every row below was measured. None is theoretical, and none requires bad faith to reach — most are
what tidying up looks like.

| Way of writing it | What the rule misses |
|---|---|
| `export { Thing }` or `export { Thing } from "./thing"` | `node.declaration` is absent and the rule returns at once. A barrel file can publish an entire undocumented surface, and the rule reports nothing on either side |
| `export * from "./thing"` | `ExportAllDeclaration` has no visitor at all |
| `export const run = make(1)`, `= memo(() => {})`, `= other.bind(null)`, `= class {}` | The init is a `CallExpression` or `ClassExpression`, not a literal function expression, so a callable or constructable surface is treated as a data constant and skipped |
| `export default () => {}` and `export default { … }` | The declaration is neither a `VariableDeclaration` nor one of the five documented kinds. The same arrow written as `export const f = () => {}` is checked — the exemption depends on the export FORM, not on what is exported |
| `export const MAX = 3, run = () => {}` | Only `declarations[0]` is inspected. The first declarator being data ends the check for the whole statement, and `run` escapes. Swapping the order makes it fire |
| `/** */` above an export or an enum member | The value is `* `, which begins with `*`, so an empty doc block satisfies both JSDoc rules |
| A file banner above the first export | `getCommentsBefore` returns every leading comment and **any** qualifying one passes. A module header, or a doc orphaned by a deleted declaration, serves as the next export's doc |
| An overload signature | A signature without a body parses as `TSDeclareFunction`, which is not in the documented-kinds set. The doc is demanded on the implementation instead — the one signature callers never read — and a file of pure signatures is entirely silent |
| A public method on a documented exported class | The rule stops at the declaration. Surface below the top level is out of scope, though other files depend on it exactly as much |
| `export declare const CONFIG: Shape` | A `VariableDeclaration` with no init cannot be a function expression, so ambient exports are skipped |
| `enum State { … }` then `export { State }` on the next line | The enum's parent is the program body rather than an export, and every member requirement disappears. Detaching one keyword disarms the rule |
| `export const State = { Pending: "pending" } as const` | Silent under **both** JSDoc rules — a data constant to the first, not a `TSEnumDeclaration` to the second. The construct most often reached for in place of an enum is the one neither rule covers |
| `export type State = "pending" \| "settled"` | The alias needs one doc; the members need none. The relationship `COMMENT-2` exists to protect is gone, and the build is green |
| A doc block whose sentence restates the name | Both JSDoc rules check existence, never content. This is `COMMENT-3` and half of `COMMENT-2`, and no rule holds either |
| Unaccented prose in a second language | The letter class matches diacritics. A comment written without them carries no matching codepoint and passes completely. The rule detects one orthography, not one language, and the source's own reasoning quotes such a sentence while discussing it |
| Prose in Russian, Chinese, Japanese, Korean, Thai or Greek | None of those scripts is in any of the three classes. The law refuses a codebase with two languages in it; the rule refuses one specific alphabet |
| `→` (`U+2192`), `⇒`, `●`, `⬛`, `⭕` (`U+2B55`), box-drawing runs | The ornament set is a hand-written list of twelve characters. `⭐` (`U+2B50`) is on it and `⭕` is not; the emoji arrow `➡` falls inside `2600–27BF` and is caught, while the arrow anyone would actually type is not |
| `"Đặt hàng"` | The line is pure ASCII and the program still emits the same text at runtime. A formatter that escapes non-ASCII output produces this without anyone deciding to |
| Any file inside a folder named `messages`, `locales` or `i18n` | The rule returns an empty visitor, so the exemption covers the file's COMMENTS as well as its copy. A folder ban is not a file ban: the same content in `payment/messages.ts` is policed in full, and moving one file into an `i18n/` folder exempts every line of it permanently |
| Renaming a spec | The fixture lane is `\.spec\.ts$`, `-spec\.ts$` or `/src/tests/`. `foo.spec.ts` exempts its strings; the identical file as `foo.test.ts` does not, and neither does `__tests__/helper.ts` |
| Extracting fixtures out of a spec into a helper module | The helper is outside the lane, so data written to be legal becomes a wall of errors on the day it is tidied into its own file |
| `// vn-ok` with no reason, anywhere on the line | The marker regex is `\bvn-ok\b` and nothing more. The message asks for `vn-ok: <reason>`; the rule never checks for one |
| A marked line that also carries untranslated prose | The marker exempts the WHOLE line. One legitimate provider string beside a sentence of reasoning passes wholesale — measured silent |
| The marker itself | Nothing distinguishes data from prose but the author's assertion. `COMMENT-5`'s boundary is entirely on the honour system |

## Inputs

| Input | Evidence required |
|---|---|
| rule | The published name, verbatim, as it appears in a build log |
| code | The `COMMENT-<n>` it enforces, or an explicit `none` |
| file | The path as `context.filename` sees it, forward-slashed |
| construct | The AST node or raw line the mechanism actually matches |
| lane | Whether the path falls in a locale folder, the fixture lane, or ordinary source |

## Invariants

- A rule's identity is its published NAME. It carries no numeric code of its own.
- A rule name is reproduced verbatim, including any product word inside it, because that string is
  what a build prints and what a disable comment must spell.
- Every rule documented here exists in the published `rules` export. A rule that ought to exist is
  a proposal and belongs in `audit.md`.
- Every rule has at least one honest open row, or an argument for why it is airtight.
- A law code with no rule is recorded as unenforced rather than mapped to the nearest rule.
- Existence checks are never reported as content checks.

## Exceptions

Exceptions here are properties of the rules, not relief from the law.

- **The marked literal.** A line matching `\bvn-ok\b` is skipped entirely by `no-non-ascii-source`.
  This is `COMMENT-5` working as intended, and it is per-line, unverified and total.
- **The locale folder.** Paths containing `messages/`, `locales/` or `i18n/` disable the third rule
  completely. Policing product copy would be policing the product.
- **The fixture lane.** In `*.spec.ts`, `*-spec.ts` and `src/tests/`, only comment lines are
  policed. A sentence a real person would type is data being fed to a system; a comment in a spec is
  prose, and is still refused.
- **The data constant.** `export const MAX_ATTEMPTS = 3` is exempt from `require-export-jsdoc` by
  design, because demanding a sentence there produces sentences that restate the name — which
  `COMMENT-3` forbids and no rule can catch.
- **The endonym.** The string `Tiếng Việt` is stripped once per line before the letter test, being a
  label rather than prose. The strip is non-global, so a line carrying it twice still reports.

## Output

```text
rule: <require-export-jsdoc | require-enum-member-jsdoc | no-non-ascii-source>
code: <COMMENT-1 | COMMENT-2 | COMMENT-4 | none>
file: <path>:<line>
construct: <AST node or raw line the mechanism matched>
verdict: <fires | silent>
reason: <the fact that decides it, naming the mechanism>
```

## Load Policy

Read this file first. Read `vi.md` for why each rule is worth having a machine hold, `example.md`
for the code that fires and the code that slips through, `audit.md` while deciding whether a rule
should change, and `changelog.md` for what moved.

## Scope

This module documents the enforcement of one law over source comments. It names no product, no
component library and no repository. The only product words on this page are inside identifiers that
ship — a rule name, a plugin prefix, a package name — and those are reproduced exactly, because a
renamed identifier is a different identifier.

## Version Rule

Increment all five records by `0.01` for an accepted change and record it in `changelog.md`. A rule
added, removed or renamed in the source is a change to this module even when the law is untouched.
