# Text flow presentation

This file answers one question: how does text behave inside a region whose size is already decided?

Composition has chosen the tree, [Font](font.md) has set the rank, and [Measure](measure.md) has set
the room. Text flow resolves alignment, wrapping, and what happens when the words do not fit.

The default is the correct answer far more often than any rule here. Text that starts at the reading
edge and wraps naturally needs no class at all.

## Catalog

| Rule | Decides | Default |
| --- | --- | --- |
| FLOW-1 | Alignment along the inline axis | Start |
| FLOW-2 | Whether a line may break | Wrapping |
| FLOW-3 | Breaking inside an unbroken string | Allowed on overflow |
| FLOW-4 | Truncating one line | Off |
| FLOW-5 | Clamping several lines | Off |

Truncation removes information. FLOW-4 and FLOW-5 are valid only when the full text remains reachable
somewhere else, and never for a value the reader must act on.

## Owner

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The text region belongs to the application | The class |
| A component name | Common already resolves this behaviour | Nothing. Compose it |
| `—` | Common exposes no public path | The class, recorded as a workaround |

Every wrapping region also needs `min-w-0` from [Measure](measure.md). Truncation and clamping fail
silently without it, because the region never becomes narrower than its longest word.

## Text flow Common already owns

| Common component | Behaviour | Rule |
| --- | --- | --- |
| `SectionHeader` title | Breaks inside long unbroken strings | FLOW-3 |
| `MediaFrame` caption | Breaks inside long unbroken strings | FLOW-3 |
| `MarkdownArticle` | Breaks inside long unbroken strings | FLOW-3 |
| `FencedCodeBlock` | Preserves whitespace, scrolls rather than wraps | FLOW-2 |
| `Subnav` title | Truncates to one line with an ellipsis | FLOW-4 |
| `Badge`, `Tabs` tab, control labels | Stay on one line | FLOW-2 |

## FLOW-1 — Alignment

Text starts at the reading edge unless the content itself is a quantity being compared.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Any prose, label, heading, or explanation | `App` | No class. Start alignment is the default |
| Case 2 | A numeric column whose values are compared down the column | `App` | `text-end` on the cell, applied to the whole column |
| Case 3 | A single short line centred inside a deliberately symmetric region | `App` | `text-center` on the app-owned region only |

Not this rule: centring paragraphs. A centred block has a ragged start edge, and every line costs the
reader a search for where it begins. Justified text is never used, because it opens uneven rivers of
space at the widths this system supports.

## FLOW-2 — Wrapping

A line wraps by default. Preventing that is a promise the content is short.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Any content whose length is not fixed | `App` | No class. Wrapping is the default |
| Case 2 | A control label, badge, or tab that must not break mid-phrase | The component | Compose it; Common already keeps it on one line |
| Case 3 | Code that must keep its own line breaks | `FencedCodeBlock` | Compose the block; it scrolls instead of wrapping |

Not this rule: `whitespace-nowrap` on translated or user-supplied text. A phrase that fits in one
language overflows in another, and the overflow appears only after release.

## FLOW-3 — Breaking inside a word

A single unbroken string longer than its region breaks rather than escaping it.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | Content that can contain a URL, token, identifier, or pasted string | `App` | `break-words` on the app-owned region |
| Case 2 | Section titles, captions, and article prose | The component | Compose it; Common already breaks these |

This is the rule that prevents page-level horizontal scrolling. One email address in a narrow column
widens every ancestor without it.

Not this rule: breaking short labels, which produces a single stranded character on the second line.

## FLOW-4 — Truncating one line

One line is cut with an ellipsis because its region has a fixed inline size and the full value is
available elsewhere.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A title in a fixed-width strip whose full text is on the destination page | `Subnav` | Compose it; Common already truncates |
| Case 2 | An app-owned row label whose full value is reachable by opening the row | `App` | `truncate` with `min-w-0` on the same element |

The visible text must remain the accessible name in full. A truncated label that also truncates its
accessible name removes the value from assistive output entirely.

Not this rule: a price, status, error, deadline, or any value the reader acts on. Give the region
more room instead.

## FLOW-5 — Clamping several lines

A block is cut after a fixed number of lines, and the reader can open the full text.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A card description in a grid whose cards must stay the same height | `—` | `line-clamp-2` with an affordance that reveals the rest |
| Case 2 | A preview whose full body is the destination of the row | `—` | Same, with the row as the affordance |

A clamp without a way to read the rest is content deletion. The affordance is part of the rule, not a
later addition. Common exposes no clamp prop, so both cases stay recorded workarounds.

Not this rule: clamping to hide a layout problem. If two cards differ in height because their content
differs, that is the content, not a defect.

## What this file does not decide

The size and weight of the text is [Font](font.md). Its colour is [Tone](tone.md). How much room the
region gets is [Measure](measure.md). Which boundary scrolls is [Overflow](overflow.md).
