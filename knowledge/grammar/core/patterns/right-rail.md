# Core pattern: RightRail

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-core-pattern-right-rail` |
| Contract revision | `7.4.0` |
| Package | `@starci/grammar/core` |
| Operators | `grammar-convergence` |
| Search tags | `right rail, sticky, sidebar, px-3, py-6, spacing` |
| Dependencies | `fe.grammar-common-case-sticky-scroll-owner, fe.grammar-core-case-primary-secondary-grid` |

## Trigger

A subordinate complementary region appears to the right of a dominant primary task.

## Closed contract

- `PrimaryRailLayout` owns tracks, rail width, gap, and responsive stacking.
- `Rail` with `inset=content` owns the complementary landmark and its content inset:
  `space.inline.3` (`px-3`) and `space.block.6` (`py-6`).
- `mode=sticky` additionally names the page scroll owner, top offset, collision/stop boundary, and
  compact fallback. CSS `position: sticky` alone is not the pattern.
- Children own their own surface boundaries; the rail must not add decorative color or a duplicate
  card frame.

These insets apply only to `navigation.right-rail.content`. They are not a universal Sidebar, drawer,
navigation rail, or card-padding rule.

## Proof

Prove flow and sticky modes at wide/intermediate/compact widths, scroll start/middle/end/restored,
150% zoom, long content, focus visibility, collision stop, and compact inline fallback.

