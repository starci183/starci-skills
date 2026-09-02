# Consuming StarCi Core

## Imports

Renderers and prop types always come from Common:

```tsx
import { Sidebar, TextAction, WorkspaceShell } from "@starci/grammar/common"
import { CoreGrammarRoot } from "@starci/grammar/core"
import "@starci/grammar/core/styles.css"
```

Use `Link` for a destination and `Button` or `TextAction` for a same-context command ([ACTION-3](../../ui/composition/action.md)). Do not recreate TextLink, ActionLink, NavLink, SeeMoreLink, local Sidebar, or shell geometry.

## Root selection

```tsx
<CoreGrammarRoot theme="system">
  <ProductAdapter />
</CoreGrammarRoot>
```

The root applies family scope and visual DNA. Common props, semantic state, accessibility, and ownership remain unchanged. Family selection occurs once at the composition root.

## Product adapters

A product adapter may map routes, permission, copy, selected state, persistence, and callbacks into Common props. It must not own reusable geometry.

`LearnShellLayout` is therefore valid only as StarCi product code: it maps learning routes/state into the anonymous Common `WorkspaceShell`, `Sidebar`, `Tabs`, or `Subnav`. Its word “Learn” is exactly why it does not belong in Grammar. Nivo follows the same rule for any Console-named adapter.

## Family factory

`defineGrammarFamily` and `COMMON_GRAMMAR_COMPONENTS` are public from Common. A family may replace an existing renderer only with the same prop/meaning/accessibility contract and may add a non-colliding extension. `scopeProps` is the only family scope contract.

## Forbidden consumption

- renderer import from `@starci/grammar/core`;
- app-local clones of Common components or anonymous layouts;
- product names in Grammar public exports;
- business decisions, route effects, or persistence inside Common/Core;
- importing more than one sibling family stylesheet into the same root.
