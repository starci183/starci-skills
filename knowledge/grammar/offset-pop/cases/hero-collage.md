# Offset Pop case: controlled hero collage

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-offset-pop-case-hero-collage` |
| Package | `@starci/grammar/offset-pop` |
| Operators | `fe/authority-reconcile` |
| Search tags | `hero, collage, rotated cards, overlap, visual anchor, editorial` |
| Dependencies | `fe.grammar-offset-pop-object-surface-card` |

## Trigger

A prominent introductory region combines heading, supporting text, actions, and several illustrative cards or markers.

## Decision

Name one primary reading anchor and one visual anchor. Decorative cards may rotate or overlap only through declared variants. Their DOM order follows meaning; visual coordinates remain presentation. Reserve clear space around the main action and heading. Use one dominant depth direction and a bounded accent palette.

Decorative cards are non-interactive unless their interface explicitly makes them controls. Any information required to complete the task must also exist in a stable readable region.

## Responsive

Reduce overlap, rotation, and card count before shrinking text or hit targets. Recompose into a stable stack or simplified illustration while preserving heading, support, and action order.

## Reject and proof

Reject random transforms, overlapping focus targets, essential text only inside decoration, or every object competing as focal. Prove reading order, focus order, long heading, translation, reduced motion, zoom, and narrow screens.
