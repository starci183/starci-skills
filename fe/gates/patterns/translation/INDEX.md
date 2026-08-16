---
id: fe-patterns-translation-index
title: INDEX.md
slug: /gates/patterns/translation
sidebar_label: translation
sidebar_position: 0
description: Binding rules for where a word is chosen, what may cross into a drawing half, and which strings are not copy at all.
template: patterns-v2
---

# INDEX.md

Version: `2.00` · Module: `translation`

## Law

Copy is data. It arrives from a dictionary, it changes without a deploy, it differs per reader — and
like every other piece of data, it is resolved by the half that owns the request and handed down
already decided.

That has one consequence worth stating plainly, because it is the rule people reach past: **no
component below a block ever says a word of its own.** A leaf renders the string it was given. A
composite arranges strings it was given. Neither knows which language it is in, and neither can be
made wrong by a translation landing late.

The question that settles it: **would a reader in another language see something different here?**
If yes, it is copy, and copy is resolved one file away.

**This is binding, not advisory.** Every reader-facing string in a rendered tree falls under exactly
one code below, including the ones that do not look like sentences. A one-word `alt` is `COPY-2` for
the same reason a paragraph is; "it is only a word" is where this rule is skipped most often.

## Situation Codes

Every situation this module governs carries a code, `COPY-<n>`. The code names the SITUATION. Two of
the six describe strings that are **not** copy at all, and they carry codes for the same reason the
other four do: a case nobody can cite is a case nobody can be shown to have got wrong.

| Code | What it requires | What it forbids |
|---|---|---|
| `COPY-1` | The connected half that owns the request resolves every word describing its answer | Any word chosen below that half, because only the owner of the request knows which sentence is true |
| `COPY-2` | A component below a block renders only strings handed to it | A literal a reader sees or hears — in text, `aria-label`, `placeholder`, `title` or `alt` |
| `COPY-3` | The resolved string crosses the boundary | A translation KEY crossing it |
| `COPY-4` | A resolved word travels in `props`, like any other value | A word arriving by context, ambient runtime or module import |
| `COPY-5` | A file under the locale folders is content, so the English-only authoring rule does not reach it | Arguing the exemption per file instead of by path |
| `COPY-6` | A value the program MATCHES on stays verbatim, marked on its line with the reason | Translating it, or leaving it unmarked |

`COPY-5` AND `COPY-6` ARE NOT EXEMPTIONS FROM THE LAW, THEY ARE PART OF IT. A dictionary entry and a
matched-on status are both strings a reader may see, and both would be handled wrongly by a rule that
only knew "translate everything". Naming them as codes is what keeps the other four codes narrow
enough to be absolute.

The numbering has no gaps and gains none. These six codes are cited from other law files and from
task records; a code renumbered here silently breaks a citation somebody already made.

## Tầng giữ

Which tier actually holds each code — a closed type, a lint rule, or only a reader.

| Code | Tier | Held by |
|---|---|---|
| `COPY-1` | `enforced` | `starci-fe/no-copy-resolution-below-block` |
| `COPY-2` | `enforced` | `starci-fe/no-hardcoded-copy-in-vocabulary` |
| `COPY-3` | `documented` | nothing mechanical |
| `COPY-4` | `documented` | nothing mechanical |
| `COPY-5` | `documented` | nothing in this module |
| `COPY-6` | `documented` | nothing in this module |

Four of six rows read `documented`, and the table exists to say so out loud rather than to let the
two enforced rows imply the module is covered.

Two of those four have mechanical support that belongs to a NEIGHBOURING law and is therefore not
counted here: `starci-fe/no-second-language-in-source`, published by
`.claude/sources/fe/comments.mjs`, exempts the locale dictionaries by path (`COPY-5`) and reads the
`vn-ok:` pragma on a marked line (`COPY-6`). Counting a neighbour's rule as this module's enforcement
would make the module look held where it is not: that rule fires on a LANGUAGE, so it never sees an
English key crossing a boundary, and it cannot tell a marked matched-value from marked copy.

