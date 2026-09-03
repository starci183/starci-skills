# StarCi Core family and DNA

## Family identity

StarCi Core is defined by `coreGrammar` and selected by `CoreGrammarRoot`. It implements the Common contract; it is not the parent of Common or of any other family. `CORE_GRAMMAR_COMPONENTS` remains only a compatibility alias to `COMMON_GRAMMAR_COMPONENTS`.

Applicable universal rules: [TONE-1..3](../../ui/presentation/tone.md), [ACCENT-1..5](../../ui/composition/accent.md), [BOUNDARY-1..6](../../ui/presentation/boundary.md), [FONT-1..6](../../ui/presentation/font.md), [GAP-0..6](../../ui/presentation/gap.md), and [PADDING-0..8](../../ui/presentation/padding.md).

## CSS dependency direction

`core/styles.css` imports `common/styles.css`. Common supplies renderer anatomy, geometry, state structure, responsive composition, and universal `--grammar-*` spacing. Core supplies only family-scoped values and theme bindings. Common never imports Core; another family never imports Core.

## Core DNA

`STARCI_CORE_DNA`, token names, light/dark defaults, and legacy spacing aliases are published only by `@starci/grammar/core`. Core binds semantic variables including canvas/background, surface, foreground, muted, border/separator, accent/focus, success/warning/danger/info pairs, fields, radii, shadow, and motion.

The universal spacing source is Common: `COMMON_SPACING_SCALE` and `COMMON_SPACING_TOKENS`. `--starci-core-page-inset`, `--starci-core-region-gap`, `--starci-core-section-gap`, `--starci-core-row-gap`, and `--starci-core-inline-gap` are compatibility aliases to `--grammar-*`, not a second scale.

## Theme and accessibility binding

Core supports light, explicit dark, system dark, forced colors, focus-visible, and reduced motion under the Core root. It preserves Common semantics and cannot use palette or motion to change business truth. Applicable rules: [A11Y-1..4](../../ui/proof/accessibility.md), [FOCUS-1..4](../../ui/proof/focus.md), [MOTION-1..4](../../ui/proof/motion.md), and [STATE-1..3](../../ui/composition/state.md).

## Source-backed family behavior and gaps

- Core keeps the Common `SurfaceCard` renderer/props/semantics and uses family-scoped CSS plus the neutral `data-grammar-surface-labelled` hook to paint the outer labelled card as one material box. The inner bounded frame becomes transparent/no-shadow, so the label is visually inside Core material. Heritage's symmetric test paints only its inner frame, keeping the label outside without creating a second contract.
- `ButtonVariant` has no destructive/danger variant ([CTA-4](../../ui/composition/cta.md)).
- Common has no general modal focus-containment/restoration owner ([FOCUS-3](../../ui/proof/focus.md)).

## Gaps

Capabilities the live package does not publish, read out of the renderer source named in each row.
This table is the one gap inventory of the family: `scripts/generate-grammar-dna.mjs` copies it into
[DNA](DNA.md), so a gap recorded anywhere else is not published. A row states what is missing, never
which rule it once hung on.

| Component | Missing capability | Evidence |
| --- | --- | --- |
| `SurfaceCard`, `SurfaceListCard`, `SurfaceAccordionCard` | no typed heading level and no labelled-by-external-heading capability, so a surface whose correct level is not 3 has no owner | `packages/grammar/src/core/primitive/Label/index.tsx`; `packages/grammar/src/core/branch/SurfaceCard/index.tsx` |
| Common overlay owner | Common publishes no general overlay or elevation prop | `packages/grammar/src/core/branch/Tooltip/index.tsx`; `packages/grammar/src/common/styles.css` |
| `Badge` | `Badge` accepts absent `children` and renders a non-breaking space, so a glyph-only chip is representable and word presence is not enforced by the type | `packages/grammar/src/core/primitive/Badge/index.tsx` |
| `Tabs` | `leading` is an optional `ReactNode`, not a typed `Icon`, so nothing forces a glyph or its `usage` on each peer | `packages/grammar/src/core/branch/Tabs/index.tsx` |
| `Button`, `TextAction` | neither action publishes a motion anchor or attribute for its adornment, so a family has nothing to animate beyond `data-component` | `packages/grammar/src/core/primitive/Button/index.tsx`; `packages/grammar/src/core/primitive/TextAction/index.tsx` |
| `Icon` | `Icon` has no direction-aware mirroring contract; the app's registry chooses the literal glyph | `packages/grammar/src/core/primitive/Icon/index.tsx` |
| `IconButton` | `isActive` emits `data-active="true"` only, with no `aria-pressed`, so an active utility is visual-only | `packages/grammar/src/core/primitive/IconButton/index.tsx` |
| `Tooltip` | `aria-describedby` is placed on the tooltip's wrapper `span`, not on the focusable control, so the description is not programmatically attached to the button | `packages/grammar/src/core/branch/Tooltip/index.tsx` |
| `Icon` | `Icon` accepts only `source`; there is no fallback or error contract, so a missing registry mapping must be resolved by the app before render | `packages/grammar/src/core/primitive/Icon/index.tsx` |
| `MediaFrame` | no `object-position` or focal prop, and `className` reaches the figure rather than the viewport child, so a required off-centre crop has no owner | `packages/grammar/src/core/primitive/MediaFrame/index.tsx`; `packages/grammar/src/common/styles.css` |
| `MediaFrame` | `MediaFrame` publishes no loading or error prop and renders no state | `packages/grammar/src/core/primitive/MediaFrame/index.tsx` |
| `OtpInput` | `OtpInput` publishes `disabled` and `invalid` (not the `isDisabled`/`isError` names) and no skeleton input, so its unresolved state has no owner | `packages/grammar/src/core/OtpInput.tsx` |
| `OtpInput` | `OtpInput` publishes no `label`, `hint`, or `errorMessage` slot; only `describedBy` links outside text, so its visible identity has no Common owner | `packages/grammar/src/core/OtpInput.tsx` |
