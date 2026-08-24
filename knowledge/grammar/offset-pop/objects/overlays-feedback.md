# Offset Pop object: overlays and feedback

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-offset-pop-object-overlays-feedback` |
| Package | `@starci/grammar/offset-pop` |
| Operators | `grammar-convergence` |
| Search tags | `dialog, sheet, popover, tooltip, toast, bold frame, focus return` |
| Dependencies | `fe.grammar-offset-pop-overview, fe.grammar-common-states-accessibility` |

Overlays may use bold package framing, but focus and dismissal behavior remain stable and conventional.

- Dialog/sheet owns title, description, focus entry/trap, dismissal, action region, and return focus.
- Popovers and tooltips reduce rotation because precise anchoring already creates visual tension.
- Toast-like feedback may be expressive but cannot be the sole recovery channel.
- Destructive confirmation prioritizes consequence and action over decorative personality.
- Viewport collision may change placement through declared behavior, never arbitrary transforms.

Verify keyboard, outside interaction, long content, zoom, small viewport, reduced motion, async action, and focus return. Reject nested overlays for decoration and accent layers that clip focus or required copy.
