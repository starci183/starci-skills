---
name: elevation
tier: foundations
admitted: 2026-07-30
---

# Elevation

## Role

The shadow depth a surface reads at rest versus floating. It governs which of three baked shadow
tiers a block gets by role — not whether a surface gets a border instead of a shadow, which is a
separate `surface` decision that this scale feeds into.

## Source of truth

There is no app-defined CSS variable for elevation. All three tiers are baked into
`@heroui/styles/dist/heroui.min.css` as `--surface-shadow`, `--field-shadow`, `--overlay-shadow`,
each with a light value and a separate `.dark`/`[data-theme=dark]` value. `globals.css` never sets
these variables itself — its only elevation-relevant line is `.card{border:none!important}`, which
picks which of the two (shadow or border) a top-level card shows, not the shadow value itself.

There is no root token here. Each of the three is an independently hand-set value inside the vendor
library — unlike `radius`, nothing here is a multiplier of anything else.

## Scale

| Step | Value (light) | Derived as | Means |
|---|---|---|---|
| `shadow-surface` | `0 2px 4px 0 #0000000a, 0 1px 2px 0 #0000000f, 0 0 1px 0 #0000000f` | hand-set in `@heroui/styles`, not derived from anything | card / surface at rest |
| `shadow-field` | `0 2px 4px 0 #0000000a, 0 1px 2px 0 #0000000f, 0 0 1px 0 #0000000f` — identical string to `shadow-surface` | hand-set independently; happens to match `shadow-surface` today | input / field at rest |
| `shadow-overlay` | `0 2px 8px 0 #0000000f, 0 -6px 12px 0 #00000008, 0 14px 28px 0 #00000014` | hand-set independently, deepest blur (28px) | popover / dropdown / tooltip / modal-content — the floating layer, above everything else on the page |

No step derives from a root, so "not derived" does not apply the way it does for a multiplier
scale. What replaces it here: dark mode collapses `shadow-surface` and `shadow-field` to
`0 0 0 0 transparent inset` (fully invisible) while `shadow-overlay` switches strategy entirely, to
a faint inset highlight (`0 0 1px 0 #ffffff4d inset`) instead of a drop shadow. A block that reads
correctly in light mode by shadow alone can be completely unreadable in dark mode if nothing else
marks its edge.

`shadow-surface` and `shadow-field` resolve to the **exact same value**, in both light and dark,
today. They are not the same token — `shadow-surface` carries the "card/surface" role and
`shadow-field` carries the "input/field" role. Nothing currently distinguishes a resting card from a
resting field by shadow; if the two tokens are ever given different values, every place that relied
on them reading identically (e.g. a card containing a field, both "at rest") will visibly split.

## How steps relate

Not a numeric relation — a **role selection**. Resting content (card, field) gets the shallow tier;
anything that floats above the rest of the page (popover, dropdown, tooltip, modal-content) gets the
overlay tier. Pick by role, not by how "important" a block feels.

A separate rule rides on top of role selection, driven by the dark-mode collapse above: once a
surface sits **nested inside another surface**, `shadow-surface`/`shadow-field` go invisible in dark
mode, so nesting can no longer be shown with shadow at all — the app switches to a **border** for
that case instead. The result is one rule, not two: **top-level = shadow, nested = border, never
both on the same layer.** The one committed exception is the top-level `Card` itself, which the app
forces to shadow-only (`.card{border:none!important}`, 2026-06-30) — it never falls back to a
border even though HeroUI would otherwise add one.

## Forbidden

| Forbidden | Caught by |
|---|---|
| reaching for an ad-hoc `shadow-[...]` arbitrary value to make a block "feel raised" instead of picking `shadow-surface`/`shadow-field`/`shadow-overlay` by role | nothing — arbitrary shadow utilities compile and render with zero warning |
| stacking a border **and** a shadow on the same nested surface to mark its edge | nothing — both classes apply cleanly; the double-fill only reads as wrong, never errors |

## Read by which axes

`surface` — every border-vs-shadow decision for a nested block routes through this scale.

## Anchors

`@heroui/styles/dist/heroui.min.css` for the three `--*-shadow` variables (light and `.dark` values,
read via direct grep of the minified bundle). `globals.css` for the `.card{border:none!important}`
override, dated 2026-06-30. The nested-surface-uses-border consequence is recorded in the `card` and
`input` component notes.
