# StarCi Core — Boundary

This file maps the `BOUNDARY-n` anatomy rules to the live Core family: which Common owner draws,
names, clips, separates, or elevates a region, and what Core paints on it. `gap` in the last column
means Common publishes no owner for the case.

Prefix notice: `knowledge/ui/presentation/boundary.md` publishes a different `BOUNDARY-1` to
`BOUNDARY-6` series for app-owned separator and border tokens. The series below is the legacy
component-anatomy series relocated from the retired `ui/boundary.md`. Both keep their numbers; an
operator invocation binds one of the two, never both.

## BOUNDARY-1 — One reusable boundary owner

A visible region box or a peer separator has exactly one Common owner that emits the complete edge.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | A region box | `SurfaceCard` (`data-grammar-surface-card="true"`), `SurfaceListCard` (`data-grammar-surface-list="true"` with an inner `data-grammar-surface="true"` shell), or `SurfaceAccordionCard` (`data-grammar-accordion-shell="true"`, `data-grammar-surface="true"` when `depth` is given) | Tokens only, plus the one labelled-card rule in `core/styles.css` (see [Surface](surface.md), SURFACE-2) |
| Case 2 | A peer separator | `Divider { label: string }` → `role="separator"` with `aria-label={label}`, two `aria-hidden` `h-px bg-border` lines around a muted `Text` | `--border` resolves to `--starci-core-border` |
| Case 3 | A second shell around the owner | Not a Common owner; the renderers above already emit the edge, radius, background, and shadow | Core publishes no wrapper hook |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceListCard/index.tsx; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx; packages/grammar/src/core/primitive/Divider/index.tsx

## BOUNDARY-2 — Nesting and seams

A nested job or a set of touching bands gives every seam exactly one owner.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | A nested region | `depth="nested"` → `data-grammar-surface-depth="nested"`; Common CSS draws a 1px `--border` on the bounded frame and removes the shadow; list and accordion shells also emit `data-surface-context="nested"` | Border colour resolves to `--starci-core-border` |
| Case 2 | The nested content owns its own clipping | `frame="frameless"` → `overflow: visible`, no border, transparent background, so a nested bounded card clips itself | Core's labelled-card rule excludes frameless roots |
| Case 3 | Touching bands inside one card | `composition="joined"` → zero content inset, `gap: 0`; the children own their separators | Separator colour resolves to `--starci-core-separator` |
| Case 4 | Rows inside a disclosure or a static list | Common CSS draws `border-top: 1px solid var(--separator)` on `.starci-core-accordion-row + .starci-core-accordion-row` and on `.starci-core-static-row + .starci-core-static-row`, so the first row has no top seam | Inherited unchanged |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/common/styles.css

## BOUNDARY-3 — Labelled alternatives and dividers

A surface label stays inside the component it names; a labelled divider stands only between real
alternatives.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | The label names the region | `Label as="h3" id={headingId}` in the label row, referenced by `aria-labelledby` on the frame (`SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard`) | Core insets the label row of a labelled bounded card so it sits inside the one material |
| Case 2 | Two genuine alternatives | `Divider label` (required) → `role="separator" aria-label` plus the same word visible as muted `Text` | Text tone resolves through `--muted` → `--starci-core-muted` |
| Case 3 | A decorative line with no relationship | Not a `Divider`: its `label` is required and it always announces a separator; a purely visual rule is an app-owned token choice under presentation `BOUNDARY-n` | Inherited unchanged |

Source: packages/grammar/src/core/primitive/Divider/index.tsx; packages/grammar/src/core/primitive/Label/index.tsx

## BOUNDARY-4 — Elevation follows occlusion

Stacking, placement, and dismissal belong to the owner that actually covers another layer.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | An annotation covers its neighbour | `Tooltip { content, children, placement?: "top" \| "bottom" }` → a `role="tooltip"` node at `z-index: 20`, revealed on `:hover` and `:focus-within`, `transition: none` under `prefers-reduced-motion` | Background and text resolve to `--starci-core-foreground` over `--starci-core-canvas`; radius, duration, and easing come from the Core tokens |
| Case 2 | Arbitrary content must be elevated | `gap` — Common publishes no general overlay or elevation prop | Nothing to paint |
| Case 3 | A top surface carries a shadow | `depth="top"` shadow is material, not stacking: `var(--starci-core-surface-shadow, var(--shadow-surface, …))` | `0 8px 28px oklch(21.03% 0.0059 354.13 / 0.07)`, and `none` under forced colours |

Source: packages/grammar/src/core/branch/Tooltip/index.tsx; packages/grammar/src/common/styles.css; packages/grammar/src/core/styles.css

## BOUNDARY-5 — State, clipping, and responsive flattening

The same owner keeps the region through state, overflow, and viewport changes.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Bounded content clips, frameless exposes | Bounded frame class `starci-core-surface` has `overflow-hidden`; frameless has `overflow-visible` | The labelled bounded root also sets `overflow: hidden`, so both root and frame clip |
| Case 2 | Focus inside a clipping owner | The whole-action overlay and the accordion trigger use `outline: 2px solid var(--focus)` with `outline-offset: -2px`, so the ring stays inside the clip | `--focus` resolves to `--starci-core-focus` (`#7248ff`), `Highlight` under forced colours |
| Case 3 | State changes paint, not ownership | `data-grammar-state="unavailable"` lowers opacity and `pending` changes the cursor; the region attributes and the label relationship do not change | Inherited unchanged |
| Case 4 | The viewport narrows | Common CSS owns the responsive rules (form surfaces, rails, tabs); the owner attributes stay in the DOM | `core/styles.css` contains no width media query; Core adds no flattening of its own |
| Case 5 | Forced colours | Every edge token resolves to a system colour | `--starci-core-border` and `--starci-core-separator` become `CanvasText`, `--starci-core-surface-shadow` becomes `none` |

Source: packages/grammar/src/core/branch/SurfaceCard/classNames.ts; packages/grammar/src/common/styles.css; packages/grammar/src/core/styles.css
