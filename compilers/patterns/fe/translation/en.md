---
title: Translation
---

# Translation

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

**Recognition signs.** The file calling a copy-resolving hook is the same file calling for data. The
wording changes with state: pending says one thing, settled another. The other half takes in nothing
but resolved strings.

**Boundary.** Not `COPY-2`: `COPY-1` says **where a word is chosen**, `COPY-2` says **where a word may
not be present at all** — a leaf calling a translation hook breaks `COPY-1`, a leaf writing
`"Search courses"` inline breaks `COPY-2`; two different faults, two different fixes. Not `COPY-3`
either: if the connected half picks a **key** and hands the key down, it has decided nothing, and that
is `COPY-3`, not compliance with `COPY-1`.

**Common business situations.** Remaining weekly quota · order status · streak day count · payment
error message · a tab label that depends on permission · the sentence summarising a test result.

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

**Recognition signs.** The string has spaces and starts with a capital — it reads as something a person
would say. The file sits under `leaves/`, `composites/` or `branches/`. Delete the string and the
component still builds; it just has no words.

**Boundary.** Not `COPY-1` — see above. Not `COPY-6`: a string the **program** matches on is not copy
even when it lands in this tier; settle it by asking whether any code **compares** against this string.
And a token is not copy: `"search"` in `name="search"` is an icon name — no spaces, nobody speaks it.

**Common business situations.** Search-field placeholder · `aria-label` on a modal close button · `alt`
on a course image · `title` on an icon-only button · the "No data" line in a composite's empty state ·
the "See more" label in a pagination branch.

## `COPY-3` — a key may not cross the boundary

**Situation.** Somebody intends to pass `labelKey="quest.title"` down and call that "keeping i18n
outside". It is not: it moves the **lookup**, not the **decision**. The child still has to look up, so
the child still needs the whole translation runtime to render — and so it can no longer be built from
a fixture.

**What it emits in source.** Word-bearing props in the drawing twin are typed as the resolved value
(`label: string`). No prop carries a dictionary path across the boundary, and the child imports no
dictionary lookup at all.

**Recognition signs.** A prop name ends in `Key`, `I18nKey` or `MessageId` and its value is a
dotted path. The child has to import a dictionary function to display the prop it received. The child's
test only runs with a language provider mounted.

**Boundary.** Not `COPY-4`: `COPY-4` says a word **already resolved** travels in `props`, `COPY-3`
forbids the **unresolved** thing travelling the same road — one pipe, two different cargoes. And **not
every `*Key` prop violates it**: `selectedKey` on a tab or a list row is an **identity**, not a
dictionary entry, because nothing has to be resolved to render it. Settle it by asking what the key
looks up into — the dictionary, or the very list being rendered.

**Common business situations.** `labelKey` for a button · `emptyMessageId` for an empty list ·
`errorKey` for a form · an array of `{ id, labelKey }` for a menu — the array is where keys smuggle
themselves through most often, because it looks like data.

## `COPY-4` — a resolved word is a value, so it follows the data path

**Situation.** Once the connected half has chosen, the string is **no longer a language matter**. It is
a value like a balance or a filename, and it travels the road every other value travels: `props`.

This code buys one concrete thing rather than an aesthetic principle: a component renders from a
fixture holding `"anything"` and is still correct. The test that needs no dictionary is the proof that
the word arrived as a value.

**What it emits in source.** The drawing twin's test renders from plain fixture strings with no
translation provider mounted. No word reaches the component by context, ambient runtime or module
import.

**Recognition signs.** The prop's type is `string`, not a union of keys. The test builds the component
from made-up strings and mounts no provider. Changing the dictionary changes no test.

**Boundary.** Not `COPY-3` — see above. Not `COPY-1`: `COPY-1` says who chooses, `COPY-4` says which
road the word takes after it is chosen. A word resolved in the right place but slipped downward through
a global context breaks `COPY-4`, not `COPY-1`.

**Common business situations.** The label and value of a stat row · an empty-state heading · toast text
after a submit · table column labels · a string with its number and unit already formatted in.

## `COPY-5` — the dictionary is the other language, so it is not source

**Situation.** The English-only authoring rule exists so that somebody joining a year later can read
every line. The dictionary is the opposite: **its content has to be the other language**. Measuring the
locale folder against that rule misreads both rules.

**What it emits in source.** The locale files are exempt by a PATH list — `messages/<locale>.json`
and the `CONTENT_PATHS` list — so no file argues its own case. Fixtures and specs are exempt the same
way, by path.

**Recognition signs.** The file sits in a locale folder with a `.json` extension and each key is a
sentence. There is no logic in the file — only words.

**Boundary.** The exemption is a **path**, not a judgement: that is this code's most expensive
decision, because a judgement-based exemption would be argued file by file forever. Not `COPY-6`: the
dictionary is exempt because it **is content**, a matched string is preserved because **the program
compares it** — two entirely different reasons, do not merge them.

**Common business situations.** A per-language dictionary file · a fixture reproducing a server payload
verbatim · a snapshot test preserving displayed text.

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

**Recognition signs.** There is an `===`, a `switch`, or a map key matching this exact string. The
string comes from outside the system: server, webhook, payment gateway, a third-party enum. Changing
this string means changing the other side too.

