# How a file here is written

Every file in this tree states ONE thing. That single constraint decides its shape, its length, and
where it is filed.

Read this before adding a file, editing one, or deleting one.

## One file, one concept

A reader arrives with one question — *what may a leaf hold?*, *when does a drawer beat a modal?* —
and must be able to answer it by opening one file and reading all of it. That is the test.

The failure this replaces: a shelf where `routing`, `error-handling` and `naming` each held eight
unrelated rulings under numbered headings, so answering one question meant loading eight, and
nobody could tell which of the eight the change they were about to make belonged to.

A file that needs an "and" in its title is two files.

## The four sections, in this order

```markdown
# <the concept, lowercase, as it is spoken>

## Definition
## Rules
## Forbidden
## Examples
```

**Definition** — what the thing IS, in prose, and the ONE question that decides whether something
belongs to it. Not a summary of the rules below; the thing itself. A reader who stops here should be
able to classify a borderline case correctly.

**Rules** — what is required, numbered `CONCEPT-1`, `CONCEPT-2`. One ruling per number, stated as a
judgement rather than a suggestion, each carrying WHY in the same breath. A rule whose reason is
missing is one a reader talks themselves out of at the first inconvenience. Write them thoroughly:
the rule that gets broken is usually the one that was written short.

**Forbidden** — a TABLE, never a list, with these three columns and no others:

| Never | Why it is refused | Instead |
|---|---|---|

The table shape is the point. A prohibition written as prose leaves the reader knowing what not to
do and not what to do, so they do it anyway and add a comment apologising. Three columns force the
alternative to exist: if the `Instead` cell cannot be filled, the prohibition is not ready, because
something legitimate is being blocked with nowhere to go.

**Examples** — several, not one. Each is a PAIR — one right, one wrong — small enough to read whole
and differing in exactly ONE thing, with a closing line naming that thing. Two snippets differing in
five ways teach nothing; five pairs each differing in one way teach five rules. Cover the ordinary
case first, then the ones people actually get wrong: the borderline, the tempting shortcut, the case
that looks like a different tier.

## Frontend pattern evidence

Every file under `fe/canon/patterns/` also contains this exact sentence in its Definition:

```markdown
Implementation anchors in `starci-academy-fe`: `<path>` and `<path>`.
```

The paths point to concrete source, caller or test files verified at the reference HEAD recorded by
Context Lock. The anchors are implementation evidence, not a substitute for Definition or WHY, and
not permission to copy a stale snapshot blindly. A pattern is complete only when it explains the
concept, points to the code that spells it, and links the artifact that holds its enforceable half.
If source and law disagree, record that disagreement as a finding instead of inventing an example.

## What a file must NOT carry

**Counts and measurements.** Not "669 files do this", not "31 rules", not "9 components violate
it". A number transcribed by hand starts lying the day after it is written, and then a reader
trusts the copy over the source. Counting belongs to whatever can recount — a script, a lint rule,
a gate. State the law; let the tool state the tally.

**A list of the project's current defects.** These files say what is right, not what is currently
wrong. Known-wrong things are debt and belong in the ledger, where they can be closed.

**The argument that produced the rule.** The reasoning stays — one clause saying why. The debate
does not: which options were weighed, who preferred what, what was tried first. A rule reads as law
or it reads as a transcript, and only one of those survives being handed to somebody new.

## Names

The filename is the concept, lowercase, hyphenated, as it would be said out loud: `leaf.md`,
`when-drawer.md`, `error-handling.md`. Not `leaf-rules.md` — every file here is rules.

The folder is the axis it belongs to, and the axes are stated in [`INDEX.md`](INDEX.md). A file
that fits two axes is usually two files, one per axis, each answering its own question.

## Writing style

Prose, in judgements. No tick and cross marks: a rule that needs a ✅ beside it to be understood is
a rule that has not been written yet. Write the verdict in words and let the words carry it.

## A fence is for running. A table is for reading.

One question decides every block on the page: **would somebody copy this and run it?** If yes it is
a fence. If they would only read it, it is a table.

A fence does not wrap. Whatever is inside it keeps its own line whatever the width of the window, so
a long line runs off the edge or breaks mid-word, and the reader gets a wall where a list was meant.
A table wraps inside its cell, which is why the label column stays readable however long the thing
it labels turns out to be.

The failure this replaces was not ugly, it was UNREADABLE, and it came from the same instinct every
time: reach for a fence, align the labels with spaces, and let the alignment carry the structure.
That alignment exists only in a monospace box. Rendered anywhere else it collapses, and a list of
files under a `WROTE` label becomes one paragraph of paths.

So a set of labelled facts is a two-column table, not a padded block:

| Wrote | Note |
|---|---|
| `leaves/NavLink/index.tsx` | gains `kind: "section"` and `depth` |

The note in that second column is the tell. In a padded block it had to be squeezed into trailing
whitespace, which is how a fact ends up positioned rather than stated.

Shell commands stay fenced. They are the thing somebody copies, one per fence, with no prompt marker
in front of them.
