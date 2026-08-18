---
title: Principles runtime router
runtime: true
router: true
contextVersion: 1
---

# Principles runtime router

## LOADS

None.

## Record

Route each unresolved visual decision to the smallest applicable principle module. Read only the
selected child `context.md`; do not load the whole shelf. A rendered element may require several
modules because each module owns a different axis, but one decision within an axis resolves to one
situation code and its emitted class mapping.

## Routes

| Module | Trigger and scope | Runtime target |
|---|---|---|
| Alignment | Where children or wrapped lines hang on the cross axis; where a run sits on the main axis; baseline and one-child departure | `alignment/context.md` |
| Colour | Semantic foreground, background, border, status, focus, category, brand-artwork or media-overlay colour | `colour/context.md` |
| Distribution | How children take surplus or deficit along an axis: grow, equal shares, fixed basis, shrink permission or a growing seam | `distribution/context.md` |
| Divider | Whether a boundary is expressed by space, repeated rules, one closing edge, a shared seam, enclosure, a matrix or a divider element | `divider/context.md` |
| Flow | Whether direct children use native inline/block flow, one-line flex, stack, wrap, responsive axis change, repeated grid or role-based tracks | `flow/context.md` |
| Gap | The relationship expressed by the seam between direct siblings, including an explicitly gapless divided list | `gap/context.md` |
| Grid | Column-system decisions: fixed or intrinsic counts, role tracks, field margin/measure, single-column placement, spanning and break-out | `grid/context.md` |
| Overflow | Behaviour for bounded or unbounded content: no handling, truncate, clamp, wrap, internal vertical/horizontal scroll, yielding in a row or content-owned height | `overflow/context.md` |
| Padding | Inset owned by a boundary: none/delegated, compact repeated cell, grouped cell, ordinary surface or primary plane | `padding/context.md` |
| Radius | Corner ownership: none, control, surface, round shape, concentric inner boundary or cut/joined edges | `radius/context.md` |
| Responsive | A named failure across supported widths and its structural response: none, wrapping, axis change, fewer tracks, preserved horizontal meaning or equivalent replacement control | `responsive/context.md` |
| Size | Width or height ownership: intrinsic content, parent extent, ceiling, floor, token-fixed extent, parent share, released intrinsic floor or aspect-derived axis | `size/context.md` |
| State | Visual/behavioural state axis: none, rest, hover, keyboard focus, active press, disabled, selected/open/current, loading, invalid or read-only | `state/context.md` |
| Surface-in-surface | Whether a container owns an independent boundary/elevation, is a joined set, merely groups peers, duplicates its host, or is an ordinary nested action | `surface-in-surface/context.md` |
| Typography | Semantic role of rendered text: document outline depth, dominant or peer object title, UI copy, prose, qualifying copy, result marker, control-owned text or unresolved owner | `typography/context.md` |

## Routing rules

1. Route from the accepted content, anatomy, relationship and behaviour; never from visual taste.
2. Resolve direct ownership at the immediate parent or element named by the selected module.
3. Use the selected module's situation table as the closed vocabulary; preserve its no-class cases.
4. When two modules appear to answer the same symptom, separate the axes. For example, `flow`
   selects the arrangement, `distribution` assigns surplus/deficit, `alignment` positions on the
   other axis, and `responsive` acts only on a named width failure.
5. If the compact runtime record cannot settle the route, stop and report the missing runtime law.

## Output

```text
module: <child module>
target: <child/context.md>
why: <fact that puts the decision in this module's scope>
```
