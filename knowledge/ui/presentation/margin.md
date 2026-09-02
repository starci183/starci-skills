# Margin presentation

This file answers one question: when may an application-owned object push away from its surroundings
with an external offset, and how much?

Margin is the exception in this system, not the default. A distance between siblings belongs to the
parent's gap, and a distance from a boundary to its content belongs to that boundary's padding.
Margin is correct only when one object needs an offset that no parent relationship can express, and
that reason has a name.

Common reflects this: it resets `margin` to `0` on almost every renderer it owns and lets parents own
the rhythm. An application that reaches for margin first will produce two owners for one distance,
which is `DOUBLE_OWNER`.

## Scale

`COMMON_SPACING_SCALE` is closed. The rule ID is the ordinal position on that scale. It is not the
Tailwind step number, and the two diverge from MARGIN-5 onward.

| Rule | Class | Value | Common token |
| --- | --- | --- | --- |
| MARGIN-0 | `m-0` | `0` | none |
| MARGIN-1 | `m-1` | `.25rem` | none |
| MARGIN-2 | `m-2` | `.5rem` | none |
| MARGIN-3 | `m-3` | `.75rem` | none |
| MARGIN-4 | `m-4` | `1rem` | none |
| MARGIN-5 | `m-6` | `1.5rem` | none |
| MARGIN-6 | `m-8` | `2rem` | none |

Common publishes no margin token. `MARGIN-AUTO` is separate and carries no scale value.

The rem values resolve to `0 / 4 / 8 / 12 / 16 / 24 / 32` CSS pixels only at a computed root of
`16px`. Runtime checks use `expectedPx = remFactor * observedRootFontPx`.

## Owner

Each case names who owns the offset. The owner decides whether the application writes a class at all.

| Owner | Meaning | Application writes |
| --- | --- | --- |
| `App` | The offset is a named application placement exception | The class |
| A component name | Common already sets or resets the margin inside that component | Nothing. Compose it |
| `—` | Common exposes no public path for this relationship | The class, recorded as a workaround |

Writing a class where a component is the owner is `APP_REIMPLEMENTATION`. Adding a child margin next
to a parent gap that already expresses the same distance is `DOUBLE_OWNER`.

## Margin Common already owns

Generated from `@grammar/core` claims by `scripts/generate-presentation-owned.mjs`; edit the component, not this table.

| Component | Element or condition | Rule |
| --- | --- | --- |
| `Label` | root | MARGIN-0 |
| `MediaFrame` | root | MARGIN-0 |
| `PageContainer` | root | MARGIN-AUTO |
| `SectionHeader` | title | MARGIN-0 |
| `SurfaceAccordionCard` | accordion trigger wrapper | MARGIN-0 |
| `WorkspaceShell` | header, hasHeader | MARGIN-5 |

## MARGIN-0 — `m-0` / `0`

The offset is removed so a parent relationship becomes the single owner of the distance.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A native element brings a default margin that fights the composition | `App` | `<h2 className="m-0">` inside an app section that owns its gap |
| Case 2 | Rendered article content whose rhythm is owned by the article | `MarkdownArticle` | Compose the article; no margin |
| Case 3 | Any Common renderer that already resets its own margin | The component | Compose it; no margin |

Not this rule: erasing a deliberate offset without moving that decision to a real owner leaves the
relationship unowned.

## MARGIN-1 — `m-1` / `.25rem`

The smallest external clearance, for one precisely placed object that must sit just clear of an edge.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An absolutely placed marker that would otherwise touch its containing edge | `App` | `<span className="absolute left-0 top-0 m-1">` |

Not this rule: repeating it across siblings recreates a gap. Use GAP-1 on the parent.

## MARGIN-2 — `m-2` / `.5rem`

A compact offset for one independently placed object.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An overlay caption or control anchored to a corner of an app-owned canvas | `App` | `<aside className="absolute bottom-0 right-0 m-2">` |

Not this rule: a substitute for container padding or sibling gap. Use PADDING-2 or GAP-2.

## MARGIN-3 — `m-3` / `.75rem`

A dense but noticeable offset for one named placement exception.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A placed object where `.5rem` reads as cramped against a busy background | `App` | `<aside className="absolute right-0 top-0 m-3">` |

Not this rule: repeated items in a list. Use GAP-3 on the parent.

## MARGIN-4 — `m-4` / `1rem`

The standard external offset for one object with an explicit placement exception.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A standalone object needing equal clearance from an enclosing boundary that cannot own it | `App` | `<aside className="m-4">` |
| Case 2 | The trailing space after a code block inside article content | `FencedCodeBlock` | Compose the block; no margin |
| Case 3 | The block rhythm around a horizontal rule in article content | `MarkdownArticle` | Compose the article; no margin |

Not this rule: combining it with parent padding for the same edge-to-content purpose produces two
owners for one distance.

## MARGIN-5 — `m-6` / `1.5rem`

A large offset that makes one standalone object visibly detached from its containing boundary.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | A named exception that must clear a boundary by more than the standard offset | `App` | `<aside className="m-6">` |
| Case 2 | The separation below a workspace header | `WorkspaceShell` | Compose the shell; no margin |

Not this rule: separation between substantial siblings. Use GAP-5 on the parent.

## MARGIN-6 — `m-8` / `2rem`

The largest external clearance, for a deliberately detached object.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | One object that must read as separated from everything around it, with a stated reason | `App` | `<aside className="m-8">` |

Not this rule: general page rhythm, or repetition across siblings. Use GAP-6 on the parent.

## MARGIN-AUTO — `mx-auto`

Auto inline margins divide the free inline space and centre a width-constrained container. It carries
no scale value and is not an offset decision.

| Case | When | Owner | Render |
| --- | --- | --- | --- |
| Case 1 | An app-owned container that constrains its own width and must sit centred | `App` | `<main className="mx-auto max-w-3xl">` |
| Case 2 | A page adopting the packaged measure and inset | `PageContainer` | Compose the container; it already centres |

Not this rule: a full-width element, or an attempt to distribute space between siblings. Distribution
belongs to the parent's layout.

## Axis variants

`mx-*` and `my-*` are not separate rules. They apply an existing rule to one axis when only one axis
carries the exception.

| Axis | Class | Meaning |
| --- | --- | --- |
| Inline | `mx-*` | The chosen rule applies to logical start and end only |
| Block | `my-*` | The chosen rule applies to block start and end only |

On the same element `m-*` and `mx-*` compete for the inline sides rather than adding. Adjacent block
margins between siblings collapse, which is a second reason the parent gap is the reliable owner of
sibling rhythm.

## What this file does not decide

Distance between siblings is [Gap](gap.md). The distance from a boundary to its content is
[Padding](padding.md). Width constraints are [Measure](measure.md).
