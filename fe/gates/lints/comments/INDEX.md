---
id: fe-lints-comments-index
title: INDEX.md
slug: /gates/lints/comments
sidebar_label: comments
sidebar_position: 0
description: What the comments rules can actually see, and — stated in full — what they cannot.
template: lints-v2
---

# INDEX.md

Version: `2.00` · Module: `comments`

## Law

The law is `patterns/comments.md`. It says a comment states what the code cannot say about itself,
that the source is one language to a stranger's standard, that every export opens with a
documentation block, and that no Unicode emoji appears in source.

This module documents something narrower and more useful: **what a machine can see of that law.**
A law is a standard a reader is held to. A rule is a string match, an AST node type and a filename
regex. The two are never the same size, and the gap between them is the subject of this file.

Three rules ship, in the plugin package `@starci/eslint-canon-fe`, under the prefix `starci-fe/`.
Six law codes exist. That arithmetic is the first fact a reader needs, and it is stated in
`## Rules` rather than smoothed over.

## Rules

| Rule | Law code | What it reports |
|---|---|---|
| `require-export-jsdoc` | `COMMENTS-1` | An exported declaration with no preceding block comment whose text opens with `*`. Reports at the declared name; the message asks for the ROLE, not the signature. |
| `no-second-language-in-source` | `COMMENTS-2`, and it implements the carve-outs of `COMMENTS-3` | A comment, identifier, string literal, template chunk or JSX text containing a letter from the second language's alphabet, in a file that is not locale content or a fixture, on a line not marked with the reason pragma. |
| `no-emoji-in-source` | `COMMENTS-4` | The same five places, containing an extended pictograph or a regional-indicator pair, in a file that is not locale content or a fixture. |

**`COMMENTS-5` and `COMMENTS-6` have no rule.** A comment that restates the line below it, and a
comment that argues without naming the decision it argues with, are both invisible to every rule in
the file. This is not a mapping to invent: judging whether a sentence adds information over the line
under it is not a thing an AST walk does. Both are recorded in `audit.md` as knowingly unenforced,
which is a safer state than a rule that pretends to cover them.

`COMMENTS-3` is only half a rule's business. Its path exceptions and its marked-literal pragma are
implemented; its requirement that the mark carry *a reason* is not — any text after the pragma
token satisfies it, including none.

## Detection

| Rule | Mechanism |
|---|---|
| `require-export-jsdoc` | Visits `ExportNamedDeclaration` and `ExportDefaultDeclaration`. Returns immediately when `node.declaration` is absent. Continues only for four declaration types: `VariableDeclaration`, `TSInterfaceDeclaration`, `FunctionDeclaration`, `TSTypeAliasDeclaration`. Satisfaction is `sourceCode.getCommentsBefore(node)` finding any comment of type `Block` whose `value` starts with the character `*`. The reported name is `declaration.id.name`, or the first declarator's id, or the literal fallback text. |
| `no-second-language-in-source` | Gate: `isContentFile(context.filename)`, a seven-pattern path list tested against the filename with backslashes rewritten to forward slashes. Then one shared visitor set — `Program` (over `sourceCode.getAllComments()`), `Identifier`, `Literal` when `typeof value === "string"`, `TemplateElement` (the `cooked` text), `JSXText`. The test is a single character class of precomposed second-language letters. Three escapes: the text contains the language's endonym, the text contains the pragma token, or `node.loc.start.line` is in the set of lines carrying a pragma comment — the comment's own line and the line after it. |
| `no-emoji-in-source` | The same content-path gate and the same five visitors. The test is two separate expressions: `\p{Extended_Pictographic}` with the `u` flag, or two consecutive code points in the regional-indicator range. No pragma, no endonym escape. |

Two mechanisms are worth naming because they close hatches other rule families leave open. The text
handed to each check is the **cooked** value of a node, so an escape sequence is compared decoded.
And the visitor watches `Literal` itself rather than an attribute or a call argument, so a string
gathered into an array, an object or a constant is still a `Literal` in the same file and is still
seen.

## Escape Hatches

### Closed

| A reader might expect this to slip past | Why it does not |
|---|---|
| An emoji or accented letter written as an escape — `"\u{1F600}"`, `"Đã huỷ"` | The check reads `node.value`, which is already decoded. Both report. |
| Prose gathered into a data structure — `["🙂"]`, `{ label: "…" }`, a lookup table of statuses | The visitor is on `Literal`, not on an attribute or a JSX prop. Collecting the string changes where it sits, not what node type it is. |
| Moving a sentence out of a comment and into a name — `const đơnHàng = …` | `Identifier` is one of the five visited places. This is the whole reason the rule is not comment-only. |
| Hiding text in a template — `` `trạng thái: ${x}` `` | `TemplateElement` is visited on its cooked chunk. |
| Text between JSX tags rather than in an attribute | `JSXText` is visited; the attribute case is an ordinary `Literal`. |
| A path exemption behaving differently on a Windows checkout | The filename is normalized to forward slashes before every pattern test, so `…\src\fixtures\a.ts` and `…/src/fixtures/a.ts` resolve identically. |
| Putting the reason pragma somewhere near the offending line | The exempt set is exactly two lines: the pragma comment's own line, and the line immediately after it. A pragma two lines up does not reach. |
| A locale file named with a region subtag — `messages/vi-VN.json` | The locale pattern is case-insensitive and accepts hyphens, so the exemption lands where it was meant to. |

### Open

| Rule | What genuinely escapes |
|---|---|
| `require-export-jsdoc` | **Splitting declaration from export.** `const a = 1` on one line and `export { a }` on another has no `declaration`, and the rule returns before any check. `export * from "./x"` and `export { a } from "./x"` are equally silent. |
| `require-export-jsdoc` | **Four types, and no more.** A class, an enum, `export default () => …`, `export default SomeName` and `export default { … }` are all outside the kind list. An exported component written as a default arrow is the single most common export shape in a front end, and it is unreachable. |
| `require-export-jsdoc` | **The block is never read.** `/** */` with nothing in it satisfies the rule. So does a block comment written for the import above it, sitting several blank lines away, because `getCommentsBefore` does not care who it was written for. The half of `COMMENTS-1` that matters — name the role, not the signature — is unenforced. |
| `require-export-jsdoc` | **One block, many declarators.** `export const a = 1, b = 2` is satisfied by a single block, and the block is inspected for neither. |
| `no-second-language-in-source` | **Tone marks, not language.** The test is a class of precomposed letters. The same sentence written without its diacritics — the way it is habitually typed in a chat window — contains none of them and reports nothing. The law's own illustration of the trap is a comment of exactly this shape, and it passes. |
| `no-second-language-in-source` | **Decomposed text.** The same words normalized to combining form render identically on screen and are built from base letters plus combining marks, none of which are in the class. A copy-paste from a source that normalizes differently is enough. |
| `no-second-language-in-source` | **Every other script.** The class covers one alphabet. Prose in a logographic, Cyrillic, Arabic, Thai or Hangul script is not second-language text as far as this rule is concerned. |
| `no-second-language-in-source` | **The endonym launders the whole node.** Any text containing the language's own name is exempt in full — the escape tests the entire string, not just the name inside it. A comment that opens with the endonym and continues for four lines is exempt for all four. |
| `no-second-language-in-source` | **The pragma exempts a line, not a value.** Every node on a marked line is exempt, including ones the mark was not written for; and a template literal that merely *starts* on the marked line is exempt for its whole body, however many lines that is. |
| `no-second-language-in-source` | **Whole test files.** The path list exempts `*.test.*` and `*.spec.*` entirely, not the fixture strings inside them. Every comment, name and message in a test file is out of reach, which is wider than the exception the law grants. |
| `no-second-language-in-source` | **Laundering through an exempt path.** Move the prose into a fixture module or the locale-content folder and import it; the import site holds an `Identifier`, and the definition sits where the rule does not look. |
| `no-second-language-in-source` | **JSX names.** A component or attribute name is a `JSXIdentifier`, which is not `Identifier`, and is not visited. |
| `no-second-language-in-source` | **Strings the program builds.** A value assembled from code points, or from halves that individually carry no marked letter, is not a literal the rule can read. |
| `no-emoji-in-source` | **Keycap sequences.** A digit or `#` followed by a variation selector and the enclosing-keycap mark renders as an emoji and matches neither expression: no part of it is an extended pictograph. |
| `no-emoji-in-source` | **Pictographs that are not emoji by property.** A star used as a rating glyph, a check mark in its plain form, an arrow, a bullet, a box-drawing character — all render as decoration, all pass. The law bans a class of *behaviour*; the rule bans a Unicode property, and the two edges do not coincide. |
| `no-emoji-in-source` | **Locale data.** `COMMENTS-4` says a product reaction is never a pictograph "in source or locale data". The rule's content-path gate exempts locale data by design, so the second half of that sentence has no enforcement at all. |
| `no-emoji-in-source` | **Degenerate pieces.** One regional indicator on its own, or a lone skin-tone modifier, is below both tests; either can be joined to something at runtime. |
| all three | **A disable comment, and the lint glob.** Any rule here is switched off for a file by one comment at the top, and does not exist at all for a file the configuration never lints. This is true of every rule in every plugin, and is listed once so no rule below claims to be airtight. |

