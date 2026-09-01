# Core object: actions

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-object-actions` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `button, action, primary, secondary, destructive, loading, action group` |
| Dependencies | `fe.grammar-core-overview, fe.grammar-common-states-accessibility` |

## Responsibility

Actions communicate one available operation and its consequence hierarchy. Core emphasizes consequence through restrained fill, border, text, icon, and placement.

## Semantic element

- `TextLink` owns navigation, inspection, and “view all/back” destinations. It remains a native anchor
  with a real href in every state.
- `Button` owns same-context commands, submissions, mutations, and controlled state changes. It is
  never used merely to navigate.
- A visually elevated destination may use an exported link-action treatment, but its semantic element
  remains an anchor and it keeps link focus/activation behavior.

## Render rules

- Allow one visually dominant action per local decision region.
- Secondary and tertiary actions remain quieter and use declared variants.
- Destructive treatment is reserved for a genuinely destructive neutral intent.
- Action order follows task consequence, not arbitrary source order.
- Icon-only actions require an accessible name and package-defined hit target.
- A mutating Button binds pending to its public `isPending` interface: preserve label/geometry, show
  the package spinner in `currentColor`, expose busy state, and prevent duplicate activation. Do not
  add a separate pending sentence or replace unrelated content with skeletons when the Button already
  owns the feedback.
- Disabled needs a resolvable explanation nearby when the user can change the condition.

Button icons are optional and restricted to universal action glyphs whose meaning exactly matches the
label: directional arrow/chevron for back/next/continue, check for confirm, plus for add, close for
dismiss, trash for delete, upload/download, and search. Domain, category, reward, rank, decorative,
brand, or `IconTile` glyphs do not belong inside Buttons. A universal glyph never replaces the label
unless the declared icon-only interface and accessible name are sufficient.

## Grouping

Group actions only when they affect the same owner. Row actions stay with the row; block actions stay with the block. Several independent row actions must not become multiple dominant card-footer actions.

## Responsive

Use only declared wrapping, stacking, full-width, compact, or overflow behavior. Preserve action order and keep destructive action separated when accidental activation risk increases.

## Proof

Verify default, hover, focus, pressed, loading, disabled, destructive, long-label, icon-only, grouped, and narrow-screen fixtures.

## Reject

Reject competing primaries, color-only priority, layout-owned ad hoc button styling, a second pending
owner beside `isPending`, disappearing labels without context, decorative/domain button icons, and
Buttons used as navigation when `TextLink` or a link-action interface is the semantic owner.
