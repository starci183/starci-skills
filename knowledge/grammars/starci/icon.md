# StarCi Core — Icon

This file maps the `ICON-n` mechanics rules to the live Core family: glyph source, measured boxes,
placement slots, and accessible identity. `gap` in the last column means Common publishes no owner
for the case.

Naming note: the live prop that selects the icon box is `usage`, not the `role` the retired file
named. `IconUsage` is `"heading" | "leading" | "chip"`.

## ICON-1 — Source priority and measured roles

The application resolves the glyph; Common owns only the box and the accessibility output.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | The glyph comes from the app registry | `Icon { source: IconSource }` — a function or class SVG component the app selects; Common passes `data-component="Icon"`, `data-usage`, and `focusable="false"` and never imports a glyph library | Core adds no scoped icon rule |
| Case 2 | The box is measured, not sized locally | `usage?: IconUsage` (default `chip`) → `size-6`, `size-5`, `size-4` with `shrink-0`: `24×24`, `20×20`, `16×16` CSS px at a 16px root | Inherited unchanged |
| Case 3 | The glyph is unresolved | `isSkeleton` → an `aria-hidden` shimmer span `size-5 rounded-full` with `data-loading="true"`, regardless of `usage` | Inherited unchanged |

Source: packages/grammar/src/common/renderers.ts → packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-2 — Compact chip and explicit status

A compact attribute or verified state pairs a 16px glyph with visible words in one status owner.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Word, tone, and glyph in one chip | `Badge { children, startContent, tone?: "neutral" \| "accent" \| "success" \| "warning" \| "danger", isSkeleton }` → HeroUI `Chip variant="soft" size="sm"` with `data-tone`; the glyph is an `Icon usage="chip"` placed in `startContent` | Chip colours resolve through `--success`, `--warning`, `--danger`, `--accent`, which Core binds to `--starci-core-*` |
| Case 2 | The chip is unresolved | `isSkeleton` hides `startContent`, sets `aria-hidden`, and renders the text transparent | Inherited unchanged |
| Case 3 | Words are required | `gap` — `Badge` accepts absent `children` and renders a non-breaking space, so a glyph-only chip is representable and word presence is not enforced by the type | Nothing to paint |

Source: packages/grammar/src/core/primitive/Badge/index.tsx; packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-3 — Every tab keeps icon and label identity

Each peer tab carries a stable label and a leading glyph, in compact and wide output alike.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | One identity per peer | `Tabs { label, selectedKey, items, onSelect?, panelId?, labelVisibility?: "responsive" \| "always", inset?: "page" \| "none" }` with `TabItem { id, label, leading?: ReactNode }`; every tab gets `aria-label={item.label}`, its content span `data-grammar-tab-id`, and a HeroUI `Tabs.Indicator` that Common CSS fixes at `2px` on the bottom edge | Core adds no scoped tab rule; only the token bindings apply |
| Case 2 | Labels in compact output | `.starci-core-tab-label` is `display: none` below `48rem` and `inline` from `min-width: 48rem`; `labelVisibility="always"` forces it inline through `data-grammar-tab-labels="always"` | Inherited unchanged |
| Case 3 | Every peer must carry a glyph | `gap` — `leading` is an optional `ReactNode`, not a typed `Icon`, so nothing forces a glyph or its `usage` on each peer | Nothing to paint |
| Case 4 | Before hydration | The renderer emits an `aria-hidden` placeholder with `data-grammar-tabs-client="pending"` and `min-height: 3rem`; identity and selection exist only once `data-grammar-tabs-client="ready"` | Inherited unchanged |

Source: packages/grammar/src/core/branch/Tabs/index.tsx; packages/grammar/src/common/styles.css

## ICON-4 — Directional action arrow

A forward or back arrow is an app-selected 16px glyph in a Common action slot; the label and the
target box stay fixed.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Arrow placement | `Button` and `TextAction` publish `startContent` and `endContent`; pending replaces `startContent` with an `aria-hidden` `Spinner` and drops `endContent`; `Button isSkeleton` drops both | Inherited unchanged |
| Case 2 | Arrow size | The glyph is an `Icon usage="chip"` (`16×16`) | Inherited unchanged |
| Case 3 | Arrow motion | `gap` — neither action publishes a motion anchor or attribute for its adornment, so a family has nothing to animate beyond `data-component` | `core/styles.css` defines no action motion |
| Case 4 | Logical mirroring | `gap` — `Icon` has no direction-aware mirroring contract; the app's registry chooses the literal glyph | Nothing to paint |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Icon/index.tsx

## ICON-5 — Utility icon-only action

A familiar utility may be glyph-only when one owner supplies its name, its target, and its optional
explanation.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Named glyph-only command | `IconButton { source, label (required), isActive?, isDisabled?, isSkeleton?, onPress? }` → HeroUI `Button isIconOnly variant="tertiary"` with `aria-label={label}` and `rounded-full`, wrapping an `Icon usage="leading"` (`20×20`, `aria-hidden`) | Core sets no size of its own; the computed target is measured at audit time |
| Case 2 | Pressed or active utility | `gap` — `isActive` emits `data-active="true"` only, with no `aria-pressed`, so an active utility is visual-only | Nothing to paint |
| Case 3 | Explanation on hover or focus | `Tooltip { content }` wraps the control and reveals `role="tooltip"` on `:hover` and `:focus-within` | `gap` — `aria-describedby` is placed on the tooltip's wrapper `span`, not on the focusable control, so the description is not programmatically attached to the button |
| Case 4 | Unavailable or unresolved | `isDisabled \|\| isSkeleton` → HeroUI `isDisabled`, `onPress` withheld; skeleton renders no glyph and a `rounded-full` shimmer | Inherited unchanged |

Source: packages/grammar/src/core/primitive/IconButton/index.tsx; packages/grammar/src/core/branch/Tooltip/index.tsx

## ICON-6 — Accessibility, fallback, and state truth

A glyph is named exactly once when it carries meaning, silent when it does not, and honest when it
cannot resolve.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Meaningful standalone glyph | `Icon ariaLabel` → `role="img"` with `aria-label`; absent → `aria-hidden="true"` | Inherited unchanged |
| Case 2 | Companion glyph beside a name | `IconButton` renders its inner `Icon` without `ariaLabel`, so the glyph is hidden and the button name stands alone | Inherited unchanged |
| Case 3 | Source fails to resolve | `gap` — `Icon` accepts only `source`; there is no fallback or error contract, so a missing registry mapping must be resolved by the app before render | Nothing to paint |
| Case 4 | Forced colours | Core binds `--starci-core-foreground` to `CanvasText`; whether the glyph follows `currentColor` is a property of the app's SVG | Token binding in `core/styles.css` |
| Case 5 | State glyph and state words | The words live in `Badge children` with `tone`, or on a `SurfaceCard state` emitted as `data-grammar-state`; the glyph is a separate `Icon` in `startContent` | Core maps the state to a tone name in `core/state.ts` and paints through tokens |

Source: packages/grammar/src/core/primitive/Icon/index.tsx; packages/grammar/src/core/primitive/IconButton/index.tsx; packages/grammar/src/core/styles.css
