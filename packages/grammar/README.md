# `@starci/grammar`

`@starci/grammar` splits a UI kit into one shared contract and several visual families. The
contract has no business logic. Common owns the typed props, semantics, renderer anatomy, universal
states and scales, and the family registry. Core, Heritage and Offset Pop are sibling families.
Each one implements the same contract with its own scoped visual DNA. The package contains no
routes, domain entities, product decisions or feature-named shells.

Common ships **95 renderers**. Every family renders all of them. A family changes presentation
only: props, DOM, ARIA and keyboard behaviour stay the same.

## Install

```sh
npm install @starci/grammar @heroui/react react react-dom
# while developing inside this repository:
npm install ./.claude/packages/grammar
```

The package needs Node.js 20 or newer. Its peer dependencies are React 18+ and `@heroui/react`
3.2+. Load the HeroUI stylesheet once in the app, as HeroUI's own setup describes. Then import
exactly one Grammar family stylesheet. Each family sheet already imports Common anatomy first.

| Entry point | Root component | Stylesheet |
| --- | --- | --- |
| `@starci/grammar/common` | `GrammarRoot` (neutral) | `@starci/grammar/common/styles.css` (`common.css`) |
| `@starci/grammar/core` | `CoreGrammarRoot` | `@starci/grammar/core/styles.css` (`core.css`) |
| `@starci/grammar/heritage` | `HeritageGrammarRoot` | `@starci/grammar/heritage/styles.css` (`heritage.css`) |
| `@starci/grammar/offset-pop` | `OffsetPopGrammarRoot` | `@starci/grammar/offset-pop/styles.css` (`offset-pop.css`) |

The Core and Offset Pop entry points re-export all of Common, so an app imports its components and
its root from one place. Heritage does not re-export Common. It exports `heritageGrammar`,
`HeritageGrammarRoot`, its `Brand` extension (`HeritageBrand`), the `HeritageButton` and
`HeritageHeading` aliases and its conformance, so import the other renderers from
`@starci/grammar/common`.

## Usage

### Common (neutral structure only)

```tsx
import { Button, GrammarRoot, PageContainer, SurfaceCard } from "@starci/grammar/common"
import "@starci/grammar/common/styles.css"

export const App = () => (
  <GrammarRoot theme="system">
    <PageContainer>
      <SurfaceCard label="Welcome"><Button>Start</Button></SurfaceCard>
    </PageContainer>
  </GrammarRoot>
)
```

### Core

```tsx
import { CoreGrammarRoot, PageContainer, PrimaryRailLayout, SurfaceCard } from "@starci/grammar/core"
import "@starci/grammar/core/styles.css"

export const ProductSurface = () => (
  <CoreGrammarRoot theme="system">
    <PageContainer>
      <PrimaryRailLayout
        primary={<SurfaceCard ariaLabel="Main">…</SurfaceCard>}
        rail={<SurfaceCard ariaLabel="Progress">…</SurfaceCard>}
      />
    </PageContainer>
  </CoreGrammarRoot>
)
```

`STARCI_CORE_DNA` exposes the immutable design values. `STARCI_CORE_SPACING_SCALE` exposes the
4px spacing steps. `STARCI_CORE_TOKEN_NAMES` lists the CSS variables, and
`STARCI_CORE_TOKEN_DEFAULTS` / `STARCI_CORE_DARK_TOKEN_DEFAULTS` hold their exact packaged values.

### Heritage

```tsx
import { TopBar } from "@starci/grammar/common"
import { HeritageBrand, HeritageGrammarRoot } from "@starci/grammar/heritage"
import "@starci/grammar/heritage/styles.css"

export const Masthead = () => (
  <HeritageGrammarRoot>
    <TopBar brand={<a href="/"><HeritageBrand name="…" descriptor="…" logo={{ src: "/logo.svg", width: 40, height: 40 }} /></a>} />
  </HeritageGrammarRoot>
)
```

Heritage replaces only the root. It adds one extension, `Brand`, which is non-interactive brand
content for a destination the consumer owns.

### Offset Pop

```tsx
import { Button, OffsetPopGrammarRoot, SurfaceCard, Toaster } from "@starci/grammar/offset-pop"
import "@starci/grammar/offset-pop/styles.css"

export const App = () => (
  <OffsetPopGrammarRoot theme="system">
    <SurfaceCard label="Today"><Button variant="primary">Play</Button></SurfaceCard>
    <Toaster label="Notifications" dismissLabel="Dismiss" />
  </OffsetPopGrammarRoot>
)
```

