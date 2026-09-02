# StarCi Core — Surface

This file maps the `SURFACE-n` anatomy rules to the live Core family. The universal meaning of each
rule is one line under its heading; the table says which Common renderer, slot, or prop owns the
case and what Core does with it. `gap` in the last column means Core inherits the case unchanged and
Common publishes nothing for it.

Prefix notice: `knowledge/ui/presentation/surface.md` publishes a different `SURFACE-1` to
`SURFACE-6` series for app-owned surface tokens. The series below is the legacy component-anatomy
series relocated from the retired `ui/surface.md`. Both keep their numbers because rule IDs are never
renumbered; an operator invocation binds one of the two, never both, because one prefix belongs to
one topic.

Common's public renderers are exported from `packages/grammar/src/common/renderers.ts`; their
physical files sit under `packages/grammar/src/core/` as internal storage. Core the family replaces
only `GrammarRoot` (`packages/grammar/src/core/index.ts`) and contributes
`packages/grammar/src/core/styles.css`, so "Core realization" below is either a token binding in that
stylesheet, the one labelled-card rule it adds, or nothing.

## SURFACE-1 — One Common compound-card anatomy

A reusable region is one `SurfaceCard`: one root, at most one label row, exactly one content owner.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | One region, one root | `SurfaceCard` renders HeroUI `Card.Root` as a `<section>` (`render` prop) with `variant="transparent"`, `data-grammar-surface-card="true"`, and `data-grammar-surface-labelled="true|false"` | Inherited unchanged; `coreGrammar` replaces only `GrammarRoot` |
| Case 2 | At most one label row | `Card.Header` with `data-grammar-surface-label="true"` renders only when `label` is set; `labelEnd` or `fact` takes the single trailing place | Core insets that row (`padding` on `> [data-grammar-surface-label]`) only for labelled bounded cards |
| Case 3 | Exactly one content owner | One `Card.Content` per root carrying `data-grammar-frame`, `data-grammar-state`, `data-grammar-surface-depth`, and the region name; `data-slot="card"` and `data-slot="card-content"` are the HeroUI anchors the family stylesheets select | No second content slot is published or painted |
| Case 4 | The application wants the same look | It imports `SurfaceCard` from `@starci/grammar/common`; `CORE_GRAMMAR_COMPONENTS` is a deprecated alias of the same registry | Core exports no renderer of its own |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/index.ts

## SURFACE-2 — Family chooses where the one material is painted

The same Common DOM adopts a family's material at exactly one boundary.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Labelled bounded card under Core | Neutral hooks `data-grammar-surface-labelled="true"` on the root and `data-grammar-frame="bounded"` on root and content; Common CSS gives the bounded frame (`.starci-core-surface`) its radius and background, `depth="top"` its shadow, `depth="nested"` its 1px border | `core/styles.css` paints the labelled bounded root once (radius `--starci-core-surface-radius`, background `--starci-core-surface`, shadow `--starci-core-surface-shadow`, `overflow: hidden`) and sets the inner bounded frame to `border: 0; border-radius: 0; background: transparent; box-shadow: none`, so the label sits inside the one material |
| Case 2 | Self-named card, no label | Same DOM with `data-grammar-surface-labelled="false"`; the bounded frame keeps Common's paint | Core's rule is scoped to `data-grammar-surface-labelled="true"`, so the material stays on the inner frame |
| Case 3 | A highlighted labelled card | The bounded frame sits under a `data-grammar-highlight="true"` wrapper | Core's same rule also neutralises `> [data-grammar-highlight="true"] > [data-grammar-frame="bounded"]`, so the highlight does not reintroduce a second painted box |
| Case 4 | Application CSS reaches a Common slot | `[data-slot="card-content"]`, `[data-grammar-frame]`, and the `.starci-core-*` classes are Common anatomy, not extension points | Core publishes no application hook; the only public width and height choices are the `measure` and `height` props |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/styles.css; packages/grammar/src/common/styles.css

## SURFACE-3 — Frame, depth, composition, measure, and height remain closed props

