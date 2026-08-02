# Elevation (shadow)

A shadow language is readable only while the number of shadows stays countable. Three tiers is
enough for almost every product, and the tier is chosen by what the element is doing rather than by
how much lift the author wants.

## 1. Three tiers, chosen by ROLE

- **Surface at rest** — a card or panel sitting on the page. A short, soft shadow, blur in the
  region of 4px.
- **Field at rest** — an input, a select, a combo box. Practically the same weight as a surface;
  it is a separate token because the field family moves independently of the card family.
- **Overlay** — a popover, dropdown, tooltip, or modal content. Several layers, blur up to roughly
  30px, usually with one negative-offset layer that throws the shadow slightly upward as well. This
  is the top tier and nothing sits above it.

Choose by the job, not by taste: resting on the page takes surface or field, floating above
everything else takes overlay. That is the whole reason two unrelated popovers in different corners
of a product read as the same kind of thing. Material's elevation levels make the same argument from
the other direction — the level is a property of the component's role, and every component of that
role shares it.

## 2. In dark mode the resting shadows disappear, so nested surfaces need a BORDER

A shadow is a dark thing drawn on a darker thing. On a dark theme the resting tiers are close to
invisible, and most systems set them to nothing rather than ship a shadow nobody can see. Material 3
accepts the same fact and answers it with surface tint instead of shadow.

The consequence is mechanical rather than stylistic: a card nested inside a card, or a field inside
a card, cannot be separated by shadow at all in dark mode. It has to be separated by a border. This
is the origin of the rule that a surface inside a surface takes a border and never a second fill.

The overlay tier changes strategy rather than disappearing: a faint light inset along the top edge
replaces the drop shadow, so a floating layer in dark mode is lit at its edge instead of casting a
shadow onto a black background.

## 3. Top-level takes shadow, nested takes border

Two stacked fills is never the answer in either theme — it produces a step in lightness that reads
as a rendering artifact rather than as a boundary. So the choice is mechanical:

- top-level surface: shadow, no border
- nested surface: border, no second fill

Deciding this once, at the theme level, is what stops every author from re-litigating it per card.

## 4. Do not invent a shadow

A block that wants to lift reaches for one of the three by role. A hand-rolled shadow adds a fourth
tier that no other component shares, and a shadow language stops being readable the moment there are
two dialects of it. The reader can no longer tell whether a slightly heavier shadow means "this is a
different kind of thing" or "somebody eyeballed it".

## Related

[[card]] (the border-to-shadow inversion) · [[input]] (a field nested in a card drops its shadow) ·
[[radius]] (concentric radius, the same nested-surface family).