Offset Pop is a playful family and stays product-neutral. Its signature is an ink outline, a hard
offset shadow and a pink decision accent. Text that uses the accent is drawn in a text-safe accent
(`--offset-pop-accent-text`). Reduced motion removes every transform. The DNA is
`OFFSET_POP_DNA`, which has the same keys as Core's plus two groups: `offset` (`x`, `y`,
`outlineWidth`, `ink`, `shadowInk`) and `palette` (`pink`, `blush`, `yellow`, `mint`,
`critical`). It also exports `OFFSET_POP_SPACING_SCALE`, `OFFSET_POP_TOKEN_NAMES`,
`OFFSET_POP_TOKEN_DEFAULTS`, `OFFSET_POP_DARK_TOKEN_DEFAULTS`, `OFFSET_POP_BAND_TOKEN_NAMES`,
`offsetPopGrammar` and `offsetPopRuleConformance`.

## Family scope and the overlay portal rule

A family paints only inside its root. Each family stylesheet is scoped to
`.grammar-common-root[data-grammar-family="<id>"]` inside its own cascade layer:
`starci-grammar-common` comes first, then `-core`, `-heritage` and `-offset-pop`. No family sheet
imports a sibling family's sheet. So two families can share a page, each inside its own root, and
nested roots resolve to the innermost one.

Overlays follow the same rule. `Dialog`, `AlertDialog`, `Drawer`, `Popover`, `DropdownMenu`, and
the list and calendar popovers of `Select`, `ComboBox`, `DatePicker` and `DateRangePicker` portal
into the **nearest** `.grammar-common-root`, not into `document.body`
(`resolveOverlayContainer`, `GRAMMAR_ROOT_SELECTOR`). Because of this, family selectors, tokens,
`data-grammar-theme` and the forced-colours mapping still reach the overlay surface. Two things
follow for apps:

- Render overlay triggers inside the family root. An overlay opened from outside every root falls
  back to `document.body` and loses the family styling.
- Mount one `<Toaster>` **inside** the family root, usually as the root's last child. Push toasts
  with `toastQueue.add({ title, tone, action, timeout })`, or give the Toaster its own
  `createToastQueue()`. A Toaster outside the root renders unstyled.

## Components

Each group below matches a Storybook group. Run `npm run storybook`: every story renders inside
the family and theme chosen in the toolbar. It shows the default, disabled, invalid, pending and
selected/current states where they apply. Overlay stories open by default.

**Primitives (25).** Avatar, Badge, Button, CloseButton, Divider, GrammarRoot, Heading, Icon,
IconButton, IconTile, Image, IncludedMark, Kbd, Label, LeadingNumber, Link, Meter, Progress,
ProgressCircle, RankArtwork, Skeleton, Spinner, StateMark, Text, TextAction.

**Forms (24).** ButtonGroup, Checkbox, CheckboxGroup, ComboBox, DateField, DatePicker,
DateRangePicker, Field, Fieldset, FileDropzone, Form, Input, NumberField, OtpInput,
PressableField, RadioGroup, Rating, SearchField, SegmentedControl, Select, Slider, Switch,
Textarea, TimeField. Every Field-contract control takes `label`, `description`, `errorMessage`,
`isRequired`, `isDisabled`, `isReadOnly` and `isInvalid`. `Select`, `ComboBox`, `SearchField` and
`Form` also take `isPending`. `OtpInput` has no label prop, so name it with a `<label for>`.

**Overlays (9).** Alert, AlertDialog, Dialog, Drawer, DropdownMenu, Popover, Toast, Toaster,
Tooltip. Dialog, AlertDialog, Drawer, Popover and DropdownMenu are controlled through
`isOpen`, `defaultOpen` and `onOpenChange`.

**Navigation & Data (14).** Accordion, AvatarGroup, Breadcrumbs, Calendar, DataTable,
DescriptionList, Disclosure, ListBox, Pagination, Stepper, Subnav, Tabs, TagGroup, Timeline.

**Surfaces (14).** EmptyNotice, FencedCodeBlock, HorizontalScrollRegion, MarkdownArticle,
MarkdownTableFrame, MediaFrame, Rail, SectionHeader, StaticStateRow, SurfaceAccordionCard,
SurfaceCard, SurfaceCopyGroup, SurfaceListCard, VerticalScrollRegion.

**Compositions (9).** BottomNav, ChatWorkspace, Footer, NavigationFeatureNav, PageContainer,
PrimaryRailLayout, Sidebar, TopBar, WorkspaceShell. Storybook also pins three page recipes to
each family: a settings form, a data list with a filter drawer and pagination, and a mobile home
with TopBar, BottomNav and a Toast.

`COMMON_GRAMMAR_COMPONENTS` is the frozen registry of all 95 renderers.
`COMMON_FORMS_COMPONENTS`, `COMMON_OVERLAYS_COMPONENTS` and `COMMON_NAVIGATION_COMPONENTS` are the
0.5.0 groups. `defineGrammarFamily` builds a new family over the registry. It may replace
renderers with prop-compatible versions and add extensions whose names don't collide with Common's.

