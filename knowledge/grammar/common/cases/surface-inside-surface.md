# Common case: surface inside surface

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-surface-inside-surface` |
| Package | `@starci/grammar/common` |
| Operators | `grammar-convergence` |
| Search tags | `nested surface, surface card, list inside card, padding owner, boundary` |
| Dependencies | `fe.grammar-common-contracts` |

## Trigger

A block-level surface contains a collection or interaction that appears to require its own surface boundary.

## Goal

Create a trustworthy nested boundary without decorative card-in-card noise or competing ownership.

## Owners

- Outer surface: page placement, external label, summary, peer relationship, and block-level action.
- Inner surface: repeated rows or one local interaction, row boundaries, local state treatment, and local overflow.
- Product Block: business data and mapping from domain meaning to neutral row states.

## Render decision

Use an inner surface only when it owns a distinct collection, focus, selection, scrolling, or interaction responsibility. Give padding, border, radius, shadow, and background one owner at each boundary. Keep the inner treatment visually subordinate according to the selected Grammar.

## Required states

Define loading, empty, one item, many items, partial, and error at the correct owner. A row state such as `affirmative` belongs visually to the inner row; its meaning remains in the Product Block.

## Responsive behavior

The inner visual boundary may flatten on narrow screens only when grouping, row ownership, focus order, and state comprehension remain intact.

## Reject

Reject decorative nesting, duplicate padding, two dominant shadows, two objects owning the same label, card-per-row without a peer-card contract, or a nested surface that exists only to add color.

## Proof

Show distinct owner responsibilities, anatomy/export references, state coverage, long-content behavior, keyboard order, and small-screen rendering.
