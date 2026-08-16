---
id: fe-patterns-comments-index
title: INDEX.md
slug: /gates/patterns/comments
sidebar_label: comments
sidebar_position: 0
description: Binding rules for what a comment, a documentation block, an identifier and a diagnostic string may say, and in which language.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `comments`

## Law

A comment is what the code cannot say about itself. The code already states what happens; a comment
states why it happens that way, what breaks without it, and which alternative was refused. Anything
that merely renames the line below it is noise, and noise trains a reader to skip the comment that
mattered.

Two questions settle everything here. **Would a stranger reach the same conclusion from the code
alone?** If yes, the comment is not needed. **Can a reader who does not share your first language
read it?** If no, it is not written yet.

The second question is the one this module is strictest about, and the bar is deliberately not
"English where convenient". The source is English-only, to a stranger's standard, and the exceptions
are three, narrow, and named.

**This is binding, not advisory.** The scope is not comments. It is every position in a source file
where prose can hide: block comments, line comments, identifiers, string literals, template chunks,
JSX text and diagnostic messages. A rule that reached only comments would leave the same sentence
legal one line lower as a variable name, which is where it goes the moment the rule arrives.

## Situation Codes

Every situation this module governs carries a code, `COMMENTS-<n>`. The code names the SITUATION.
The codes are cited from other law files and from task records, so a number, once issued, is never
reused for a different meaning and never renumbered.

| Code | What it requires | What it forbids |
|---|---|---|
| `COMMENTS-1` | Every export opens with a documentation block naming the ROLE it plays | An export with no block; a block that restates the signature; ceremony blocks on internal helpers |
| `COMMENTS-2` | Comments, JSDoc, identifiers and diagnostic messages in English, to a stranger's standard | A second language in any authoring position, including one line lower as a name |
| `COMMENTS-3` | Locale content, exact fixtures and marked functional literals stay; the mark carries the reason | An unmarked functional literal in another language; a fourth exception argued per file |
| `COMMENTS-4` | Generic interface marks come from the icon vocabulary; product reactions use attributed checked-in artwork through the reaction leaf | A Unicode pictograph in an identifier, comment, diagnostic or non-content string |
| `COMMENTS-5` | A comment that restates its line is deleted | Rewriting a restatement into a better restatement |
| `COMMENTS-6` | A comment that has to argue names the decision: what was tried, what it cost, why the obvious shape is refused | A refusal recorded nowhere, so the next reader undoes it |

`COMMENTS-3` IS AN EXCEPTION CLAUSE, NOT A LICENCE. It is stated as a code so that a reader can cite
it, be corrected against it, and be shown to have got it wrong. An exception with no name is one
nobody can be argued out of.

## Tầng giữ

