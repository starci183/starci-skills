# Core case: sticky summary beside long content

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-case-sticky-summary` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `sticky summary, long form, side column, action, validation, scroll` |
| Dependencies | `fe.grammar-core-case-primary-secondary-grid, fe.grammar-common-case-sticky-scroll-owner` |

## Trigger

A compact summary or consequential action must remain visible beside a long primary form or content region.

## Decision

Use the narrow secondary column. The summary owns only derived facts and its declared action; the primary region owns editing and validation. Sticky begins below the stable page header, stops at the layout boundary, and never introduces a second page scroll.

Update summary values without stealing focus. Surface unresolved or invalid values neutrally and link recovery to the owning primary field when the package interface permits.

## Responsive

Convert to inline summary, collapsible summary, or declared bottom action region. Respect virtual keyboard and safe-area insets.

## Reject and proof

Reject duplicated editable fields, covered errors, independent scroll, stale summary without indication, and sticky purely for decoration. Prove long content, validation jumps, zoom, keyboard navigation, collision end, and mobile fallback.
