# Core object: overlays and feedback

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-overlays-feedback` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `dialog, sheet, popover, tooltip, toast, inline feedback, focus return` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

Use overlays only for temporary context, focused interruption, anchored disclosure, or confirmation that cannot remain inline.

- Dialog/sheet owns title, description, focus entry/trap, dismissal, action region, and focus return.
- Popover/tooltip owns an anchored lightweight explanation or action set and must survive viewport collision.
- Inline feedback stays with its stable owning region.
- Toast-like feedback confirms transient outcomes but cannot be the sole recovery channel.
- Destructive confirmation states consequence and action explicitly.

Verify initial focus, keyboard dismissal, outside interaction, nested overlay refusal, long content, zoom, small viewport, reduced motion, async action, and focus return. Reject overlays used only to create visual emphasis or hide an information-architecture problem.
