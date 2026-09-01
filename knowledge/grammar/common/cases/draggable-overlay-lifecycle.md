# Common case: draggable overlay lifecycle

| Field | Value |
| --- | --- |
| Knowledge ID | `fe.grammar-common-case-draggable-overlay-lifecycle` |
| Contract revision | `7.6.0` |
| Package | `@starci/grammar/common` |
| Operators | `fe/authority-reconcile` |
| Search tags | `draggable, floating overlay, drag release, viewport edge, restore, focus` |
| Dependencies | `fe.grammar-common-states-accessibility` |

## Trigger

A fixed or floating control can be repositioned by the user inside a viewport or declared host
boundary.

## Closed lifecycle

The owner declares initial position, drag handle, pointer/touch/keyboard start, active movement,
release, edge clamping, collision behavior, focus continuity, persistence scope, resize/reflow/zoom
reconciliation, restored baseline, and reset. The overlay owns one transform/position state and never
adds terminal document height or a second page-padding owner.

Temporary overlap while actively dragging is permitted. At initial/restored state and after every
release, essential content and actions remain recoverable, the handle remains reachable, and the
overlay stays inside its declared safe host boundary. A captured overlap is a request to exercise the
lifecycle; it is neither an automatic PASS nor a page-specific exemption.

Viewport or zoom changes re-clamp the saved position without stale transforms, jumps outside the host,
or hidden focus. Reduced motion removes decorative interpolation without removing position feedback.
Opening any controlled surface preserves accessible name/state and returns focus on close.

## Proof

Prove initial state; pointer, touch, and keyboard paths where supported; release against every
constraint edge and corner; page scroll start/middle/end/restored; zoom in/out/restored; compact/wide
resize; focus traversal; controlled-surface open/close; persisted and reset position; and collision
with representative primary actions.

## Reject

Reject an unrecoverable occlusion, unreachable handle, escape from the host boundary, stale transform,
scroll bleed, duplicate document spacer, position reset on ordinary re-render, missing keyboard/focus
path, or a product-specific screenshot position promoted as universal behavior.
