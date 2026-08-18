---
title: Comments
runtime: true
source: en.md
sourceHash: f8c59b99655eb4b6e260baf98ba2a41583a9eda18ea099b9eb21801ae2d72f7d
contextVersion: 1
---

# Comments

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is code that is already written — one file, one hunk of a diff. The output is a **verdict**:
whether the file was in scope at all, which published rule fired, what it reported and on which node,
which law code that maps to, and the open hatch that would have hidden the same failure. This module
chooses nothing. It refuses, and it must be able to point at the character it refuses on.

## Law

The law is `patterns/comments.md`. It says a comment states what the code cannot say about itself,
that the source is one language to a stranger's standard, that every export opens with a
documentation block, and that no Unicode emoji appears in source.

This module documents something narrower and more useful: **what a machine can see of that law.** A
law is a standard a reader is held to. A rule is a string match, an AST node type and a filename
regex. The two are never the same size, and the gap between them is the subject of this file.

The law states **six codes. Three rules ship**, in the plugin package `@canon-fe`,
under the prefix `starci-fe/`. That arithmetic is the first fact a reader needs, and it is stated
here rather than smoothed over.

## Published rules

| Rule | Code | What it reports |
|---|---|---|
| `require-export-jsdoc` | `COMMENTS-1` | An exported declaration with no preceding block comment whose text opens with `*`. Reports at the declared name; the message asks for the ROLE, not the signature. |
| `no-second-language-in-source` | `COMMENTS-2`, and it implements the carve-outs of `COMMENTS-3` | A comment, identifier, string literal, template chunk or JSX text containing a letter from the second language's alphabet, in a file that is not locale content or a fixture, on a line not marked with the reason pragma. |
| `no-emoji-in-source` | `COMMENTS-4` | The same five places, containing an extended pictograph or a regional-indicator pair, in a file that is not locale content or a fixture. |

**`COMMENTS-5` and `COMMENTS-6` have no rule.** A comment that restates the line below it, and a
comment that argues without naming the decision it argues with, are both invisible to every rule in
this module. They are knowingly unenforced, not covered: judging whether a sentence adds information
over the line under it is not a thing an AST walk does, and a green run says nothing about either.

`COMMENTS-3` is only half a rule's business. Its path exceptions and its marked-literal pragma are
implemented; its requirement that the mark carry *a reason* is not — any text after the pragma token
satisfies it, including none.

## Reading a diff

1. **Decide scope before anything else, and record it.** Out of scope here does not mean the file
   passed — it means the rule returned an empty visitor set and did not exist for that file.
2. **Check the content-path gate.** `isContentFile(context.filename)` is tested with backslashes
   rewritten to forward slashes against seven path patterns. A match switches off both prose rules.
   `require-export-jsdoc` has no such gate and applies everywhere the config lints.
3. **Read the nodes, all five of them** — comments, `Identifier`, string `Literal`, `TemplateElement`,
   `JSXText` — plus the two export nodes. A sentence does not become legal by moving between them.
4. **Emit one block per finding.**
5. **Write the `hatch` line whenever an open hatch would have hidden the same failure**, and emit
   `verdict: silent` when the law was broken and no rule saw it. That is a finding about enforcement,
   not a pass.
6. **Do not report what no rule watches.** Two of the six codes have no machine; a verdict that
   claims otherwise is wrong about the module.

## `require-export-jsdoc` — COMMENTS-1

**What it reports.** An exported declaration with no preceding block comment whose text opens with
`*`, reported at the declared name. The message asks for the ROLE of the export, not its signature.

**How it detects.** It visits `ExportNamedDeclaration` and `ExportDefaultDeclaration`, and returns
immediately when `node.declaration` is absent. It continues only for four declaration types:
`VariableDeclaration`, `TSInterfaceDeclaration`, `FunctionDeclaration`, `TSTypeAliasDeclaration`.
Satisfaction is `sourceCode.getCommentsBefore(node)` finding any comment of type `Block` whose
`value` starts with the character `*`. The reported name is `declaration.id.name`, or the first
declarator's id, or the literal fallback text.

