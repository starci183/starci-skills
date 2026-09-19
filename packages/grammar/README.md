# `@starci/grammar`

`@starci/grammar` separates one shared, business-free UI contract from sibling visual families.
Common owns typed props, semantics, renderer anatomy, universal states/scales, and the family
registry. Core, Heritage, and Offset Pop implement that contract with independently scoped visual
DNA. The package contains no routes, domain entities, product decisions, or feature-named shells.

## Public entry points

- `@starci/grammar/common` — shared React renderers, presentation-state helpers, and their CSS. Anonymous layout/action owners include `WorkspaceShell`, `Sidebar`, `Link`, and `TextAction`.
- `@starci/grammar/core` — the StarCi Core family, its scoped root, DNA, and compatibility aliases.
- `@starci/grammar/heritage` and `@starci/grammar/offset-pop` — sibling family roots,
  conformance receipts, and scoped visual overlays.
- `@starci/grammar/common/styles.css`, `@starci/grammar/core/styles.css`,
  `@starci/grammar/heritage/styles.css`, and
  `@starci/grammar/offset-pop/styles.css` — package stylesheets. Short `.css` export aliases are
  also available.

Install the workspace package while developing locally:

```sh
npm install ./.claude/packages/grammar
```

Import components from the focused entry point:

```tsx
import {
  PageContainer,
  PrimaryRailLayout,
  SurfaceCard,
} from "@starci/grammar/common"
import { CoreGrammarRoot } from "@starci/grammar/core"
import "@starci/grammar/core/styles.css"

export const ProductSurface = () => (
  <CoreGrammarRoot>
    <PageContainer>
      <PrimaryRailLayout
        primary={<SurfaceCard ariaLabel="Main">...</SurfaceCard>}
        rail={<SurfaceCard ariaLabel="Progress">...</SurfaceCard>}
      />
    </PageContainer>
  </CoreGrammarRoot>
)
```

`GrammarRoot` from Common is neutral. `CoreGrammarRoot` applies `data-grammar-family="core"` and
the Core stylesheet imports Common anatomy before adding StarCi light, dark, system, forced-colour,
and HeroUI-compatible tokens. `STARCI_CORE_DNA` exposes the immutable
design values, `STARCI_CORE_SPACING_SCALE` exposes the canonical 4px spacing steps,
`STARCI_CORE_TOKEN_NAMES` exposes their CSS adaptation contract, and
`STARCI_CORE_TOKEN_DEFAULTS` / `STARCI_CORE_DARK_TOKEN_DEFAULTS` expose the exact packaged values.

Heritage and Offset Pop replace only the neutral family root; every other Common renderer and prop
contract is inherited. Each family stylesheet imports Common anatomy directly and never imports a
sibling family stylesheet.

`IncludedMark` is the purpose-named 20px outlined circle-check for included offering content; it
inherits foreground and never claims completion. `SurfaceCopyGroup` packages Core's compact `0.5rem`
title/explanation rhythm. A `SurfaceCard` without `wholeAction` identifies itself as `static`, which
is the appropriate comparison surface when its short facts must remain visible together.

Common components accept ordinary typed React props and keep semantic DOM and accessibility behavior.
The application translates business data into those props; a family changes presentation only.
`MediaFrame` presents an already selected asset and never decides whether to generate one. The
machine-checkable `COMMON_UI_RULE_IDS`/`defineGrammarRuleConformance` boundary verifies that each
family accounts for the canonical UI X-n catalog without copying the laws into package code.

## Package checks

```sh
npm run typecheck
npm test
npm pack --dry-run
```

The package requires Node.js 20 or newer and has peer dependencies on React 18+ and
`@heroui/react` 3.2+.
