---
id: fe-principles-state-index
title: INDEX.md
slug: /gates/principles/state
sidebar_label: state
sidebar_position: 0
description: Binding rules for how many visual states an element owns and which of them are mandatory.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `state`

## Law

An element does not have one appearance. It has as many appearances as the conditions it can enter,
and that number is DERIVED from what the element can do. It is not chosen, and it is not a matter of
how many variants somebody had time to draw.

Count twice. First count the states the element CAN enter, from its own capability: it is pointed
at, it receives the keyboard, it is being pressed, it is turned off, it is the current one, it is
working, the value it holds has been rejected, the value it holds is frozen. Then count the states
it actually DRAWS. If the second number is smaller than the first, the element is incomplete, and
the missing states are precisely the ones nobody reports — because the person who needs them is not
the person looking at the screen.

**This is binding, not advisory.** Every rendered element carries a state situation, and every state
situation has a code below. There is no element too small to be exempt: a text link inside a
sentence owns `STATE-3` for exactly the same reason a submit button does, and a row in a list owns
`STATE-6` for the same reason a navigation tab does. "It is only a link" is not an exemption — it is
the most common place this rule is skipped.

Completeness is the law, and completeness is INVISIBLE. A control that draws hover but not
focus-visible looks finished in every screenshot ever taken of it, and cannot be operated by anyone
driving the page from a keyboard. No review that consists of looking at a picture will ever catch
it, because the defect is defined by the absence of something the picture had no reason to contain.
That is why the count is written down instead of eyeballed.

## Situation Codes

Every situation this module governs carries a code, `STATE-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two codes
emit no variant at all — because having exactly one appearance is a decision, not the absence of
one.

| Code | Situation | className |
|---|---|---|
| `STATE-0` | Non-interactive content; the element cannot change appearance because nothing can act on it | *no state variant* |
| `STATE-1` | Rest — the baseline every other layer is measured against | base classes, no variant prefix |
| `STATE-2` | A pointer is over an operable element | `hover:bg-muted` |
| `STATE-3` | Keyboard focus has landed on it | `outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `STATE-4` | The press is happening right now | `active:bg-muted/80` |
| `STATE-5` | Not operable in this context | `disabled:pointer-events-none disabled:opacity-50` + the `disabled` attribute |
| `STATE-6` | Persistently the chosen, current, checked or open one | `aria-[current=page]:bg-muted` · `aria-selected:bg-muted` |
| `STATE-7` | The element's own work is in flight | `aria-busy:cursor-progress` + `disabled` + a visible progress indicator |
| `STATE-8` | The value the element holds has been rejected | `aria-invalid:border-danger aria-invalid:ring-danger` + a linked message |
| `STATE-9` | The value is readable and focusable but frozen | `read-only:bg-muted read-only:cursor-default` |

`STATE-0` AND `STATE-1` ARE NOT THE SAME CODE. `STATE-0` says no state axis exists — nothing can
point at this paragraph, focus it, press it or reject it, so it has one appearance and that is
complete. `STATE-1` says a state axis DOES exist and this is its origin: the appearance the element
returns to when the pointer leaves, the keyboard moves on and the press ends. They fail differently.
An element wrongly called `STATE-0` is an interactive element with no states at all. An element with
`STATE-1` missing is a control that has a hover appearance and no defined appearance to go back to,
which is how a button ends up permanently highlighted after a click on a touch screen.

The indices are ordered, and the order carries two facts. `STATE-2`, `STATE-3` and `STATE-4` are the
TRANSIENT layers, driven by the input device, and they are numbered in the sequence the user meets
them: the pointer arrives, the keyboard lands, the press commits. That is also the order they must
be declared in, because a later declaration of equal specificity wins and a press must be able to
override a hover. `STATE-5` through `STATE-9` are the DECLARED layers, carried by data, permission
or validation rather than by the momentary position of an input device, and they outrank the
transient ones: a disabled control does not draw hover, whatever the pointer is doing.

## Mandatory floor

An element that responds to a pointer or a key owns `STATE-1`, `STATE-2`, `STATE-3` and `STATE-4` —
all four, always, with no exception for size, importance or how obvious the control seems. Each
declared code is then mandatory the moment the element has the matching capability.

| The element can… | …then it must also draw |
|---|---|
| be unavailable, by permission, quota, prerequisite or context | `STATE-5` |
| be the current, chosen, checked or open one among peers | `STATE-6` |
| start work that does not complete in the same frame | `STATE-7` |
| hold a value a validator can reject | `STATE-8` |
| show a value that is deliberately not editable here | `STATE-9` |