**What it cannot see.** **Splitting declaration from export**: `const a = 1` on one line and
`export { a }` on another has no `declaration`, and the rule returns before any check;
`export * from "./x"` and `export { a } from "./x"` are equally silent. **Four types, and no more**:
a class, an enum, `export default () => …`, `export default SomeName` and `export default { … }` are
all outside the kind list — an exported component written as a default arrow is the single most
common export shape in a front end, and it is unreachable. **The block is never read**: `/** */`
with nothing in it satisfies the rule, and so does a block comment written for the import above it
sitting several blank lines away, because `getCommentsBefore` does not care who it was written for.
The half of `COMMENTS-1` that matters — name the role, not the signature — is unenforced. **One
block, many declarators**: `export const a = 1, b = 2` is satisfied by a single block, and the block
is inspected for neither.

**Boundary.** This rule counts the existence of a block. What the block says is `COMMENTS-5` and
`COMMENTS-6`, which have no rule at all. This rule has no content-path gate: it applies to a fixture
module exactly as it applies to a component.

## `no-second-language-in-source` — COMMENTS-2, COMMENTS-3

**What it reports.** A comment, identifier, string literal, template chunk or JSX text containing a
letter from the second language's alphabet, in a file that is not locale content or a fixture, on a
line not marked with the reason pragma.

**How it detects.** The gate is `isContentFile(context.filename)`, a seven-pattern path list tested
against the filename with backslashes rewritten to forward slashes; a match returns an empty visitor
set. Otherwise the rule first collects the set of lines carrying a `vn-ok:` pragma comment — the
comment's own line and the line after it — then installs one shared visitor set: `Program` (over
`sourceCode.getAllComments()`), `Identifier`, `Literal` when `typeof value === "string"`,
`TemplateElement` (the `cooked` text), `JSXText`. The test is a single character class of
precomposed second-language letters. Three escapes: the text contains the language's endonym, the
text contains the pragma token, or `node.loc.start.line` is in the marked-line set.

**What it cannot see.** **Tone marks, not language** — the test is a class of precomposed letters, so
the same sentence written without its diacritics, the way it is habitually typed in a chat window,
contains none of them and reports nothing; the law's own illustration of the trap is a comment of
exactly this shape, and it passes. **Decomposed text** — the same words normalized to combining form
render identically on screen and are built from base letters plus combining marks, none of which are
in the class. **Every other script** — the class covers one alphabet, so prose in a logographic,
Cyrillic, Arabic, Thai or Hangul script is not second-language text as far as this rule is
concerned. **The endonym launders the whole node** — the escape tests the entire string, so a comment
that opens with the endonym and continues for four lines is exempt for all four. **The pragma exempts
a line, not a value** — every node on a marked line is exempt, including ones the mark was not
written for, and a template literal that merely *starts* on the marked line is exempt for its whole
body, however many lines that is. **Whole test files** — the path list exempts `*.test.*` and
`*.spec.*` entirely, not the fixture strings inside them, which is wider than the exception the law
grants. **Laundering through an exempt path** — move the prose into a fixture module or the
locale-content folder and import it; the import site holds an `Identifier`, and the definition sits
where the rule does not look. **JSX names** — a component or attribute name is a `JSXIdentifier`,
which is not `Identifier`, and is not visited. **Strings the program builds** — a value assembled
from code points, or from halves that individually carry no marked letter, is not a literal the rule
can read.

**Boundary.** This rule is where the path exceptions and the pragma of `COMMENTS-3` are implemented.
The half of `COMMENTS-3` that asks the mark to carry a reason is not implemented anywhere: any text
after the token satisfies it, including none.

## `no-emoji-in-source` — COMMENTS-4

**What it reports.** An extended pictograph, or a regional-indicator pair, in the same five places
the prose rule watches, in a file that is not locale content or a fixture.

**How it detects.** The same content-path gate and the same five visitors. The test is two separate
expressions rather than one merged class: `\p{Extended_Pictographic}` with the `u` flag, or two
consecutive code points in the regional-indicator range. There is no pragma and no endonym escape.

