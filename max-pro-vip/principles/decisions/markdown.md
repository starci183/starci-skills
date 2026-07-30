---
name: markdown
description: Decision sheet for the markdown axis — which tier to pick for how far a string of text is rendered as markdown.
scope: three NESTED tiers — each later tier allows everything the previous tier does, plus more
---

# MARKDOWN

## Scale — three tiers, no fourth tier

| Tier | Allows | Mechanism |
|---|---|---|
| `title` | **only** `` `backtick` `` → `<code>`. No bold/italic/link/block | atom Typography, `parseInlineCode` |
| `small richtext` | backtick + **bold** + *italic* + link + `\n`. **No block-level** | composite RichText |
| `article` | everything above, plus heading · list · code fence · table · mermaid · `:::` directive | composite MarkdownContent |

**The technical reason for the `title` tier, not a matter of presentation taste:** title always sits inside an element with HTML constraints (the `<button>` of an accordion trigger, a single-line compressed header). Block-level markup (`<p>`, `<ul>`, `<div>`) nested inside a `<button>` is **invalid HTML**.

## Decision tree — stop at the first YES

| # | Ask | Result |
|---|---|---|
| 1 | Is it the **identifier** of a block/item (strip all formatting and you can still tell what you're looking at) **and/or** does it sit inside an element with HTML constraints? | `title` |
| 2 | Does it need **block structure** — a heading on its own line, list, code fence, table, mermaid, directive? | `article` |
| 3 | Remaining — a description of 1-few lines, may need to emphasize a word or a link | `small richtext` |

**Secondary test:** strip out all bold/italic/link. Can the reader still tell "what this is"? ⇒ `title`. That formatting **itself carries information** (a link to another page) ⇒ not title.

**This tree does not apply to `ReactNode`** — that is a **slot**, the caller decides for itself, not a single-tier field.

## Pairs easily confused

| Pair | The deciding test |
|---|---|
| `title` ↔ `small richtext` *(bitten 3 times)* | use question 1. If the formatting **carries information** instead of just bolding a name ⇒ `small richtext` |
| `title` ↔ `article` *(bitten once, the worst one)* | rendering block-level inside `<button>` ⇒ invalid HTML |
| `small richtext` ↔ `article` | hasn't actually bitten yet |

Reasoning and history: [rationale](../../references/axis-notes/markdown/rationale.md)
Rules no machine catches: [judgement](../judgement.md)
