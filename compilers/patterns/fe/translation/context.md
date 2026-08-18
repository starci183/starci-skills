---
title: Translation
runtime: true
source: en.md
sourceHash: 477235095be403d908fb0e5c92205ea4b669d18642b48b77bd38a76c1e5aa064
contextVersion: 1
---

# Translation

## LOADS

| Alias | Target | Kind | Why |
|---|---|---|---|
| `@canon-fe` | `@starci/eslint-canon-fe` | npm package | the published frontend machine this record cites |

## Record

The input is a shape somebody already accepted — a layout, a block, a capability or a contract whose
design questions are closed. This module does not reopen any of them. It takes that accepted shape and
says where its words live in source: which file resolves each string, which tier may hold it, what may
cross a boundary, what travels in `props`, and which strings are not copy at all. The output is source
architecture, not a design opinion.

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

## Situation codes

Every situation this module governs carries a code, `COPY-<n>`. The code names the SITUATION. Two of
the six describe strings that are **not** copy at all, and they carry codes for the same reason the
other four do: a case nobody can cite is a case nobody can be shown to have got wrong.

| Code | Situation | What the source must look like |
|---|---|---|
| `COPY-1` | The connected half that owns the request picks the sentence true of the situation it just settled | The connected half that owns the request resolves every word describing its answer; no word is chosen below that half, because only the owner of the request knows which sentence is true |
| `COPY-2` | A tier below a block is holding a literal a reader sees or hears | A component below a block renders only strings handed to it; no literal a reader sees or hears — in text, `aria-label`, `placeholder`, `title` or `alt` |
| `COPY-3` | Somebody intends to pass a `labelKey` down for the child to look up | The resolved string crosses the boundary; a translation KEY never does |
| `COPY-4` | An already-resolved word has to travel down some path | A resolved word travels in `props`, like any other value; never by context, ambient runtime or module import |
| `COPY-5` | A file in the locale folders is being measured against the English-only authoring rule | A file under the locale folders is content, so the English-only authoring rule does not reach it — exempt by PATH, never argued per file |
| `COPY-6` | A string the PROGRAM matches on, not one the reader reads | A value the program MATCHES on stays verbatim, marked on its line with the reason; never translated, never left unmarked |

`COPY-5` AND `COPY-6` ARE NOT EXEMPTIONS FROM THE LAW, THEY ARE PART OF IT. A dictionary entry and a
matched-on status are both strings a reader may see, and both would be handled wrongly by a rule that
only knew "translate everything". Naming them as codes is what keeps the other four codes narrow
enough to be absolute.

The numbering has no gaps and gains none. These six codes are cited from other law files and from
task records; a code renumbered here silently breaks a citation somebody already made.

## Reading an accepted shape

1. **Read what the shape states.** It states the surface, the tiers it is built from, which half owns
   the request, and which states of the answer the screen has to show. Take those as settled.
2. **Name what the shape does not state, and therefore does not resolve.** A shape does not say where
   a word is chosen, whether a prop carries a key or a resolved value, or whether a given literal is
   copy at all. Those are exactly the questions the codes below answer; a shape that "looks obvious"
   still resolves nothing here.
3. **Resolve outermost first.** Start at the connected half that owns the request and work inward.
   The owner of the request decides which sentence is true; every tier below it only receives. Deciding
   an inner file first will make you invent an owner that the shape never named.
4. **Ask each code's question in turn**, on each string:
   - `COPY-1` — who knows which situation this is? That is where the word is chosen.
   - `COPY-2` — would a reader in another language see this exact string, or a screen reader speak it?
   - `COPY-3` — does the child have to do one more lookup before it has a word?
   - `COPY-4` — if every dictionary were deleted, would this component still render?
   - `COPY-5` — is this file authorship, or is it content?
   - `COPY-6` — does any code `===`, `switch` or key a map on this exact string?
5. **When two codes both match**, split the string rather than pick a winner. A value that is both
   matched on and displayed is two things: the value to compare, and the copy to show. Where the codes
   describe different failures on one file, both hold — a leaf calling a translation hook breaks
   `COPY-1`, a leaf hardcoding `"Search courses"` breaks `COPY-2`, and one file can do both. The fixes
   differ, so the codes are not merged.

## `COPY-1` — the connected half chooses every word

**Situation.** The block that owns the request also owns the words describing that request's answer.
The reason is not a file-splitting habit: only that half knows which situation the reader is in —
loading, empty, error, or holding figures — so only it knows **which sentence is true**.

