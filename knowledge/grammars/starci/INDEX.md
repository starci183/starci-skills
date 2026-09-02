# StarCi Core Grammar — reading index

This branch documents one visual family: StarCi Core. Universal UI law remains canonical in [knowledge/ui](../../ui/INDEX.md); this branch only maps those X-n rules to the live Core family.

## Authority chain

`knowledge/ui X-n → @starci/grammar/common props/anatomy/state → @starci/grammar/core DNA and scoped CSS → product adapter`

- Common owns public renderers, props, semantic DOM, accessibility, presentation states, universal spacing, `COMMON_GRAMMAR_COMPONENTS`, and `defineGrammarFamily`.
- Core is a sibling family with id `core`; `CoreGrammarRoot` installs `data-grammar-family="core"`.
- Feature code owns domain facts, routes, copy, permissions, persistence, and effects.
- Product names such as Learn, Console, Dashboard, Navbar, or Course never become Grammar identities.

## Read order

1. [Family and DNA](family.md) — identity, tokens, CSS direction, X-n bindings, and known gaps.
2. [Consumption](consumption.md) — imports, root selection, family factory, and ownership boundary.
3. [Component matrix](components.md) — all 41 Common public renderers and their Core realization.
4. [Fields, actions, and states](states.md) — inputs, commands, destinations, pending, feedback, focus, and motion.
5. [Surfaces and compositions](composition.md) — material, label placement, layout, navigation, responsive behavior, and media/art direction.
6. [Surface](surface.md) — SURFACE-1..5 anatomy: one compound card, where Core paints its one material, closed geometry props, state/whole-action/scroll/highlight ownership, and the heading-level gap.
7. [Boundary](boundary.md) — BOUNDARY-1..5 anatomy: which owner draws, nests, names, elevates, and clips a region, and what survives state and viewport change.
8. [Icon](icon.md) — ICON-1..6 mechanics: `Icon usage` boxes, chip status, tab identity, action arrows, glyph-only utilities, and accessible naming.
9. [Media](media.md) — MEDIA-1..6 mechanics: `MediaFrame` ratios, fit, treatment, caption, and the loading/error and focal-point gaps.
10. [Control state](control-state.md) — CONTROL-STATE-1..4: pending, unavailable, skeleton, and persistent selection through the published props.
11. [Field](field.md) — FIELD-1..4: `Input` and `OtpInput` label, guidance, error, availability, and the evidence that proves the relationship.

## Review gates

A valid change has no renderer import from `@starci/grammar/core`, no Common CSS import of Core CSS, no feature-named component in Grammar, no duplicated X-n law, and no EN/VI drift. Core-specific claims must resolve to live source or be named as a gap.
