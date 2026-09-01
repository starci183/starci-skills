# Core pattern: RightRail

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-pattern-right-rail` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/core` |
| Operators | `fe/authority-reconcile` |
| Search tags | `right rail, sticky, sidebar, content inset, spacing` |
| Dependencies | `fe.grammar-common-case-sticky-scroll-owner, fe.grammar-core-case-primary-secondary-grid, fe.grammar-core-pattern-page-container` |

## Trigger

A subordinate complementary region appears to the right of a dominant primary task.

## Closed contract

- `PrimaryRailLayout` owns tracks, rail width, gap, and responsive stacking.
- `Rail` with `inset=content` owns the complementary landmark and reuses the canonical Core
  PageContainer content inset; this file publishes no second numeric inset.
- `mode=sticky` additionally names the page scroll owner, top offset, collision/stop boundary, and
  compact fallback. CSS `position: sticky` alone is not the pattern.
- Children own their own surface boundaries; the rail must not add decorative color or a duplicate
  card frame.

The rail consumes the page/content inset role without becoming a universal Sidebar, drawer,
navigation rail, or card-padding rule.

## Proof

Prove flow and sticky modes at wide/intermediate/compact widths, scroll start/middle/end/restored,
150% zoom, long content, focus visibility, collision stop, and compact inline fallback.