**What it cannot see.** **Keycap sequences** — a digit or `#` followed by a variation selector and
the enclosing-keycap mark renders as an emoji and matches neither expression, because no part of it
is an extended pictograph. **Pictographs that are not emoji by property** — a star used as a rating
glyph, a check mark in its plain form, an arrow, a bullet, a box-drawing character all render as
decoration and all pass; the law bans a class of *behaviour*, the rule bans a Unicode property, and
the two edges do not coincide. **Locale data** — `COMMENTS-4` says a product reaction is never a
pictograph "in source or locale data", and the content-path gate exempts locale data by design, so
the second half of that sentence has no enforcement at all. **Degenerate pieces** — one regional
indicator on its own, or a lone skin-tone modifier, is below both tests, and either can be joined to
something at runtime.

**Boundary.** The rule also runs the other way: a copyright, registered, trademark, warning or
telephone sign carries the extended-pictograph property, so a footer copyright line **is reported**.
That is a cost to know in advance, not an open hatch.

## Detection

| Part | Mechanism |
|---|---|
| separator normalisation | The filename is normalized to forward slashes before every pattern test, so `…\src\fixtures\a.ts` and `…/src/fixtures/a.ts` resolve identically |
| the path gate | `isContentFile(context.filename)`, seven path patterns; a match returns an empty visitor object, so both prose rules do not exist for that file rather than passing it |
| the five places | `Program` over `sourceCode.getAllComments()`, `Identifier`, `Literal` when `typeof value === "string"`, `TemplateElement` on its `cooked` text, `JSXText` — shared by both prose rules |
| the reader | The text handed to each check is the **cooked** value of a node, so an escape sequence is compared decoded |
| the node choice | The visitor watches `Literal` itself rather than an attribute or a call argument, so a string gathered into an array, an object or a constant is still a `Literal` in the same file and is still seen |
| the pragma set | Lines carrying a `vn-ok:` comment: the comment's own line, plus exactly the line after it |
| leading comments | `sourceCode.getCommentsBefore(node)` for the export check, which reads presence and never content |
| two expressions, not one class | The emoji test is split into `\p{Extended_Pictographic}` and the regional-indicator pair on purpose: merging them into one character class would trip another rule about confusing character classes, and a rule that must switch off another rule to exist is not one anybody trusts |

## Escape hatches

**Closed** — a reader might expect these to slip past, and they do not.

| Written this way | Why it still fires |
|---|---|
| An emoji or accented letter written as an escape — `"\u{1F600}"`, `"Đã huỷ"` | The check reads `node.value`, which is already decoded. Both report |
| Prose gathered into a data structure — `["🙂"]`, `{ label: "…" }`, a lookup table of statuses | The visitor is on `Literal`, not on an attribute or a JSX prop. Collecting the string changes where it sits, not what node type it is |
| Moving a sentence out of a comment and into a name — `const đơnHàng = …` | `Identifier` is one of the five visited places. This is the whole reason the rule is not comment-only |
| Hiding text in a template — `` `trạng thái: ${x}` `` | `TemplateElement` is visited on its cooked chunk |
| Text between JSX tags rather than in an attribute | `JSXText` is visited; the attribute case is an ordinary `Literal` |
| A path exemption behaving differently on a Windows checkout | The filename is normalized to forward slashes before every pattern test |
| Putting the reason pragma somewhere near the offending line | The exempt set is exactly two lines: the pragma comment's own line, and the line immediately after it. A pragma two lines up does not reach |
| A locale file named with a region subtag — `messages/vi-VN.json` | The locale pattern is case-insensitive and accepts hyphens, so the exemption lands where it was meant to |

**Open** — shipped blindness. A verdict must not claim these were judged.

