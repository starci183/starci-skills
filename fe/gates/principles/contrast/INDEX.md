---
id: fe-principles-contrast-index
title: INDEX.md
slug: /gates/principles/contrast
sidebar_label: contrast
sidebar_position: 0
description: Binding rules for the minimum contrast a rendered pair must reach, chosen from the role the foreground plays.
template: principles-v2
---

# INDEX.md

Version: `2.00` · Module: `contrast`

## Law

Contrast is a property of a PAIR, never of a colour. A token is neither legible nor illegible on its
own; it becomes one or the other at the instant it lands on a backdrop. Choose the duty from the role
the foreground plays, then measure that foreground against the backdrop it ACTUALLY renders on.

A colour rule picks a token for what an element MEANS. It cannot say whether the thing that ended up
adjacent can be read, because it only ever looks at one node. The pair is the case nobody owns, and
this module owns it: two decisions that are each correct alone — a muted caption, a muted panel —
compose into a pairing that no one measured and no one is answerable for.

The backdrop is the nearest ancestor that DECLARES a background. If nothing in the chain declares
one, the pair is unknown, and an unknown pair has not been checked — it has been assumed.

**This is binding, not advisory.** Every rendered pairing falls under exactly one code below, and no
case is too small to be exempt. A twelve-pixel timestamp sitting on a nested panel is `CONTRAST-1` for
the same reason a hero headline is `CONTRAST-2`, and a one-pixel hairline that is the only thing
marking a field's edge is `CONTRAST-3` for the same reason a filled button is. "It is only a caption",
"it is only a hairline", "it is only the placeholder" — these are not exemptions. They are the three
places this rule is skipped most.

One pairing, one code. A node that declares both a background and text produces TWO pairings: its text
against its own background, and its own background against its parent's. Codes nest; they do not merge
onto one measurement.

## Situation Codes

Every situation this module governs carries a code, `CONTRAST-<index>`. The code names the SITUATION;
the className column names what that situation emits. They are not the same thing, and two of them
emit no ratio at all.

