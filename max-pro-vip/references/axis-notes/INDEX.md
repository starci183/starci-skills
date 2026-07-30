---
name: axis-notes
description: The reasoning and incident history behind fifteen former axes. Look here when you need to know why an API was tightened the way it was, or what a rule cost before it existed. Not a lookup table and not a rulebook.
---

# Axis notes

These fifteen files were the axes. They stopped being a rulebook on 2026-07-30, when a scan of all
103 Forbidden rules showed that **46% of them were already enforced by `tsc` or an existing gate**,
and most of the rest could stop existing if an API were built right.

What survived as rules lives in [`principles/judgement.md`](../../principles/judgement.md) — seven
rules no machine can catch. What became engineering work lives in
[`docs/API-BACKLOG.md`](../../docs/API-BACKLOG.md).

**Nothing here was deleted.** Every word of reasoning, every dated incident, every reversed ruling
is kept exactly as written. This is the record of how the system learned what it knows.

## When to open one of these

| Situation | Open |
|---|---|
| tightening an API and needing to know what it must not break | the note for that axis |
| a rule in `judgement.md` needs its full argument | the note named in its bracket |
| an incident is cited by date and you want the detail | search the notes for that date |
| deciding whether a new case is genuinely new | the exhaustive pair analysis in the note |

## What is in each note

The full scale, the decision tree, an exhaustive pass over every easily-confused pair, the
structural traps with their dated anchors, and the source-of-truth order for when two sources
disagree.

`example.html` next to each note renders the same material for the human eye. It never enters
context.

## The fifteen

`async` · `button` · `color` · `frame` · `icon` · `inset` · `markdown` · `press` · `prominence` ·
`reading-flow` · `responsive` · `seam` · `skeleton` · `surface` · `text`

`naming` moved separately, to [`references/naming.md`](../naming.md) — it was a source-code
convention, never a visual judgement.
