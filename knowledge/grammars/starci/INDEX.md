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

## Review gates

A valid change has no renderer import from `@starci/grammar/core`, no Common CSS import of Core CSS, no feature-named component in Grammar, no duplicated X-n law, and no EN/VI drift. Core-specific claims must resolve to live source or be named as a gap.