`COPY-1` is additionally reached by `starci-fe/presentational-purity` from the split law, which
refuses the same call in a file named `component.tsx`. Two rules covering one code from different
angles is redundancy, not a second tier: the split rule scopes by filename, this module's scopes by
tier folder, and a leaf that is not a split half is seen only by the second.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative source
paths; the shape of the tree, not the name of any product, is what makes them checkable.

| Code | Anchor | What to look for |
|---|---|---|
| `COPY-1` | `src/components/blocks/**/index.tsx` beside its `component.tsx` twin | The translation hook appears in the connected entrypoint and in no twin. A tree obeying this has a positive count on the first glob and zero on the second |
| `COPY-2` | `src/components/{leaves,composites,branches,shells}/**` | No `aria-label`, `placeholder`, `title` or `alt` carrying prose, and no JSX text that reads as a sentence |
| `COPY-3` | props types in `src/components/blocks/**/component.tsx` | Word-bearing props are typed as the resolved value (`label: string`). Any `*Key` prop names a selected row, never a dictionary entry |
| `COPY-4` | `src/components/blocks/**/component.test.tsx` | The twin renders from plain fixture strings with no translation provider mounted — the test passing is the proof the word arrived as a value |
| `COPY-5` | `src/messages/<locale>.json`, and `CONTENT_PATHS` in `.claude/sources/fe/comments.mjs` | The exemption is a path list, so no file argues its own case |
| `COPY-6` | `chưa neo được` | Lines marked `// vn-ok: <reason>` exist, but the marked literals found are copy rather than values the program matches on. The code's own situation has no anchor. See `audit.md` |

## Inputs

| Input | Evidence required |
|---|---|
| surface | The file and the tier it sits in: connected half, drawing half, or a tier below a block |
| ownership | Which half owns the request whose answer the words describe |
| carrier | Where the string sits: JSX text, an attribute a reader hears, a prop, or a module constant |
| role | Copy, dictionary content, or a value the program compares against |
| situation | Which state of the answer the sentence is true of |

## Invariants

- The half that owns the request owns the words.
- A component below a block holds no literal a reader can see or hear.
- A resolved string crosses the boundary; a key never does.
- A resolved word is a value and travels in `props`.
- A drawing half renders correctly from a fixture with no dictionary present.
- The locale folders are content, matched by path rather than by judgement.
- A matched-on value is not translated, and carries its reason on its own line.
- Every reader-facing string resolves to exactly one code. No string is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Locale content (`COPY-5`).** Files under the locale folders are the other language. The
  English-only authoring rule does not reach them. The exemption is a PATH, because a
  judgement-based one would be argued per file forever.
- **Fixtures and specs (`COPY-2`, `COPY-4`).** A fixture reproducing a real string has to reproduce
  it exactly; translating it would be testing something else. The exemption is again a path.
- **Matched values (`COPY-6`).** A status the server sends and the screen compares against stays as
  it is, marked on its line with the reason. The mark is what tells the next reader it was a
  decision rather than something somebody forgot.
- **A key that is not a translation key (`COPY-3`).** A prop naming a selected tab, row or option is
  an identity, not a lookup. It crosses freely, because nothing has to be resolved to render it.

## Output

```text
surface: <file, and the tier it sits in>
code: <COPY-1 | COPY-2 | COPY-3 | COPY-4 | COPY-5 | COPY-6>
string: <the word in question>
role: <copy | dictionary content | matched value>
resolved-in: <the connected half that owns the request | the dictionary | not resolved>
reason: <the fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end that serves more than one language. It names no
product, no component library and no repository. Every example is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published
name, plugin prefix and all, because that is the exact string a build log prints and a disable
comment carries. A citation that cannot be pasted into a search is not a citation. What the ban
above forbids is PROSE and EXAMPLES that need a product to be understood - never an identifier
somebody will read in a failure and have to look up.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