## Theming

- **Tokens.** Each family writes its DNA as CSS custom properties on its root: `--starci-core-*`,
  `--heritage-*` or `--offset-pop-*`. It feeds those into the Common semantic variables that
  renderers read: `--accent`, `--accent-foreground`, `--focus`, `--background`, `--surface`,
  `--surface-secondary`, `--foreground`, `--muted`, `--border`, `--separator`, the status
  colours and their foregrounds, radii and shadow. Core also publishes a tertiary face under its own
  name, `--starci-surface-tertiary` (with `--starci-surface-tertiary-foreground`), fed by the knob
  `--starci-core-surface-tertiary`; HeroUI's `--surface-tertiary` is left to Common and is never
  re-bound by the family. To adjust a family, override its tokens on the
  root, for example `<CoreGrammarRoot style={{ "--starci-core-accent": "#2f6bff" }}>`. The
  `*_TOKEN_NAMES` / `*_TOKEN_DEFAULTS` exports are the supported list. Values are validated by the
  family specs, not at runtime.
- **Spacing.** Every family uses the Common 4px scale (`COMMON_SPACING_SCALE`,
  `COMMON_SPACING_TOKENS`), and Common's `--grammar-*-gap` / `--grammar-page-inset` variables.
- **Dark.** `theme` on any root takes `"light"`, `"dark"` or `"system"` (the default), which sets
  `data-grammar-theme`. `system` follows `prefers-color-scheme`. The dark palette is scoped to the
  root, so a dark island can sit inside a light page.
- **Forced colours.** Under `forced-colors: active` each family maps its surfaces, outlines,
  selection and focus onto system colours. Current and selected decisions remain visible through
  an edge or outline, not a fill.
- **Motion.** Under `prefers-reduced-motion: reduce`, Common's component anatomy drops its
  animations, and Offset Pop also removes its press travel and every other transform.
- **Structure.** One banner per page, owned by the app bar: `TopBar` / `NavigationFeatureNav`
  in `WorkspaceShell`'s `header` slot makes the shell's wrapper a plain `div`
  (`headerLandmark="slot"`, automatic for those two; pass it for an app-owned `<header>`), and
  `SectionHeader` is never a `<header>`. Surface names (`SurfaceCard`, `SurfaceListCard`,
  `SurfaceAccordionCard`) default to `h3`; pass `headingLevel` (2-6) so the outline never skips a
  level. `SurfaceListCard`'s collection is the list (`<ul>`, or `role="list"` when scrolling), so
  its rows are `<li>`; use `empty` for an empty-state notice. Every scroll owner that holds
  non-focusable content (scroll regions, the Rail body, code and table frames) is a named
  `tabIndex=0` region. A fixed `BottomNav` publishes `--starci-core-bottom-nav-offset`, which the
  outermost page container (or the Footer) and a bottom Toaster read.
- **States.** `PRESENTATION_STATES` (`neutral`, `informative`, `affirmative`, `cautionary`,
  `negative`, `pending`, `unavailable`) is the render-neutral state vocabulary. Components stamp
  it as `data-grammar-*` hooks for family CSS.

## Package checks

```sh
npm run typecheck
npm test                 # build + node --test + vitest spec list
npm run build-storybook  # static Storybook (all 95 renderers + family pages)
npx vitest run --project storybook   # stories in Chromium with axe (a11y `todo` mode)
npm pack --dry-run
```

## Contributing

`dist/` is build output and is not tracked in git. Every consumer inside this repository reads it:
the `file:` apps link this directory, the brand check reads the exported CSS, and the grammar guard
probe executes the built modules. A merge that changes `src/` does not change `dist/`, so a checkout
can hold an old build that still looks valid.

**Build stamp.** `npm run build` ends with `scripts/build-stamp.mjs`, which writes
`dist/.build-stamp.json`: the package version, a digest of the source (everything under `src/`
except stories, test helpers, specs and tests, plus `tsconfig.build.json`, `scripts/copy-css.mjs`
and the `exports` and `files` fields of `package.json`), a digest of the built files, and the build
time. The stamp ships in the tarball.

**Freshness check.** The root `npm run check` runs `scripts/checks/grammar-dist.mjs`. It fails when
`dist/` is missing, has no stamp, was built from other source or another version, or was edited
after the build. It also compares every `--*` custom property in each family's dist CSS with the
source CSS, so a hand-edited token fails too. The brand check (`scripts/checks/brand.mjs`) and the
grammar guard probe (`scripts/checks/code-patterns/grammar-guards.mjs`) run the same test before
they read a grammar dist, and refuse a dist that fails it. Every refusal ends with the same fix:
`run npm run build in packages/grammar`. A registry install carries no `src/`, so it cannot be
compared. It is reported as `unverifiable` and allowed, but if it carries a stamp, the version and
built-file digest must still match.

