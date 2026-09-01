# Common case: sticky object and scroll owner

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-sticky-scroll-owner` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `sticky, scroll container, collision, summary, action bar, focus` |
| Dependencies | `fe.grammar-common-capabilities, fe.grammar-common-states-accessibility` |

## Trigger

A summary, navigation object, header, or action region must remain available while nearby content scrolls.

## Goal

Preserve task continuity without hiding content, creating competing scroll containers, or breaking focus visibility.

## Render decision

Name exactly one scroll container and one sticky owner. Define sticky edge, offset, collision boundary, stacking relationship, stop point, and fallback. The sticky object must remain associated with the content or action it controls.

## Required states

Verify initial, stuck, collision/end, content loading, validation error, focused descendant, zoomed text, and viewport resize.

## Responsive behavior

On small screens, convert to the package-declared bottom action region, inline summary, collapsible owner, or non-sticky flow. Respect safe areas and virtual keyboards.

## Reject

Reject nested page scroll, sticky objects covering validation or focus rings, unbounded z-index escalation, decorative sticky behavior, or two sticky objects competing for the same edge.

## Proof

Demonstrate the named scroll owner, collision boundary, keyboard traversal, zoom behavior, mobile fallback, and no covered content.