| Code | Situation | className |
|---|---|---|
| `CONTRAST-0` | Decorative or standard-exempt by nature; conveys nothing | *no contrast pair; `aria-hidden="true"` on the ornament* |
| `CONTRAST-1` | Body text and every text below the large threshold — 4.5:1 | declared pair, e.g. `bg-card text-foreground`, `bg-muted text-foreground` |
| `CONTRAST-2` | Large text, ≥24px or ≥18.66px bold — 3:1 | declared pair at size, e.g. `bg-background text-3xl font-semibold text-muted-foreground` |
| `CONTRAST-3` | UI components, informational graphics and load-bearing boundaries — 3:1 | `border-border`, `bg-primary`, icon `text-foreground` against the declared backdrop |
| `CONTRAST-4` | The focus indicator — 3:1 against the unfocused component AND the adjacent backdrop | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` |
| `CONTRAST-5` | Colour is never the only carrier of meaning | a second channel: `underline underline-offset-2`, an icon, a shape, a pattern or a text label |
| `CONTRAST-6` | The backdrop is indeterminate — image, video, gradient or author-supplied content | manufacture a backdrop first: `bg-black/60`, `bg-gradient-to-t from-black/70`, then apply `CONTRAST-1` or `CONTRAST-2` on it |
| `CONTRAST-7` | Genuinely inactive control; the standard suspends the ratio | `disabled:opacity-50` plus a real `disabled` / `aria-disabled="true"` |

`CONTRAST-0` AND `CONTRAST-7` ARE SITUATIONS, NOT RATIOS. Neither emits a measurement, and both are
still codes — that is the point. A situation with no name is a situation nobody can be shown to have
got wrong. Without `CONTRAST-0`, every hairline argument ends in "it is just decoration" with nothing
to check that claim against; without `CONTRAST-7`, every faded control is either a violation or a
shrug, depending on who is looking.

`CONTRAST-0` is exempt by WHAT THE THING IS — permanently. `CONTRAST-7` is exempt by WHAT STATE IT IS
IN — conditionally, and it reverts to `CONTRAST-1` or `CONTRAST-3` the moment the control becomes
active. Collapsing the two loses that reversion, which is exactly the fact that matters.

The index is an ORDER OF DUTY, not a scale. There is no `CONTRAST-2.5` to split a difference with, and
`CONTRAST-7` is not "more" than `CONTRAST-3`. `1`, `2` and `3` are the three ratio duties, ordered by
how much of a screen they govern. `4` and `5` are duties that ordinary content ratios cannot express:
one is a state that only exists while a key is pressed, the other is not a ratio at all. `6` and `7`
are the two situations in which the pair cannot be measured as written — one because the backdrop is
unknown until runtime, one because the standard suspends the duty.

## Inputs

| Input | Evidence required |
|---|---|
| foreground | The node whose colour is being judged: text, glyph, fill or border |
| backdrop | The nearest ancestor that DECLARES a background — not the assumed page colour |
| size and weight | Computed px and weight, to place text above or below the large threshold |
| role | Content, control, informational graphic, boundary, focus ring or ornament |
| state | Default, hover, selected, invalid, inactive |
| carrier | Whether meaning survives without hue: text, icon, shape or pattern |
| theme | Light, dark and forced-colour must each resolve the same code and each pass |

## Invariants

1. A code is chosen per PAIR, not per node. Name both halves before naming a code.
2. The backdrop is the nearest declared background. An undeclared backdrop is an unmeasured pair.
3. Alpha changes the pair. `text-foreground/60` is a different colour from `text-foreground` and
   carries its own measurement; so does a translucent surface over an unknown parent.
4. Both themes pass or the pair fails. Passing in light and failing in dark is failing.
5. A ratio never discharges `CONTRAST-5`, and `CONTRAST-5` never discharges a ratio. Where both apply,
   both apply.
6. `CONTRAST-4` is measured twice — against the component it surrounds and against what sits outside
   it. A ring that only clears one of the two is not an indicator.
7. Size promotes duty, never role. Enlarging a caption to reach `CONTRAST-2` is a typography decision
   with a contrast consequence, not a way to avoid measuring.
8. Two pairings on one node are two codes. A card is `CONTRAST-1` for its text and `CONTRAST-3` for its
   own edge against the page.
9. Where two codes both match, take the STRICTER duty. This module's safe direction is upward.
10. Every rendered pairing resolves to exactly one code. No pairing is out of scope.

## Exceptions

Exceptions are part of the rule, not relief from it. Each is closed and cites the code it applies to.

- **Logotype (`CONTRAST-0`).** Text that is part of a brand mark is exempt by the standard. The
  exemption covers the mark, never the words around it, and never a wordmark reused as a heading.
- **Incidental content (`CONTRAST-0`).** Something hidden from every user, inactive by nature, or pure
  ornament behind opaque content carries no duty. "Nobody reads it" is not the test; "nobody CAN read
  it, by design" is.
- **Inactive control (`CONTRAST-7`).** The suspension holds only while the control is genuinely
  inactive and the reason is stated somewhere that DOES meet `CONTRAST-1`. A control that merely looks
  faded is not inactive.
- **Indeterminate backdrop (`CONTRAST-6`).** Never claim a ratio against an image. Manufacture a
  determinate backdrop, then measure against the thing you manufactured.
- **Redundant boundary (`CONTRAST-0` over `CONTRAST-3`).** A divider that only reinforces a separation
  already stated by spacing and by a heading carries no information, so it carries no ratio. The moment
  it is the ONLY evidence of where a control begins, it is `CONTRAST-3`.
- **Measurement missing.** Keep the pair already certified. Do not invent a shade to close a gap you
  have not measured; an unmeasured "safer" colour is still unmeasured.
- **Enhanced ratios.** This module states the AA floor. A 7:1 claim is a rule change recorded in
  `changelog.md`, not a stricter reading of the same rule.

## Output

```text
foreground: <node being judged>
backdrop: <nearest declared background>
situation: <CONTRAST-0 … CONTRAST-7>
required: <4.5:1 | 3:1 | none>
className: <declared pair, or the carrier this situation emits>
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
