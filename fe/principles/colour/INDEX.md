---
id: fe-principles-colour-index
title: INDEX.md
slug: /fe/principles/colour
sidebar_label: colour
sidebar_position: 0
description: Binding rules for choosing a colour className from the semantic role an element plays.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `colour`

## Law

Colour states what an element MEANS. Choose it from the role the element plays in the business —
content, interaction, state, surface, boundary — never from how the hue looks.

A colour decision must survive the loss of hue. If the meaning disappears when the screen is
greyscale, colour-blind or forced into a high-contrast theme, the meaning was never encoded; it was
only suggested.

**This is binding, not advisory.** Every rendered element falls under exactly one code below. There
is no element too small to have a role: a timestamp under a title is `COLOUR-2` for the same reason a
failed-payment line is `COLOUR-6`. "It is only a bit of grey text" is not an exemption — it is the
most common place this rule gets skipped.

One element expresses one role. A surface code emits its surface-and-content pair and stops there;
any other role — status, interaction, selection — belongs to a CHILD element. Codes nest; they never
merge onto one node.

## Situation Codes

Every situation this module governs carries a code, `COLOUR-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing.

| Code | Situation | className |
|---|---|---|
| `COLOUR-1` | Primary readable content — the sentence that carries the decision | `text-foreground` |
| `COLOUR-2` | Supporting content, metadata, provenance | `text-muted-foreground` |
| `COLOUR-3` | Interaction target or current selection | `text-primary` (selected region: `bg-primary/10 text-primary`) |
| `COLOUR-4` | A completed, successful outcome | `text-success` + non-colour cue |
| `COLOUR-5` | A recoverable warning; nothing has failed yet | `text-warning` + non-colour cue |
| `COLOUR-6` | Failure, invalid input or destructive action | `text-danger` / `border-danger` + visible message |
| `COLOUR-7` | Keyboard focus | `focus-visible:ring-2 focus-visible:ring-ring` |
| `COLOUR-8` | Disabled or unavailable control | `text-muted-foreground opacity-50` |
| `COLOUR-9` | Base page surface | `bg-background text-foreground` |
| `COLOUR-10` | Raised surface standing above the page | `bg-card text-foreground` |
| `COLOUR-11` | Subtle nested region inside a surface | `bg-muted text-foreground` |
| `COLOUR-12` | Neutral boundary | `border-border` |
| `COLOUR-13` | Independent data categories | ordered categorical palette + label or pattern |
| `COLOUR-14` | Brand artwork | controlled brand palette |
| `COLOUR-15` | Text over media | contrast overlay |

The index is an ORDER OF ENCOUNTER, not a scale. `COLOUR-8` is not "more" than `COLOUR-4`; there is
nothing between `COLOUR-2` and `COLOUR-3` to split the difference with. This module has no numeric
class scale, so the numbers carry no arithmetic at all — they are names.

`COLOUR-13`, `COLOUR-14` and `COLOUR-15` are the three closed situations in which a palette outside
the semantic set is permitted. They are codes rather than loopholes: naming a situation is what makes
it possible to say a use of it is wrong.

## Inputs

| Input | Evidence required |
|---|---|
| element | The single node receiving the class |
| role | content, interaction, state, surface or boundary |
| rank | primary or supporting — for content only |
| state | neutral, selected, success, warning, danger or disabled |
| surface relationship | base, raised, nested or overlay |
| non-colour cue | text, icon, shape, pattern or accessible label |
| theme | light, dark and forced-colour must resolve the same role |

## Invariants

1. Use semantic tokens. A component does not author raw hex, RGB or a palette shade.
2. Each code emits exactly one class expression. Two codes may share a token only where a second
   class separates them: `COLOUR-2` and `COLOUR-8` both reach for `text-muted-foreground`, and
   `opacity-50` plus a real `disabled` / `aria-disabled` state is what tells them apart.
3. Typography owns reading rank. Colour never promotes ordinary text into a heading.
4. Every `COLOUR-4`, `COLOUR-5` and `COLOUR-6` carries a matching text, icon or accessible label.
5. Selection (`COLOUR-3`) and focus (`COLOUR-7`) are different states and stay distinguishable when
   both are present on one element.
6. The same semantic role holds across light, dark and forced-colour themes. A theme changes token
   VALUES; it never changes which code applies.
7. The shared surface vocabulary is `bg-background`, `bg-card`, `bg-muted`, `border-border` and
   `ring-ring`. No module invents a parallel surface token name.
8. One element, one role. A surface node does not also carry a status colour.
9. Every rendered element resolves to exactly one code. No element is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Brand artwork (`COLOUR-14`).** A logo, mascot or illustration may use a controlled brand palette.
  This covers the artwork itself, never the interface around it.
- **Data visualisation (`COLOUR-13`).** A chart may use an ordered categorical palette when the
  mapping is stable and every series also carries a label, value or pattern.
- **Text over media (`COLOUR-15`).** An overlay may be chosen for measured contrast against an
  unpredictable image, never for decoration.
- **No role established.** Preserve the current class. For new readable content with no state, the
  safe default is `COLOUR-1`.
- **Role genuinely ambiguous.** Ask exactly ONE question about intended meaning, then stop. The
  answer is a class string or a question — never both.

## Output

```text
element: <the node receiving the class>
situation: <COLOUR-1 … COLOUR-15>
className: <semantic classes>
non-colour cue: <text | icon | shape | pattern | none>
reason: <business fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