**What it emits in source.** The translation hook sits in the connected entrypoint, beside the hook
that fetches the data. The drawing twin receives finished `string` values only — no ids, no conditions.

**Boundary.** Not `COPY-2`: `COPY-1` says **where a word is chosen**, `COPY-2` says **where a word may
not be present at all** — a leaf calling a translation hook breaks `COPY-1`, a leaf writing
`"Search courses"` inline breaks `COPY-2`; two different faults, two different fixes. Not `COPY-3`
either: if the connected half picks a **key** and hands the key down, it has decided nothing, and that
is `COPY-3`, not compliance with `COPY-1`.

## `COPY-2` — below a block, no word a reader can see

**Situation.** A leaf, composite, branch or shell is holding a literal a reader sees or **hears**. Not
only in content: `aria-label`, `placeholder`, `title` and `alt` are the four places copy hides most,
because when you skim a file none of the four **looks like a sentence**.

`aria-label` is not the small case. A screen reader treats it as **primary text**, so an English label
on a Vietnamese screen is the biggest error on the page, landing on the reader with the fewest ways
around it.

**What it emits in source.** Files under `leaves/`, `composites/`, `branches/` and `shells/` carry no
prose in text, `aria-label`, `placeholder`, `title` or `alt`. Every such string is lifted up to the
connected half and arrives as a value.

**Boundary.** Not `COPY-1` — see above. Not `COPY-6`: a string the **program** matches on is not copy
even when it lands in this tier; settle it by asking whether any code **compares** against this string.
And a token is not copy: `"search"` in `name="search"` is an icon name — no spaces, nobody speaks it.

## `COPY-3` — a key may not cross the boundary

**Situation.** Somebody intends to pass `labelKey="quest.title"` down and call that "keeping i18n
outside". It is not: it moves the **lookup**, not the **decision**. The child still has to look up, so
the child still needs the whole translation runtime to render — and so it can no longer be built from
a fixture.

**What it emits in source.** Word-bearing props in the drawing twin are typed as the resolved value
(`label: string`). No prop carries a dictionary path across the boundary, and the child imports no
dictionary lookup at all.

**Boundary.** Not `COPY-4`: `COPY-4` says a word **already resolved** travels in `props`, `COPY-3`
forbids the **unresolved** thing travelling the same road — one pipe, two different cargoes. And **not
every `*Key` prop violates it**: `selectedKey` on a tab or a list row is an **identity**, not a
dictionary entry, because nothing has to be resolved to render it. Settle it by asking what the key
looks up into — the dictionary, or the very list being rendered.

## `COPY-4` — a resolved word is a value, so it follows the data path

**Situation.** Once the connected half has chosen, the string is **no longer a language matter**. It is
a value like a balance or a filename, and it travels the road every other value travels: `props`.

This code buys one concrete thing rather than an aesthetic principle: a component renders from a
fixture holding `"anything"` and is still correct. The test that needs no dictionary is the proof that
the word arrived as a value.

**What it emits in source.** The drawing twin's test renders from plain fixture strings with no
translation provider mounted. No word reaches the component by context, ambient runtime or module
import.

**Boundary.** Not `COPY-3` — see above. Not `COPY-1`: `COPY-1` says who chooses, `COPY-4` says which
road the word takes after it is chosen. A word resolved in the right place but slipped downward through
a global context breaks `COPY-4`, not `COPY-1`.

## `COPY-5` — the dictionary is the other language, so it is not source

**Situation.** The English-only authoring rule exists so that somebody joining a year later can read
every line. The dictionary is the opposite: **its content has to be the other language**. Measuring the
locale folder against that rule misreads both rules.

**What it emits in source.** The locale files are exempt by a PATH list — `messages/<locale>.json`
and the `CONTENT_PATHS` list — so no file argues its own case. Fixtures and specs are exempt the same
way, by path.

**Boundary.** The exemption is a **path**, not a judgement: that is this code's most expensive
decision, because a judgement-based exemption would be argued file by file forever. Not `COPY-6`: the
dictionary is exempt because it **is content**, a matched string is preserved because **the program
compares it** — two entirely different reasons, do not merge them.

## `COPY-6` — a string the PROGRAM matches on is not copy

**Situation.** The server sends a status and the screen **compares** against that string to decide which
branch to render. Translating it breaks the comparison — and the breakage is **silent**: no TypeScript
error, no exception, just a branch that never runs again.

