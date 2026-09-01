# Common case: responsive boundary flattening

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-responsive-flattening` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `responsive, flatten surface, mobile, reading order, focus order, reflow` |
| Dependencies | `fe.grammar-common-capabilities, fe.grammar-common-states-accessibility` |

## Trigger

A desktop surface hierarchy, grid, or nested composition becomes too dense or visually heavy on a narrow viewport.

## Goal

Simplify visual boundaries while preserving responsibility, grouping, state, and interaction order.

## Render decision

Derive mobile order from task dependency and reading order, not desktop coordinates. A visual surface may lose border, radius, shadow, or indentation only through the selected Grammar's declared responsive treatment. Keep headings, labels, row boundaries, and state ownership sufficient to preserve comprehension.

## Required states

Verify long content, validation, expanded rows, selected items, loading, empty, and sticky fallback after flattening.

## Reject

Reject CSS-only visual reordering that disagrees with DOM/focus order, removal of labels or state, hidden essential actions, accidental merging of separate responsibilities, or preservation of desktop decoration at the cost of usable width.

## Proof

Show DOM order, visual order, focus order, touch targets, text zoom, and representative state fixtures at supported narrow breakpoints.
