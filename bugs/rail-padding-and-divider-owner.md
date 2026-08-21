# rail padding and divider owner

## Definition

The course-map rail rendered an ordinary-surface `p-4` inset and the resize separator occupied a
visible twelve-pixel layout column. The adjacent primary content also retained `mx-auto`, so the
shared boundary looked detached even though every individual class was allowed.

## Rules

1. `RAIL-OWNER-1` — A persistent StarCi route-content rail emits `px-3 py-6`, because its inline axis
   is compact navigation while its block axis carries the route-length reading rhythm. Content rails
   with authored labels resize within bounds; they never collapse those labels into icon-only state.
2. `RAIL-OWNER-2` — The adjacent primary route plane emits `p-6` in normal left-aligned flow,
   because it owns the route's reading inset rather than centring itself inside the remaining row.
3. `RAIL-OWNER-3` — A resize separator draws on the exact shared edge and consumes zero layout
   width; only its invisible pointer hit area may overlap the two neighbours.
4. `RAIL-OWNER-4` — Loading, ready, empty and failed states retain the same rail, separator and
   primary-plane geometry.
5. `RAIL-OWNER-5` — A resizable content rail and its adjacent body are independent scroll planes;
   resizing moves only their shared horizontal boundary, while route scrolling does not carry the
   rail with the body.
6. `RAIL-OWNER-6` — A content rail hides its native scrollbar thumb through the approved
   `ScrollViewport` branch, because a second partial vertical rule beside the full-height resize
   separator makes the separator appear broken.
7. `RAIL-OWNER-7` — A learn frame mounted below the app navbar uses `min-h-app-rail`, not
   `min-h-screen`, because adding a full viewport beneath the navbar creates one navbar-height of
   fake document scroll that separates sticky rails from the routed body.
8. `RAIL-OWNER-8` — A sticky content-rail boundary starts at `top-16` and owns `h-app-rail`; its
   `py-6` remains internal content inset. `top-rail` already includes one 24px content offset and
   therefore doubles the inset when paired with `py-6`.
9. `RAIL-OWNER-9` — The app-rail height token subtracts both the navbar's 4rem content box and its
   1px bottom separator, because the separator participates in normal-flow height and otherwise
   leaves a one-pixel document scroll range after browser rounding.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Apply the generic ordinary-surface `p-4` recipe to a route-content rail | It erases the rail's distinct inline and block roles | Emit `px-3 py-6` from the StarCi grammar |
| Collapse a content rail carrying authored labels | The compact state discards the meaning required to navigate long content | Keep the rail resizable between its declared bounds |
| Let the rail ride the body document scroll | Resizing and scrolling become one coupled region even though they have separate owners | Keep the rail sticky at the app band and give it a viewport-bounded scroll plane |
| Show a native scrollbar thumb beside the resize separator | The partial thumb reads as a divider that stops midway | Use the approved scroll-shadow viewport and hide the native thumb |
| Give a below-navbar learn frame `min-h-screen` | The document becomes `100vh + navbar`, creating a false scroll range | Use `min-h-app-rail` so the frame owns only the remaining viewport |
| Combine `top-rail` with an internally padded `py-6` rail | The sticky state counts the 24px top inset twice | Start the boundary at `top-16`, size it with `h-app-rail`, and keep `py-6` inside |
| Subtract only 4rem from the viewport for a 4rem navbar with a bottom border | The remaining border rounds into a one-pixel page scroll | Include the 1px separator in the shared app-rail height token |
| Give the separator `w-3` as a flex item | Its visible line floats in a false gutter | Keep zero layout width and overlap only the hit target |
| Add `mx-auto` to the adjacent primary plane | It creates an unowned offset after the divider | Keep normal flow and use `p-6` on the plane itself |

## Examples

Right: expanded and collapsed course-navigation, `content-map-panel` and
`personal-project-milestone-rail` all own `px-3 py-6`; `RailDivider` owns `w-0`; the following
primary plane owns `p-6` and no auto margin.

Wrong: the rail owns `p-4`; the separator owns `w-3`; the following plane owns `mx-auto px-6 py-6`.

The difference is ownership: rail inset, separator hit geometry and primary-plane inset are three
separate decisions, not one generic spacing choice.