## Inputs

| Input | Evidence required |
|---|---|
| filename | `context.filename`, normalized to forward slashes, tested against the seven content paths |
| comments | `sourceCode.getAllComments()`, both `Line` and `Block`, plus their line numbers for the pragma set |
| nodes | `Identifier`, string `Literal`, `TemplateElement`, `JSXText`, and the two export nodes |
| leading comments | `sourceCode.getCommentsBefore(node)` for the export check |

## Invariants

- A rule is cited by its published name. There is no second identifier for it, because the name is
  what a build log prints and what a disable comment spells.
- The three rules ship at `error`, and the plugin says so itself.
- The two prose rules read the same five places, so a sentence does not become legal by moving from
  a comment to a name to a string.
- A path exemption is a path, never a judgement about a file's contents.
- The export rule has no content-path gate: it applies to a fixture module exactly as it applies to
  a component.
- An open hatch is written down. A hatch nobody has written down is the dangerous kind, because the
  law is then believed to be held when it is not.

## Exceptions

- **Locale content.** A translation dictionary IS the other language. Exempt by path.
- **Fixtures and tests.** A fixture reproducing a real string must reproduce it exactly. Exempt by
  path — and, as recorded above, the exemption is broader than the sentence that justifies it.
- **A marked functional literal.** A value the running program matches on or emits stays, with the
  pragma on its line. The mark is the exception; the reason after it is convention, not enforcement.
- **The endonym.** A language picker has to render the language's own name in its own script, so
  that string is always legal.

## Output

When citing a rule against a line, state the five facts that make the citation checkable:

```text
file: <path as the linter sees it>
rule: <require-export-jsdoc | no-second-language-in-source | no-emoji-in-source>
law: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | none>
verdict: <reports | silent>
reason: <the node type and the text, or the exact escape that applies>
```

`verdict: silent` is a legitimate output and the most valuable one. It means the law was broken and
no rule saw it, which is a finding about enforcement rather than a pass.

## Load Policy

Read this file first. Read `vi.md` for what each rule catches and why the law deserves a machine at
all, `example.md` for the code that fires and the code that slips through, `audit.md` while
reviewing enforcement itself, and `changelog.md` for what changed and when.

## Scope

This module documents three rules by their published names and the law codes they enforce. Rule
identifiers and the pragma token are quoted verbatim, because those strings ship. Everything else —
every example, every path, every explanation — is ordinary source in an ordinary front end, and
names no product, library or repository.

## Version Rule

Increment all five records by `0.01` for an accepted change to what is documented here, and record
it in `changelog.md`. A rule added, removed or renamed in the source file is such a change; so is a
newly discovered open hatch.
