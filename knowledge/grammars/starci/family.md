# StarCi Core family and DNA

## Family identity

StarCi Core is defined by `coreGrammar` and selected by `CoreGrammarRoot`. It implements the Common contract; it is not the parent of Common or of any other family. `CORE_GRAMMAR_COMPONENTS` remains only a compatibility alias to `COMMON_GRAMMAR_COMPONENTS`.

Applicable universal rules: [TONE-1..5](../../ui/presentation/tone.md), [ACCENT-1..5](../../ui/composition/accent.md), [BOUNDARY-1..5](../../ui/presentation/boundary.md), [FONT-1..5](../../ui/presentation/font.md), [GAP-1..5](../../ui/presentation/gap.md), and [PADDING-1..5](../../ui/presentation/padding.md).

## CSS dependency direction

`core/styles.css` imports `common/styles.css`. Common supplies renderer anatomy, geometry, state structure, responsive composition, and universal `--grammar-*` spacing. Core supplies only family-scoped values and theme bindings. Common never imports Core; another family never imports Core.

## Core DNA

`STARCI_CORE_DNA`, token names, light/dark defaults, and legacy spacing aliases are published only by `@starci/grammar/core`. Core binds semantic variables including canvas/background, surface, foreground, muted, border/separator, accent/focus, success/warning/danger/info pairs, fields, radii, shadow, and motion.

The universal spacing source is Common: `COMMON_SPACING_SCALE` and `COMMON_SPACING_TOKENS`. `--starci-core-page-inset`, `--starci-core-region-gap`, `--starci-core-section-gap`, `--starci-core-row-gap`, and `--starci-core-inline-gap` are compatibility aliases to `--grammar-*`, not a second scale.

## Theme and accessibility binding

Core supports light, explicit dark, system dark, forced colors, focus-visible, and reduced motion under the Core root. It preserves Common semantics and cannot use palette or motion to change business truth. Applicable rules: [ACCESSIBILITY-1..4](../../ui/proof/accessibility.md), [FOCUS-1..4](../../ui/proof/focus.md), [MOTION-1..4](../../ui/proof/motion.md), and [STATE-1..4](../../ui/composition/state.md).

## Source-backed family behavior and gaps

- Core keeps the Common `SurfaceCard` renderer/props/semantics and uses family-scoped CSS plus the neutral `data-grammar-surface-labelled` hook to paint the outer labelled card as one material box. The inner bounded frame becomes transparent/no-shadow, so the label is visually inside Core material. Heritage's symmetric test paints only its inner frame, keeping the label outside without creating a second contract.
- `ButtonVariant` has no destructive/danger variant ([CTA-4](../../ui/composition/cta.md)).
- Common has no general modal focus-containment/restoration owner ([FOCUS-3](../../ui/proof/focus.md)).
- `MediaFrame` has no explicit loading/error state prop ([MEDIA-5](media.md)).