`STATE-3` is the one that is mandatory without condition and skipped most often. Any element that
can receive focus draws a focus indicator that is visible against whatever it sits on, at 3:1
contrast against its adjacent colours. Removing the browser default without replacing it is not a
style decision; it deletes the only signal a keyboard user has about where they are.

## Inputs

| Input | Evidence required |
|---|---|
| element | The rendered node and whether anything can act on it |
| capability | Whether it is pointer-operable, focusable, pressable, selectable, value-holding |
| availability | Whether permission, quota, prerequisite or context can withhold it |
| duration | Whether the work it starts finishes in the same frame |
| validation | Whether a validator can reject the value it holds |
| ownership | Whether this element or an ancestor owns the selection, busy or invalid condition |

## Invariants

- Every rendered element resolves to `STATE-0` or to `STATE-1` plus every code its capability admits.
- The state count is derived from capability, never from how many variants were drawn.
- `STATE-2` never appears without `STATE-3`. A hover-only control is unusable from a keyboard.
- `outline-none` is only legal in the same class list as a replacement focus indicator.
- `focus-visible` is the focus layer, not `focus`; a pointer press must not leave a ring behind.
- No state may be carried by hue alone. Every declared state pairs its colour with a second cue —
  text, icon, border, weight of indicator — that survives greyscale and forced-colour rendering.
- A state indicator, and the boundary of a state-changed control, meets 3:1 contrast against what is
  adjacent to it.
- No state may change layout. A state that alters size, font weight, border width or position moves
  the element's neighbours, and a control that moves under the pointer cannot be clicked reliably.
- Declared codes outrank transient ones. `STATE-5` and `STATE-7` neutralise `STATE-2` and `STATE-4`.
- Information revealed only by `STATE-2` does not exist on a touch device; if it matters, it is not
  a hover.
- A situation code maps to exactly one class group, and no class group serves two codes.
- Skeleton, empty and error CONTENT are not this module's codes; only the element's own layers are.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Explained unavailability.** `STATE-5` normally removes the element from the tab order, which also
  removes the explanation attached to it. When the user must be told WHY, keep the element focusable
  and mark it `aria-disabled="true"` instead of `disabled`, block the action in the handler, and give
  the reason in text. The code is still `STATE-5`; only its mechanism changes.
- **Whole-region busy.** When work belongs to a region rather than to the control that started it,
  `STATE-7` is carried by the region and the control inside it draws `STATE-5`. Two elements do not
  both claim the same in-flight work.
- **Selection owned by an ancestor.** A row that is selected draws `STATE-6` on the row. Controls
  inside it keep their own layers and do not restate the selection.
- **Native focus ring already sufficient.** An element that never sets `outline-none` and passes the
  3:1 check on its platform default satisfies `STATE-3` without a `focus-visible:` class. The code
  is still owed and still recorded; it simply emits nothing new.
- **Read-only versus disabled.** `STATE-9` is chosen only when the value must remain readable,
  selectable and reachable by keyboard. If the control is genuinely not part of this task, it is
  `STATE-5`.
- **Two codes both match.** Prefer the DECLARED code. A control that is both hovered and disabled is
  disabled; a field that is both focused and invalid keeps its invalid boundary underneath the ring.

## Output

```text
element: <the element and what can act on it>
can enter: <every code its capability admits>
draws: <every code it emits>
missing: <can enter minus draws — must be empty>
className: <base classes + one class group per drawn code>
reason: <the capability that makes each declared code mandatory>
```

## Load Policy

Read this file first. Read `vi.md` for the business situation behind each code, `example.md` for the
cases, exceptions and request mapping of every code, and `audit.md` only while reviewing the canon.

## Scope

This module decides WHICH STATES EXIST and which are mandatory. It does not decide which hue a state
is painted in, which is the neighbouring colour module's question, nor how much space a state
indicator occupies, which belongs to the spacing modules. It does not govern the content a region
shows while it has no data — skeleton, empty and failed-fetch renderings are region content, not an
element's own state layers.

This module states a rule true of any front end. It names no product, no component library, no
registry key and no repository. Every example is an ordinary `className` on ordinary markup.

## Version Rule

Increment all five records by `0.01` for an accepted rule change and record it in `changelog.md`.
