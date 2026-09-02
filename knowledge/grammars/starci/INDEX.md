# StarCi Core Grammar — reading index

This branch documents one visual family: StarCi Core, and the taste that directs how it is composed. Universal UI law remains canonical in [knowledge/ui](../../ui/INDEX.md); this branch maps those X-n rules to the live Core family and records the idioms StarCi actually builds with. It never re-narrates renderer anatomy — [DNA](DNA.md), generated from the package, already says what exists and what each renderer owns.

## Authority chain

`knowledge/ui X-n → @starci/grammar/common props/anatomy/state → @starci/grammar/core DNA and scoped CSS → product adapter`

- Common owns public renderers, props, semantic DOM, accessibility, presentation states, universal spacing, `COMMON_GRAMMAR_COMPONENTS`, and `defineGrammarFamily`.
- Core is a sibling family with id `core`; `CoreGrammarRoot` installs `data-grammar-family="core"`.
- Feature code owns domain facts, routes, copy, permissions, persistence, and effects.
- Product names such as Learn, Console, Dashboard, Navbar, or Course never become Grammar identities.

## Read order

0. [DNA](DNA.md) — generated from the package: what exists. Prime a direction agent with this file.
1. [Idioms](idioms.md) — how StarCi composes what exists, each idiom evidenced at least twice in the live blocks.
2. [Playbook](playbook.md) — which idiom sequence a business shape asks for, and what a supplied reference may contribute.
3. [Family and DNA](family.md) — the visual family's own identity, tokens, CSS direction, theme binding, and the one gap table the whole family publishes.
4. [Consumption](consumption.md) — imports, root selection, family factory, and ownership boundary.
5. [Component matrix](components.md) — all 41 Common public renderers and their Core realization.
6. [Fields, actions, and states](states.md) — inputs, commands, destinations, pending, feedback, focus, and motion.
7. [Surfaces and compositions](composition.md) — material, label placement, layout, navigation, responsive behavior, and media/art direction.

Read 0 through 2 to decide what to build; read 3 through 7 when a row raises a question about the family itself.

## Review gates

A valid change has no renderer import from `@starci/grammar/core`, no Common CSS import of Core CSS, no feature-named component in Grammar, no duplicated X-n law, and no EN/VI drift. Core-specific claims must resolve to live source or be named as a gap.
