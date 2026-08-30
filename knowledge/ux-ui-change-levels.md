# UX/UI change levels

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.ux-ui-change-levels` |
| Owners | `starci-fe-process`, global input analysis |
| Search tags | `ux ui, audit, scope, layout, reconstruct, new, clarification` |

Every frontend UX/UI mission freezes exactly one `frontend.ux-ui.change-level` dimension inside its
larger mission scope before Skill selection, source inspection, design, or mutation. This dimension
is a mutation boundary, not the whole scope, a visual style, or a quality score.

## `refine`

The layout contract is already approved and locked. Preserve region ownership, region order,
navigation, interaction container, task sequence, responsive structure, and primary/secondary span.
The mission may audit and repair elements inside those boundaries: typography, spacing within the
existing owner, labels, controls, states, affordances, accessibility, tokens, and element-level
Grammar conformance.

Moving, adding, removing, splitting, merging, or reordering a region is outside this level and
requires a new authority decision.

## `reconstruct`

The target experience already exists, and the mission is authorized to build its UX/UI structure
again. It may change composition, region ownership and order, information hierarchy, interaction
container, responsive transformation, and the mapping of approved states to surfaces. It preserves
approved business facts, behavior authority, API semantics, and the named product boundary unless a
typed peer Skill changes them.

`Reconstruct` is not a synonym for unrestricted product invention.

## `new`

The approved target surface, flow, or journey does not yet exist and may be created. The mission must
bind the new target to approved business authority and define its closed states and exits before UI
implementation. Existing adjacent experiences are evidence, not a layout contract to copy.

## Clarity gate

Infer a level only when the active request or durable authority proves exactly one level. Current
source never proves the requested level by itself. Words such as `audit`, `redesign`, `làm lại`,
`improve`, `fix UI`, or `update page` are insufficient when they could authorize more than one level.

When the level is unresolved, stop before Skill selection or frontend inspection and ask one focused
scope question that:

1. names the exact target;
2. presents the materially plausible levels with their mutation boundaries;
3. asks which boundary is authorized; and
4. avoids unrelated implementation or style questions.

Do not silently choose the narrower or broader level. Do not ask again after the answer freezes one
level unless new evidence creates a different material ambiguity.