**Why there is no `prepare` script.** npm 11.6.2 installs a `file:` dependency as a symlink
(a junction on Windows) to this directory. On every consumer `npm install` or `npm ci` it runs this
package's `prepare` in place, but it does not install this package's devDependencies there. A
`prepare: npm run build` would therefore fail the consumer's install (`tsc` not found) wherever
`packages/grammar/node_modules` is absent. Where it is present, the script would wipe and rebuild
the shared `dist/` on every consumer install. Git dependencies are not a way in either: npm parses
the `#…::path:packages/grammar` suffix, but pacote ignores it, so a git dependency cannot select
this subdirectory. A linking consumer builds on purpose, as `starci-academy-fe`'s own `prepare` does
with `npm run grammar:build`. After pulling a grammar change, run `npm run build` here. Publishing is
unaffected: `prepack` runs `typecheck` and `test`, and `test` builds first, so a tarball always
carries a fresh stamp.

**Why `dist/` stays untracked.** Every consumer that reads it can build it, from this directory or
through a script that calls this one. A tracked `dist/` would need a rebuild in every source commit,
would conflict in every merge that touches `src/`, and would make a stale build look authoritative
in git history. The stamp and the check catch what tracking would have hidden.

## Changelog: 0.5.0

A minor release. Common grows from 42 to 95 renderers, and Offset Pop reaches parity with Core.

- **53 new Common renderers.** Core, Heritage and Offset Pop all receive them. They are built on
  HeroUI v3 / React Aria, and each ships Common anatomy CSS and a spec that renders it under bare
  Common, Core and Offset Pop.
  - Forms (20): Field, Fieldset, Form, Textarea, Select, ComboBox, SearchField, NumberField,
    Checkbox, CheckboxGroup, RadioGroup, Switch, Slider, SegmentedControl, DateField, DatePicker,
    DateRangePicker, TimeField, FileDropzone, ButtonGroup. They share one Field contract and one
    44px touch floor.
  - Overlays and feedback (14): Dialog, AlertDialog, Drawer (side, and bottom sheet with a handle),
    Popover, DropdownMenu (sections, submenus, checkable items, shortcuts), Toast and Toaster
    (queue, tones, action, pause on hover and focus, persistent live regions), Alert, Spinner,
    Skeleton, ProgressCircle, Meter, CloseButton, Kbd.
  - Navigation, chrome and data (19): Link, Breadcrumbs, Pagination, Stepper, TopBar, BottomNav,
    Footer, Avatar, AvatarGroup, TagGroup, DataTable, DescriptionList, ListBox, Disclosure,
    Accordion, Image, Rating, Timeline, Calendar.
- **Scoped overlay portals.** Overlays portal into the nearest Grammar root, so family styling
  applies to open surfaces (see the portal rule above).
- **Offset Pop at Core parity.**
  - `src/offset-pop/dna.ts` mirrors Core's DNA key for key, plus the `offset` and `palette` groups.
  - A full light, dark, system-dark and forced-colours token set feeds every Common semantic
    variable.
  - Accent text is text-safe: `accentText` is `#b8005f` light and `#ff7ab8` dark. Accent, danger
    and state foregrounds use ink so they pass WCAG AA.
  - Error text mixes the critical colour with ink, reaching at least 5.05:1.
- **Offset Pop component treatment.**
  - `offset-pop/components-{forms,overlays,navigation}.css` adds the ink outline, hard offset
    shadow, pink selection and reduced-motion and forced-colours fallbacks.
  - Interactive rows (ListBox, Select and ComboBox options, selectable DataTable rows) get a
    yellow hover wash, a 2px pink focus ring and a soft-pink selected fill with a pink leading
    edge.
  - Rows are separated by a single seam. Dark-mode selected and current states are fixed.
- **Conformance.** `offsetPopRuleConformance` audits the family's own rules against their CSS
  mechanisms and inherits the rest. The package boundary checks the per-family dist modules,
  checks that no family imports another, and checks that the component CSS is in `dist`.
- **Core.** Subnav's menu toggle meets a 44px touch floor on coarse pointers and narrow viewports.
- **Build.** `scripts/copy-css.mjs` copies every `*.css` file in each entry directory.
  `@internationalized/date` is a dev dependency, used for date values in specs and stories.
- **Storybook.** The toolbar switches the family (Common, Core, Heritage, Offset Pop) and the
  theme (light, dark, system). There are stories for all 95 renderers and three page recipes per
  family. The starter boilerplate is removed.