| Rule | What genuinely escapes |
|---|---|
| `require-export-jsdoc` | **Splitting declaration from export.** `const a = 1` then `export { a }` has no `declaration`, and the rule returns before any check. `export * from "./x"` and `export { a } from "./x"` are equally silent |
| `require-export-jsdoc` | **Four types, and no more.** A class, an enum, `export default () => …`, `export default SomeName` and `export default { … }` are outside the kind list — and a default arrow is the most common export shape in a front end |
| `require-export-jsdoc` | **The block is never read.** `/** */` satisfies the rule, and so does a block written for the import above it several blank lines away |
| `require-export-jsdoc` | **One block, many declarators.** `export const a = 1, b = 2` is satisfied by a single block, inspected for neither |
| `no-second-language-in-source` | **Tone marks, not language.** The same sentence typed without diacritics contains nothing in the class. The law's own illustration of the trap passes |
| `no-second-language-in-source` | **Decomposed text.** Base letters plus combining marks render identically and are not in the class |
| `no-second-language-in-source` | **Every other script.** The class covers one alphabet |
| `no-second-language-in-source` | **The endonym launders the whole node.** The escape tests the entire string, not the name inside it |
| `no-second-language-in-source` | **The pragma exempts a line, not a value.** Every node on the marked line is exempt, and a template that merely starts there is exempt for its whole body |
| `no-second-language-in-source` | **Whole test files.** `*.test.*` and `*.spec.*` are exempt entirely, which is wider than the exception the law grants |
| `no-second-language-in-source` | **Laundering through an exempt path.** The import site holds an `Identifier`; the definition sits where the rule does not look |
| `no-second-language-in-source` | **JSX names.** A `JSXIdentifier` is not `Identifier`, and is not visited |
| `no-second-language-in-source` | **Strings the program builds.** A value assembled at runtime is not a literal the rule can read |
| `no-emoji-in-source` | **Keycap sequences.** No part of a digit, variation selector and enclosing-keycap mark is an extended pictograph |
| `no-emoji-in-source` | **Pictographs that are not emoji by property.** A star, a thin check mark, an arrow, a bullet, a box-drawing character all pass |
| `no-emoji-in-source` | **Locale data.** The half of `COMMENTS-4` that names locale data has no enforcement at all |
| `no-emoji-in-source` | **Degenerate pieces.** A lone regional indicator or skin-tone modifier is below both tests |
| all three | **A disable comment, and the lint glob.** Any rule here is switched off for a file by one comment at the top, and does not exist at all for a file the configuration never lints. This is listed once so no rule above claims to be airtight |
| none | **Everything `COMMENTS-5` and `COMMENTS-6` forbid** — a comment that restates the line below it, and a comment that argues without naming the decision it argues with |

## Rules

1. A rule is cited by its published name. There is no second identifier for it, because the name is
   what a build log prints and what a disable comment spells.
2. The three rules ship at `error`, and the plugin says so itself.
3. The two prose rules read the same five places, so a sentence does not become legal by moving from
   a comment to a name to a string.
4. A path exemption is a path, never a judgement about a file's contents.
5. The export rule has no content-path gate: it applies to a fixture module exactly as it applies to
   a component.
6. Out of scope means no visitor is installed, not that the file passed.
7. An open hatch is written down. A hatch nobody has written down is the dangerous kind, because the
   law is then believed to be held when it is not.

## Exceptions

- **Locale content.** A translation dictionary IS the other language. Exempt by path — and, as
  recorded above, this releases the half of `COMMENTS-4` that names locale data.
- **Fixtures and tests.** A fixture reproducing a real string must reproduce it exactly. Exempt by
  path — and the exemption is broader than the sentence that justifies it: it releases every comment,
  name and message in a `*.test.*` or `*.spec.*` file, not only the fixture strings inside them.
- **A marked functional literal.** A value the running program matches on or emits stays, with the
  `vn-ok:` pragma on its line. The mark is the exception; the reason after it is convention, not
  enforcement, so this releases the reason half of `COMMENTS-3` — and it releases the whole line, not
  the marked value.
- **The endonym.** A language picker has to render the language's own name in its own script, so that
  string is always legal — and the escape releases the entire node it appears in.

## Output

One block per finding:

```text
file: <path as the linter sees it>
rule: <require-export-jsdoc | no-second-language-in-source | no-emoji-in-source>
law: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | none>
scope: <in | out — the path test that decided it>
verdict: <reports | silent>
reason: <the node type and the text, or the exact escape that applies>
hatch: <the open hatch that would have hidden this, or none>
```

A clean file emits one block per rule with `verdict: silent` and `reason: nothing matched` — which is
an absence of reports, never proof of compliance. An out-of-scope file emits `scope: out` with the
matched path pattern and no `verdict` at all, because no visitor was installed.

`verdict: silent` on a file that breaks the law is a legitimate output and the most valuable one. It
means the law was broken and no rule saw it, which is a finding about enforcement rather than a pass.