Which tier actually holds each code. `unrepresentable` means a closed union or branded type makes the
wrong value impossible to write; `enforced` means a rule in
[`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) reports it; `documented` means nothing
mechanical holds it and only a reader does.

| Code | Tier | Held by | What the tier does not reach |
|---|---|---|---|
| `COMMENTS-1` | `enforced` | `starci-fe/require-export-jsdoc` | Presence of a block only. Whether the block names the role or restates the signature is unread, and an exported `class`, `enum` or anonymous `export default` is outside the declaration kinds the rule inspects |
| `COMMENTS-2` | `enforced` | `starci-fe/no-second-language-in-source` | Regex literals, which are not string `Literal` nodes and are never visited |
| `COMMENTS-3` | `enforced` | `starci-fe/no-second-language-in-source` (`CONTENT_PATHS`, `isContentFile`, `OK_PRAGMA`) | The mark is read; the REASON after `vn-ok:` is not. `// vn-ok:` with nothing after it passes |
| `COMMENTS-4` | `enforced` | `starci-fe/no-emoji-in-source` | Content files are exempt wholesale, so a pictograph in locale data passes the rule while this law forbids it |
| `COMMENTS-5` | `documented` | — | Nothing. Deciding whether a sentence adds information over the statement below it is paraphrase detection, not parsing |
| `COMMENTS-6` | `documented` | — | Nothing. The shape that was refused is not in the tree; only a reader who knows the alternative can see it is missing |

Three codes are held only in part and two not at all. Every gap above is restated in
[`audit.md`](./audit.md) with what a rule would have to see, because a tier table that rounds
"partly" up to "enforced" is how a repository comes to believe it is protected.

## Anchor

Real code each code can be checked against. A law that cannot be pointed at in real code is a
proposal, not a law.

| Code | Anchor | What to look for |
|---|---|---|
| `COMMENTS-1` | [`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) | Every `export const` in the file opens with a block that names a role — `SECOND_LANGUAGE_LETTER` says which letters and why they matter, not that it is a regex. Compare with `hasBlock` inside `requireExportJsdoc.create`, which is the whole of what the rule actually reads |
| `COMMENTS-2` | [`sources/fe/comments.test.mjs`](../../../../sources/fe/comments.test.mjs) | The three invalid cases are one sentence in three positions: a comment, a string, a template chunk. That triple is the argument for the rule's reach, written as a test |
| `COMMENTS-3` | [`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) | `CONTENT_PATHS` and `isContentFile` for the two path exceptions, `OK_PRAGMA` and the `marked` set inside `noSecondLanguageInSource.create` for the third. The valid cases at the `LOCALE` and `FIXTURE` filenames in the twin test show each exception exercised |
| `COMMENTS-4` | [`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) | `hasEmoji`, and its block explaining why it is two tests rather than one character class. The regional-indicator pair case in the twin test is the one a single pictograph test misses |
| `COMMENTS-5` | [`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) | The one-line block on `normalizePath`: it says why forward slashes are chosen, not that a replace happens. The restating version of that same block would be legal everywhere and teach nothing |
| `COMMENTS-6` | [`sources/fe/comments.mjs`](../../../../sources/fe/comments.mjs) | The block above `const marked` inside `noSecondLanguageInSource.create`: it records what the exemption used to test, why no phrasing could satisfy it, and why the rule's own valid fixture passed for the wrong reason. That is a refusal a reader would otherwise undo |

Every anchor above is lint source inside the trust tree, which is the code this repository can
actually open. No component-tree anchor is verifiable from here; that limit is recorded in
[`audit.md`](./audit.md) rather than papered over with a path nobody can check.

## Inputs

| Input | Evidence required |
|---|---|
| site | Which prose position this is: block comment, line comment, identifier, string literal, template chunk, JSX text or diagnostic message |
| file | The path, and whether it matches a content path — locale dictionary, fixture, test or spec |
| binding | Whether the declaration is exported, and therefore read by people who never open the body |
| runtime role | Whether a literal is prose a human reads, or a value the program matches on or emits |
| claim | What the comment asserts that the line below does not already state |
| refusal | Which alternative was tried and rejected, and what it cost |

## Invariants

- Every export opens with a documentation block. Internal helpers do not require one.
- A documentation block names the role. The signature already states the signature, in a form that
  cannot go stale.
- Every authoring position is English: comment, JSDoc, identifier, literal, template chunk, JSX text,
  diagnostic message.
- Moving a sentence out of a comment and into a name does not translate it, and does not exempt it.
- The exceptions are three, closed and named. Locale content, exact fixtures, marked functional
  literals.
- A functional literal in another language carries its reason on its own line. Unmarked, it is
  indistinguishable from prose somebody forgot to translate.
- No Unicode pictograph in an authoring position. Generic marks come from the icon vocabulary;
  product reactions use attributed checked-in artwork through the reaction leaf.
- A comment that restates its line is deleted, not improved.
- A comment that argues names the decision it argues with.
- Every prose site resolves to exactly one code. There is no line short enough to be out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Locale content is not authoring** (`COMMENTS-3`). A translation dictionary IS the other language.
  Holding it to `COMMENTS-2` would empty the product.
- **A fixture reproduces a real string exactly** (`COMMENTS-3`). Translated, it is testing something
  else.
- **A functional literal stays, marked** (`COMMENTS-3`). A value the running program matches on or
  emits is not prose. The mark on its own line carries the reason, and the mark is the point: without
  it a reader has to decide, and the next one decides differently.
- **Internal helpers carry no required block** (`COMMENTS-1`). Requiring one on every helper produces
  a file where half the lines are ceremony and no block is read.
- **A re-export has no declaration to document** (`COMMENTS-1`). `export { X }` states a binding, not
  a contract; the contract belongs where `X` was declared.
- **Exceptions are paths, not judgements** (`COMMENTS-3`). A judgement-based exception would be
  argued per file forever, and the argument would be won by whoever was in a hurry.

## Output

```text
site: <comment | jsdoc | identifier | literal | template | jsx-text | diagnostic>
file: <path> (<authoring | content>)
code: <COMMENTS-1 | COMMENTS-2 | COMMENTS-3 | COMMENTS-4 | COMMENTS-5 | COMMENTS-6>
tier: <enforced: <rule name> | documented>
verdict: <keep | rewrite | delete | mark | move to the icon vocabulary>
reason: <what a reader learns here that the line does not already say>
```

## Load Policy

Read this file first. Read [`vi.md`](./vi.md) for the business situation behind each code,
[`example.md`](./example.md) for the cases, exceptions and request mapping of every code, and
[`audit.md`](./audit.md) only while reviewing the canon or deciding whether a gap is worth a rule.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary TSX. Where the rule reaches a private
component, the module names the ROLE of that component — the reaction leaf, the icon vocabulary —
never its identifier in one codebase.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in
[`changelog.md`](./changelog.md).
