# Offset Pop case: mobile accent reduction

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-offset-pop-case-mobile-accent-reduction` |
| Package | `@starci/grammar/offset-pop` |
| Operators | `grammar-convergence` |
| Search tags | `mobile, remove rotation, reduce overlap, safe area, touch target, clipping` |
| Dependencies | `fe.grammar-common-case-responsive-flattening, fe.grammar-offset-pop-overview` |

## Trigger

Desktop rotation, overlap, offset depth, or large color fields reduce usable width or cause collision on a narrow viewport.

## Decision

Preserve task order, content, state, labels, and hit targets. Reduce in this order: decorative overlap, nonessential rotation, decorative card count, offset depth, large color fields. Keep the selected package's contour identity and role-bound colors where they do not impair use.

Rebuild visual order from DOM/task order. Respect safe areas, virtual keyboard, zoom, and focused-control visibility. A desktop collage may become a stack or simplified illustration.

## Reject and proof

Reject scaling the whole desktop composition, horizontal clipping, CSS order differing from focus order, covered actions, tiny text, or state conveyed only by removed decoration. Prove supported narrow widths, zoom, long translation, reduced motion, keyboard, and touch targets.