Geometry is chosen from the published enums, never from descendant CSS or compensating wrappers.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Top-level versus nested | `depth?: "top" \| "nested"` → `data-grammar-surface-depth` on `Card.Content`; Common CSS: top has no border and the surface shadow, nested has a 1px `--border` and no shadow | `--border` resolves to `--starci-core-border`, shadow to `--starci-core-surface-shadow` |
| Case 2 | Content already owns its boundary | `frame?: "bounded" \| "frameless"` → `data-grammar-frame`; frameless adds `starci-core-frameless-surface`: `overflow: visible`, no border, transparent background, zero content padding | Core's labelled rule fires only for `data-grammar-frame="bounded"`, so a frameless card receives no Core paint |
| Case 3 | Touching child bands | `composition?: "single" \| "joined"` → `data-grammar-surface-composition` on root, content, and scroll region; joined content computes `padding: 0; gap: 0` as a column | Inherited; seams inside joined bands belong to the children |
| Case 4 | Form measure | `measure?: "content" \| "form" \| "formCompact"` → `starci-core-form-surface` (`min(100%, var(--starci-core-form-measure, 30rem))`) and `--compact` (`28rem`) | Core sets neither `--starci-core-form-measure` nor the compact variable; the Common defaults apply |
| Case 5 | Peers stretch to one height | `height?: "auto" \| "fill"` → `starci-core-surface-card--fill` and `data-grammar-surface-height="fill"`; Common CSS chains `height: 100%` through root, highlight wrapper, frame, and content | Inherited unchanged |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceCard/classNames.ts; packages/grammar/src/common/styles.css

## SURFACE-4 — State, whole action, scroll, and highlight keep one owner

A surface's state, its single whole-surface action, its one scroll owner, and its one highlight are
all emitted by the same renderer.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Presentation state | `state?: PresentationState` (`neutral \| informative \| affirmative \| cautionary \| negative \| pending \| unavailable`), checked by `assertPresentationState`, emitted as `data-grammar-state` and `data-grammar-treatment`; Common CSS renders `unavailable` at `var(--starci-core-disabled-opacity, 0.55)` and `pending` with `cursor: progress` | `treatmentFor` in `core/state.ts` maps the state to a tone name (`quiet`, `positive`, `information`, `warning`, `danger`, `inactive`, `pending`); Core sets no `--starci-core-disabled-opacity`, so the fallback applies |
| Case 2 | One whole-surface action | `wholeAction?: { kind: "link", href, label } \| { kind: "button", press, label }` → one absolutely positioned `<a data-grammar-whole-action="link">` or `<button data-grammar-whole-action="button">` inside the frame; root carries `data-grammar-interaction="whole-action"`; `unavailable` and `pending` withhold `href`, set `tabIndex={-1}` and `aria-disabled`, or `disabled` | Common CSS paints hover and focus-visible fills through `--accent-soft` with a `--starci-core-surface-secondary` fallback and the active fill by mixing `--starci-core-accent`; Core binds `--focus`, `--accent`, and `--surface-secondary`, and does not define `--accent-soft` |
| Case 3 | One scroll owner | `scroll?: "page" \| "contained"` or `isScrollable` → `data-grammar-scroll="contained"` on the frame and `VerticalScrollRegion` becomes HeroUI `ScrollShadow orientation="vertical"`; Common CSS caps it at `var(--starci-core-contained-max-height, calc(100dvh - 3rem))` with `overscroll-behavior: contain` | Core sets no `--starci-core-contained-max-height`; the Common default applies |
| Case 4 | One highlight, suppressed while pending | `isHighlight?: boolean` → wrapper `data-grammar-highlight="true"` with an `aria-hidden` sweep (`conic-gradient` of `--starci-core-accent`, 3s spin, `animation: none` under `prefers-reduced-motion`); the renderer skips the wrapper when `state === "pending"` | Accent colour resolves to `--starci-core-accent`; the labelled-card rule handles the frame beneath the wrapper (SURFACE-2 Case 3) |

Source: packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/state.ts; packages/grammar/src/common/styles.css

## SURFACE-5 — Heading ownership is a current exact Common gap

A labelled surface's heading level should follow its outline context; today it cannot.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | The label needs the level its outline parent implies | `SurfaceCard`, `SurfaceListCard`, and `SurfaceAccordionCard` all render `Label as="h3" id={headingId}`; `LabelProps.as` is `"span" \| "h3"` and no surface prop exposes it | `gap` — no typed heading level and no labelled-by-external-heading capability, so a surface whose correct level is not 3 has no owner |
| Case 2 | The surface is self-named | `ariaLabel` alone puts `aria-label` on the frame and emits no heading | Inherited unchanged |
| Case 3 | A list surface hides its label | `SurfaceListCard labelHidden` omits the label row, sets `data-grammar-label-visibility="hidden"`, and names the shell with `aria-label` | Inherited unchanged |

Source: packages/grammar/src/core/primitive/Label/index.tsx; packages/grammar/src/core/branch/SurfaceCard/index.tsx; packages/grammar/src/core/branch/SurfaceListCard/index.tsx; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx
