---
id: fe-principles-focus-order-index
title: INDEX.md
slug: /gates/principles/focus-order
sidebar_label: focus-order
sidebar_position: 0
description: Binding rules for the keyboard path through a screen and for where focus goes when a layer opens or closes.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `focus-order`

## Law

A screen has one keyboard path, and that path is its DOM order. Write the markup in the order the
screen is meant to be read and operated; the path follows. Nothing chosen for appearance may change
it.

**This law is about DOM ORDER, not `className`.** Six of the eight codes below emit no class at all:
they are settled by where a node sits, by an attribute, or by what runs when a layer opens or closes.
`order-*`, `flex-row-reverse`, `grid` placement, `absolute` and `float` move pixels and leave the
path exactly where it was — which is why a screen can look correct and still be unusable by keyboard.
When the visual order and the reading order disagree, the markup moves. The class list never wins
that argument.

The layer that appears owns the focus it takes; the layer that disappears owns the focus it gives
back. Focus is never left standing on a node that has been removed, hidden or disabled.

**This is binding, not advisory.** Anything rendered raises at least one focus decision, and every
decision has a code below. There is no element too small to be exempt: a decorative icon inside a
button is `FOCUS-0` for the same reason a settings dialog is `FOCUS-3`. "It is just an icon", "it is
only a dropdown" and "nobody tabs to that" are not exemptions — they are the three places this rule
is skipped most often.

Standards this module carries: **2.4.3 Focus Order**, **2.4.7 Focus Visible**, **2.1.2 No Keyboard
Trap**, **2.4.1 Bypass Blocks**.

## Situation Codes

Every situation this module governs carries a code, `FOCUS-<index>`. The code names the SITUATION;
the className column names what that situation emits — and most of them emit nothing, because the
decision lives in the DOM.

| Code | Situation | className |
|---|---|---|
| `FOCUS-0` | The node must not be a tab stop: decorative, redundant, or behind an inactive layer | *no class* — no `tabindex`, plus `aria-hidden` or `inert` where needed |
| `FOCUS-1` | The node is a tab stop and takes its place from its DOM position | *no class* — the position IS the answer |
| `FOCUS-2` | The node can hold focus, so it must be visible while it does | `focus-visible:outline-2 focus-visible:outline-offset-2` |
| `FOCUS-3` | A layer owns the whole screen while it is up, so the path is confined to it | *no class* — `role="dialog" aria-modal="true"` + `inert` on the rest |
| `FOCUS-4` | A layer closed, so focus returns to whatever opened it | *no class* — a stored ref and `.focus()` |
| `FOCUS-5` | Repeated blocks stand between the top of the document and its content | `sr-only focus:not-sr-only focus:absolute …` |
| `FOCUS-6` | One composite widget is one tab stop; arrow keys move inside it | *no class* — `tabindex` `0` on the active member, `-1` on the rest |
| `FOCUS-7` | New content arrived and focus must be moved to it | *no class* — `tabindex={-1}` on the landing target and `.focus()` |

`FOCUS-0` AND `FOCUS-1` ARE SITUATIONS, NOT CLASSES. Neither has a utility to write, and inventing
one is a rule change rather than a shortcut. They exist because "this must never be reachable" and
"this is reachable exactly here" are the two facts a reviewer has to be able to cite. A situation
with no name is a situation nobody can be shown to have got wrong, and unreachable controls are
found precisely where nobody wrote down that they should have been reachable.

The index is contiguous and the numbers are load-bearing. `FOCUS-0` through `FOCUS-5` are the core
drawn straight from the four cited standards; `FOCUS-6` and `FOCUS-7` were appended, never inserted,
so that a citation written against an earlier revision still means what it meant.

## Inputs

| Input | Evidence required |
|---|---|
| node | The element the decision is about, and its position among its DOM siblings |
| reachability | Whether a keyboard user must be able to operate it at all |
| visual order | The order the eye reads, stated per viewport |
| layer | Whether the node sits inside something that opened over the screen |
| transition | What appeared, what disappeared, and what caused it |
| composition | Whether the node is one control or a set of peers navigated by arrows |
| opener | The element that caused a layer to appear, and whether it survives the close |

## Invariants

- The keyboard path is the DOM order. Presentation utilities do not reorder it.
- A positive `tabindex` is forbidden. No situation in this module emits one.
- Anything that can hold focus shows that it holds it.
- `outline-none` is legal only when the same element paints a replacement on the same state.
- One composite widget is one tab stop.
- Focus is never left on a node that was removed, hidden or disabled — every removal names its
  successor.
- Confinement is legal only where dismissal is guaranteed.
- Visibility and focusability agree: what a sighted user cannot see, a keyboard user cannot reach.
- A bypass mechanism is the first node in the document, not the first one that happens to be visible.
- Every decision resolves to exactly one code. No rendered screen is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the situation it
applies to.

- **Divergent visual order.** When a layout genuinely needs the summary above the form on one
  viewport and below it on another, restructure the DOM or render the decided order. Reordering with
  a class, or rendering twice and hiding one copy, is forbidden under `FOCUS-1`.
- **Focus on load.** Moving focus when a screen first renders is allowed only on a screen whose whole
  reason to exist is one field. Everywhere else the path starts at the top of the document, under
  `FOCUS-5`.
- **The opener is gone.** When the control that opened a layer no longer exists after the close —
  a deleted row, a removed item — `FOCUS-4` returns focus to the nearest surviving owner of that
  list, never to the document body.
- **Non-modal layers do not confine.** A menu, a combobox popup or an inline editor stays in the
  page path: it opens under `FOCUS-7`, navigates under `FOCUS-6`, closes under `FOCUS-4`, and never
  under `FOCUS-3`. Confining a layer that does not own the screen is the trap 2.1.2 forbids.
- **State parity.** Replacing a skeleton with real content does not move focus. Focus moves only when
  the user asked for that content, and then it is `FOCUS-7`.
- **A landing target is small.** `FOCUS-7` lands on the heading that names the new content, not on
  the region that contains it, so that the indicator required by `FOCUS-2` is legible rather than a
  box around half the screen.

## Output

```text
node: <element or transition being decided>
situation: <FOCUS-0 | FOCUS-1 | FOCUS-2 | FOCUS-3 | FOCUS-4 | FOCUS-5 | FOCUS-6 | FOCUS-7>
markup: <the DOM position or attribute that carries the decision>
className: <no class | focus-visible:outline-2 focus-visible:outline-offset-2 | sr-only focus:not-sr-only …>
reason: <the operational fact that excludes the adjacent code>
```

## Load Policy

Read this file first. Read `vi.md` for the situation behind each code, `example.md` for the cases,
exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is ordinary markup with ordinary `className`.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