So the string stays as it is, and it is **marked on its own line with the reason**. The mark is not
procedure: it is what tells the next reader this was a **decision** rather than somewhere somebody
forgot to translate.

**What it emits in source.** The literal is preserved verbatim and carries `// vn-ok: <reason>` on its
line. Where a value is both compared and shown, source holds two things: the value to compare and the
copy to display.

**Boundary.** Not `COPY-2`: both are literals in source, but `COPY-2` is about the string the **reader**
reads and `COPY-6` about the string the **program** reads. Not `COPY-5` — see above. And the mark

## Layer held

Which tier actually holds each code — a closed type, a lint rule, or only a reader. The enforced rows
are implemented by `@canon-fe`.

| Code | Tier | Held by |
|---|---|---|
| `COPY-1` | `enforced` | `starci-fe/no-copy-resolution-below-block` |
| `COPY-2` | `enforced` | `starci-fe/no-hardcoded-copy-in-vocabulary` |
| `COPY-3` | `documented` | nothing mechanical |
| `COPY-4` | `documented` | nothing mechanical |
| `COPY-5` | `documented` | nothing in this module |
| `COPY-6` | `documented` | nothing in this module |

Four of six rows read `documented`, and the table exists to say so out loud rather than to let the two
enforced rows imply the module is covered.

Two of those four have mechanical support that belongs to a NEIGHBOURING law and is therefore not
counted here: `starci-fe/no-second-language-in-source`, published by `@canon-fe`,
exempts the locale dictionaries by path (`COPY-5`) and reads the `vn-ok:` pragma on a marked line
(`COPY-6`). Counting a neighbour's rule as this module's enforcement would make the module look held
where it is not: that rule fires on a LANGUAGE, so it never sees an English key crossing a boundary,
and it cannot tell a marked matched-value from marked copy.

`COPY-1` is additionally reached by `starci-fe/presentational-purity` from the split law, which refuses
the same call in a file named `component.tsx`. Two rules covering one code from different angles is
redundancy, not a second tier: the split rule scopes by filename, this module's scopes by tier folder,
and a leaf that is not a split half is seen only by the second.

## Inputs

| Input | Evidence required |
|---|---|
| surface | The file and the tier it sits in: connected half, drawing half, or a tier below a block |
| ownership | Which half owns the request whose answer the words describe |
| carrier | Where the string sits: JSX text, an attribute a reader hears, a prop, or a module constant |
| role | Copy, dictionary content, or a value the program compares against |
| situation | Which state of the answer the sentence is true of |

## Rules

1. The half that owns the request owns the words.
2. A component below a block holds no literal a reader can see or hear — including in `aria-label`,
   `placeholder`, `title` and `alt`.
3. A resolved string crosses the boundary; a key never does.
4. A resolved word is a value and travels in `props`.
5. A drawing half renders correctly from a fixture with no dictionary present.
6. The locale folders are content, matched by path rather than by judgement.
7. A matched-on value is not translated, and carries its reason on its own line.
8. Every reader-facing string resolves to exactly one code. No string is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Locale content (`COPY-5`).** Files under the locale folders are the other language. The
  English-only authoring rule does not reach them. The exemption is a PATH, because a judgement-based
  one would be argued per file forever.
- **Fixtures and specs (`COPY-2`, `COPY-4`).** A fixture reproducing a real string has to reproduce it
  exactly; translating it would be testing something else. The exemption is again a path.
- **Matched values (`COPY-6`).** A status the server sends and the screen compares against stays as it
  is, marked on its line with the reason. The mark is what tells the next reader it was a decision
  rather than something somebody forgot.
- **A key that is not a translation key (`COPY-3`).** A prop naming a selected tab, row or option is an
  identity, not a lookup. It crosses freely, because nothing has to be resolved to render it.
- **A token that is not a word (`COPY-2`).** An icon name, a variant name, a recipe name is an internal
  identifier: no spaces, nobody speaks it, it does not change with language.

## Output

One block per string the accepted shape produces.

```text
surface: <file, and the tier it sits in>
code: <COPY-1 | COPY-2 | COPY-3 | COPY-4 | COPY-5 | COPY-6>
string: <the word in question>
role: <copy | dictionary content | matched value>
resolved-in: <the connected half that owns the request | the dictionary | not resolved>
reason: <the fact that excludes the adjacent code>
```
