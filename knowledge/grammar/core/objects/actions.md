# Core object: actions

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-actions` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `button, action, primary, secondary, destructive, loading, action group` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

## Responsibility

Actions communicate one available operation and its consequence hierarchy. Core emphasizes consequence through restrained fill, border, text, icon, and placement.

## Render rules

- Allow one visually dominant action per local decision region.
- Secondary and tertiary actions remain quieter and use declared variants.
- Destructive treatment is reserved for a genuinely destructive neutral intent.
- Action order follows task consequence, not arbitrary source order.
- Icon-only actions require an accessible name and package-defined hit target.
- Loading preserves meaningful geometry and prevents duplicate activation.
- Disabled needs a resolvable explanation nearby when the user can change the condition.

## Grouping

Group actions only when they affect the same owner. Row actions stay with the row; block actions stay with the block. Several independent row actions must not become multiple dominant card-footer actions.

## Responsive

Use only declared wrapping, stacking, full-width, compact, or overflow behavior. Preserve action order and keep destructive action separated when accidental activation risk increases.

## Proof

Verify default, hover, focus, pressed, loading, disabled, destructive, long-label, icon-only, grouped, and narrow-screen fixtures.

## Reject

Reject competing primaries, color-only priority, layout-owned ad hoc button styling, disappearing loading labels without context, and buttons used as navigation when a navigation object exists.