**Boundary.** Not `COPY-2`: both are literals in source, but `COPY-2` is about the string the **reader**
reads and `COPY-6` about the string the **program** reads. Not `COPY-5` — see above. And the mark
**does not** turn copy into a value: marking a sentence just to slip it past the language gate is
misuse of this code, and nothing in the system detects it.

**Common business situations.** An order status the server sends verbatim · a payment gateway error
code · a payment method name used as a map key · an enum value in a query string · an analytics event
name.

## Layer held

Which tier actually holds each code — a closed type, a lint rule, or only a reader. The enforced rows
are implemented by `@starci/eslint-canon-fe`.

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
counted here: `starci-fe/no-second-language-in-source`, published by `@starci/eslint-canon-fe`,
exempts the locale dictionaries by path (`COPY-5`) and reads the `vn-ok:` pragma on a marked line
(`COPY-6`). Counting a neighbour's rule as this module's enforcement would make the module look held
where it is not: that rule fires on a LANGUAGE, so it never sees an English key crossing a boundary,
and it cannot tell a marked matched-value from marked copy.

`COPY-1` is additionally reached by `starci-fe/presentational-purity` from the split law, which refuses
the same call in a file named `component.tsx`. Two rules covering one code from different angles is
redundancy, not a second tier: the split rule scopes by filename, this module's scopes by tier folder,
and a leaf that is not a split half is seen only by the second.

## Anchor

A law that cannot be pointed at in real code is a proposal. Paths are repository-relative source paths;
the shape of the tree, not the name of any product, is what makes them checkable.

| Code | Anchor | What to look for |
|---|---|---|
| `COPY-1` | `components/blocks/**/index.tsx` beside its `component.tsx` twin | The translation hook appears in the connected entrypoint and in no twin. A tree obeying this has a positive count on the first glob and zero on the second |
| `COPY-2` | `components/{leaves,composites,branches,shells}/**` | No `aria-label`, `placeholder`, `title` or `alt` carrying prose, and no JSX text that reads as a sentence |
| `COPY-3` | props types in `components/blocks/**/component.tsx` | Word-bearing props are typed as the resolved value (`label: string`). Any `*Key` prop names a selected row, never a dictionary entry |
| `COPY-4` | `components/blocks/**/component.test.tsx` | The twin renders from plain fixture strings with no translation provider mounted — the test passing is the proof the word arrived as a value |
| `COPY-5` | `messages/<locale>.json`, and `CONTENT_PATHS` in `@starci/eslint-canon-fe` | The exemption is a path list, so no file argues its own case |
| `COPY-6` | `chưa neo được` — not yet anchored | Lines marked `// vn-ok: <reason>` exist, but the marked literals found are copy rather than values the program matches on. The code's own situation has no anchor |

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

## Worked example

**Accepted shape.** A weekly-quota panel is accepted as one block with a connected entrypoint and a
drawing twin: it shows a heading, the remaining quota, an empty line when nothing has been used yet,
and a close button with an icon only; the quota reset state arrives from the server as a status the
screen branches on.

What the shape does not state, and therefore does not resolve: where each word is chosen, whether the
twin receives a key or a finished sentence, whether the close button's accessible name is copy at all,
and whether the server status is copy or a value. Those are resolved here, outermost first.

```text
surface: src/components/blocks/weekly-quota/index.tsx, connected half
code: COPY-1
string: "3 of 10 lessons left this week"
role: copy
resolved-in: the connected half that owns the request
reason: the sentence differs by state — pending, empty and settled are three different sentences — and only the owner of the request knows which state it is in, which is why this is not COPY-4: COPY-4 governs the road the word takes after it is already chosen
```

```text
surface: src/components/blocks/weekly-quota/component.tsx, drawing half
code: COPY-4
string: "3 of 10 lessons left this week"
role: copy
resolved-in: the connected half that owns the request
reason: the prop is typed `string` and the twin's test renders it from a fixture with no translation provider mounted, which is why this is not COPY-3: nothing here has to be looked up before it renders
```

```text
surface: src/components/leaves/icon-button/index.tsx, tier below a block
code: COPY-2
string: "Close"
role: copy
resolved-in: not resolved
reason: a screen reader speaks the `aria-label` as primary text, so a reader in another language hears this exact string — which is why it is not the icon token `"close"` in `name="close"`, which has no spaces and is never spoken
```

```text
surface: src/components/blocks/weekly-quota/index.tsx, connected half
code: COPY-6
string: "quota_exhausted"
role: matched value
resolved-in: not resolved
reason: a `switch` in this file compares against this exact string, so translating it would silently kill a branch — which is why it is not COPY-2: the program reads it, not the reader, and the display sentence is a separate string
```

```text
surface: src/messages/vi.json, locale content
code: COPY-5
string: "Còn 3 trên 10 bài trong tuần này"
role: dictionary content
resolved-in: the dictionary
reason: the file is exempt by PATH, as content rather than authorship — which is why it is not COPY-6: it is preserved because it IS the other language, not because the program compares it
```

## Scope

This module states a rule true of any front end that serves more than one language. It names no
product, no component library and no repository. Every example is ordinary TSX.

AN IDENTIFIER THAT SHIPS IS NOT A PRODUCT NAME IN THIS SENSE. A rule is cited by its published name,
plugin prefix and all, because that is the exact string a build log prints and a disable comment
carries. A citation that cannot be pasted into a search is not a citation. What the ban above forbids
is PROSE and EXAMPLES that need a product to be understood — never an identifier somebody will read in
a failure and have to look up.
