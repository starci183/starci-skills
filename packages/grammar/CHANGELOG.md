# Changelog

## 0.8.0 - 2026-10-01

Minor, additive (lane FONT; owner: the brand layer must be able to set the brand typeface).

- **Font tokens.** The grammar now reads `--font-sans` (the core family root's `font-family`) and `--font-mono` (the leading-number
  and the code/monospace surfaces), each with a system-font fallback, so an app's brand layer sets its typeface on `:root` (and
  `.dark`) with one token and every component follows. Nothing is re-declared on the family root, so a brand value on `:root` wins.
- **Removed `--starci-font-sans` and `--starci-font-mono`** (host-set names no product declared; superseded by the two tokens
  above, no alias kept). The heritage family keeps `--heritage-sans`/`--heritage-display` (its own namespace).

## 0.7.2 - 2026-09-30

Patch, additive (nivo-fe wave, lane F0; owner approved publishing @starci packages).

- `Input` gains `kind="tel"`: `type="tel"`, `inputMode="tel"`, `autoComplete="tel"`, so a phone field opens the phone keypad and
  offers the saved number (the expert lead form lost both when it moved to the grammar).
- `IconButton` takes the ARIA disclosure props, typed: `aria-controls?: string` and `aria-expanded?: boolean`, forwarded to the
  button only when set. There is no open `...rest`: no other attribute passes through.

## 0.7.1 - 2026-09-30

Test-suite policy only (owner decision 2026-09-30, follow HeroUI): the contrast pairs for a status soft pair (`--<tone>-soft-foreground` on `--<tone>-soft`), the Alert title and a bare status glyph or title on a ground are held to `SOFT_MIN` = 3:1 instead of 4.5:1. Body text, descriptions and interactive text keep 4.5:1. No shipped CSS or API changed.

## 0.7.0 - 2026-09-28

Additive (minor), plus one fix (owner, 2026-09-28, StarCi Next `SignInBase#signed-out`). Owner approved the publish.

- Fix: `SurfaceCard` `measure="form"` / `"formCompact"` now caps the card. The root's `width: 100% !important`
  (`.starci-core-surface-card`) beat the form surface's `min(100%, 30rem)`, so a form card stretched across the whole
  content region (the sign-in card rendered 1116px wide at a 1184px viewport). `.starci-core-surface-card
  .starci-core-form-surface` re-states the measure `!important` and centres the capped card (`margin-inline: auto`,
  knowledge MEASURE-4 case-3).
- Every form control whose HeroUI v3 anatomy has the layer variant takes `variant?: "primary" | "secondary"`
  (default `primary`), passed through to HeroUI: `Checkbox`, `CheckboxGroup` (and its options), `RadioGroup`,
  `Textarea`, `Select`, `SearchField`, `NumberField`, `DateField`, `TimeField`, `DatePicker`, `DateRangePicker`,
  `ComboBox` - `Input` already had it. `secondary` is the nested treatment for a control ON a surface (knowledge
  ANATOMY-2 case-1: page background -> Surface -> nested control). Each control root, `Input` included, stamps
  `data-grammar-variant`, which the draw gate `DRAW_NESTED_VARIANT` reads. `Switch`, `Slider` and a single `Radio`
  have no vendor variant. Exported `FieldVariant`, `fieldVariantAttributes`.

## 0.6.0 - 2026-09-27

Additive (minor). Owner ruling 2026-09-27 ("add all of it"): every grammar gap the real-component prototype
(`ModuleLedgerBase.draw.tsx`, lane draw-real-components) had to work around is now a grammar piece. No existing
prop, default, class or token changed meaning; one renderer is new; 28 renderers gain root attributes.

- `SurfaceCard` `treatment?: "surface" | "ink"` (exported `SurfaceCardTreatment`, default `surface`). `ink` is the
  one signature band painted on the family's brand ink: Common reads `--accent` (a product whose accent is its ink,
  e.g. Nivo `#040d1c`, gets that exact ink); Offset Pop re-binds it to its ink and canvas (the pink stays the
  decision accent) and Heritage keeps it over its paper surface. The band re-binds `--foreground`, `--muted`,
  `--separator`, `--border`, `--default` and the soft tone foregrounds on itself (new Common tokens
  `--grammar-ink-band`, `--grammar-ink-band-foreground`, `-muted`, `-separator`, `-plate`, `-orbit`), so
  SectionHeader, Text, IconTile, Badge, DescriptionList and Divider keep their anatomy and stay AA on any accent:
  the foreground is read from the ink's own lightness (white below 0.62, black above; a family's
  accent-foreground is only promised for button-size text), muted is the ink lifted to at least 80% lightness on a
  dark ink (about 10:1 on `#040d1c`; on Core's mid-tone violet it resolves to the foreground) or lowered to at most
  32% on a light one, hairline / plate / orbit step 14 / 8 / 16 points toward the foreground, and a status text is
  8% of its tone in the foreground (the Badge dot and soft fill carry the hue). An ink band is always a bounded
  shell (`frame="frameless"` is ignored).
  - `artwork?: ReactNode` (ink only): a decorative zone - `aria-hidden`, no pointer - holding the art (an `Image`
    or `MediaFrame` with its asset slot) on a transparent ground. Band 48rem and wider (container query): 22.5rem x
    15rem at the top inline-end corner, bleeding 2.25rem off the inline-end and 2.75rem off the top edge (clipped),
    and the head face (or the single content region) keeps a 12.25rem minimum block size so the content below
    starts clear of it. Narrower: 11.25rem x 7.5rem in flow at the head (the mascot minimum 180 x 120), bleeding
    2.5rem off the inline-end edge; content follows it, so the art never covers text.
  - `motif?: "none" | "orbit"` (ink only, exported `SurfaceCardMotif`): three thin concentric rings and five small
    nodes, one static `aria-hidden` SVG in the artwork zone only (never behind body copy), in the band's orbit ink
    (the ink lifted 16 points); it never animates, and forced colours drop it.
  - Hooks `data-grammar-surface-treatment` (root and surface), `data-grammar-surface-artwork="art|motif|none"`,
    `data-grammar-surface-motif`; classes `starci-core-surface-artwork`, `starci-core-surface-orbit`.
- `Divider` without a `label`: the unlabelled hairline between touching bands (GAP-0 case-1) - a 1px
  `--separator` `border-block-start` across its container, no margin (BOUNDARY-1), class
  `starci-core-divider-bare`, hook `data-grammar-divider="bare"`. `semantics?: "separator" | "presentation"`
  (exported `DividerSemantics`, default `separator`): `role="separator"` + `aria-orientation="horizontal"`, or
  `role="presentation"` + `aria-hidden` for a purely visual seam between faces that carry their own headings.
  The labelled Divider is unchanged (it gains the hook `data-grammar-divider="labelled"`).
- `DescriptionList` `layout: "stat-strip"` (exported `DescriptionListLayout`) with items
  `DescriptionListStatItem` (`icon?: IconSource`, `unit?: ReactNode`, `meta?: ReactNode`): key figures as one
  real `<dl>` - `<dt>` a neutral sm `IconTile` + the label, `<dd>` the figure (FONT-5 30/36, 600,
  `tabular-nums`) with its unit, a second `<dd>` the meta. Below 48rem a 2 x 2 grid 1.5rem apart; at 48rem and
  wider one row of equal cells, divided by a 1px `--separator` inline-start hairline with 0.75rem each side
  (PADDING-3 case-4). Label, unit and meta are FONT-2 muted at 400, so the strip speaks three sizes and two
  weights (TASTE-6). Offset Pop re-inks the hairline in its outline.
- `AlertAction.icon?: IconSource`: a leading `Icon` (`usage="leading"`, decorative) as the action Button's
  `startContent`. The tone -> variant mapping of 0.5.3 is unchanged.
- `Image` and `MediaFrame` take `assetSlot?`, `assetSha256?`, `assetPrompt?` (exported `AssetSlotProps`), emitted
  verbatim on the root as `data-asset-slot`, `data-asset-sha256`, `data-asset-prompt`; unset, nothing is emitted.
  Paint is unchanged.
- `SectionHeader` `count?: number` - a muted "(n)" at weight 400 in the title's own line, part of the heading's
  accessible name (class `starci-core-section-count`, hook `data-grammar-section-count`) - and `meta?: ReactNode`,
  the section's source time, FONT-1 muted at the end of the header row before any `action`
  (class `starci-core-section-meta`).
- `TagGroupItem.isOff?: boolean` and `offLabel?: string`: an off chip is HeroUI's tertiary (transparent) chip with
  a 1px `--border` outline and the muted foreground (`!important` over the vendor `.tag--default` paint; a dashed
  `GrayText` outline under forced colours), still focusable - unlike `isDisabled`. `offLabel` is appended to the
  accessible name as visually hidden text (and to the row's text value); omit it when the visible label already
  says the chip is off. Hook `data-grammar-tag-state="on|off"`.
- `IconButton` `variant?: "tertiary" | "ghost"` (exported `IconButtonVariant`, default `tertiary`): HeroUI's
  `ghost` is the quiet bare glyph for an overflow "..." menu. Hook `data-variant`.
- New renderer `PinnedActionBar` (`label`, `children`, `visibility?: "narrow" | "always"`, default `narrow`;
  exported `PinnedActionBarProps`, `PinnedActionBarVisibility`): the page's one command pinned to the bottom edge
  in thumb reach (UX-9 case-1) - `role="group"` named by `label`, sticky at the bottom, `--surface` ground behind a
  1px `--separator` top hairline (BOUNDARY-1), inset 0.75rem / 1rem / 1rem plus `env(safe-area-inset-bottom)`;
  `narrow` hides it at 48rem and wider so the command shows once per viewport (LAYOUT-4 case-2). Class
  `starci-core-pinned-action-bar`. The registry holds 96 renderers (43 base).
- Every registry renderer names itself in the DOM: `data-component="<Name>"` and a `data-tier` on its root. The 28
  that emitted none now do (draw-render had to map 15 of them by hook) - PageContainer, SectionHeader, SurfaceCard, SurfaceListCard, SurfaceAccordionCard,
  MediaFrame, SurfaceCopyGroup, RankArtwork, Label, IncludedMark, GrammarRoot, HorizontalScrollRegion,
  VerticalScrollRegion, StaticStateRow, Rail, Subnav, Tabs, Tooltip, MarkdownArticle, FencedCodeBlock,
  MarkdownTableFrame, PrimaryRailLayout, NavigationFeatureNav, WorkspaceShell, ChatWorkspace, StateMark,
  LeadingNumber and OtpInput (tiers atom / composite / branch / composition by their storage tier). A caller's own
  `data-component` still wins on HorizontalScrollRegion and VerticalScrollRegion (OtpInput uses that).

### Tests

- `src/core/branch/SurfaceCard/index.spec.tsx`: under every Grammar root, the ink hooks, the forced bounded shell,
  one `aria-hidden` artwork zone before (never around) the content, a static orbit (3 rings, nodes, no SMIL), and no
  zone on a plain surface or a bare ink band. `ink.spec.ts`: every text ink the band re-binds clears 4.5:1 on Core's
  violet accent, an ink accent (`#040d1c`), HeroUI's blue, a light accent, a mid-tone at the light/dark switch and
  Offset Pop's ink in light and dark; the orbit and hairline sit
  between the ground and the muted ink; the shipped geometry (container, isolation, content above the zone, zone
  boxes at both widths) and no animation on the zone.
- `Divider`, `DescriptionList`, `Alert`, `Image` (+ `MediaFrame`), `SectionHeader`, `TagGroup`, `IconButton` specs
  cover each addition's render, ARIA and shipped CSS; `src/core/primitive/PinnedActionBar/index.spec.tsx` covers
  the new renderer; `src/core/data-component.spec.tsx` proves every registry renderer's module stamps
  `data-component` and a valid `data-tier`, and renders the formerly silent ones.
- Offset Pop: the render tables (`family.spec.tsx`, `shipped-claims.spec.tsx`) include PinnedActionBar and the ink
  band; the family sheet writes no `--starci-core-*` name. `src/__test__/contrast.ts` reads relative-colour channel
  arithmetic (`calc(l + 0.14)`, `max(0.8, calc(l + 0.5))`, `clamp(...)`). Heritage paints the ink band over its
  paper surface; the Storybook a11y matrix (every family, light / dark / system) passes the ink band story.
- Stories: `Surfaces` SurfaceCard "Ink band ..." and SectionHeader "Count and trailing source meta", MediaFrame
  "Asset slot"; `Primitives` Divider "Unlabelled hairline", IconButton "Quiet (ghost)", Image "Asset slot";
  `NavigationData` DescriptionList "Stat strip", TagGroup "Off chip"; `Overlays` Alert "Action with a start icon";
  `Compositions` PinnedActionBar. The catalog guard lists 96 renderers.

## 0.5.4 - 2026-09-27

Visual change for Alert and SectionHeader; no API change. Owner rulings 2026-09-27 (alert-white-surface; draw with the
real grammar components, lane draw-real-components): a drawing now renders the real components in the product CSS, and
the draw gates measured two places where Grammar painted over HeroUI or off the type scale.

- `Alert` is the HeroUI Alert exactly (`@heroui/styles` `alert.css`): a white `bg-surface` row with `shadow-surface`,
  `px-4 py-3`, radius `min(32px, --radius-3xl)`, the indicator (`p-1`, a `size-4` glyph) and the title in the tone's
  soft-foreground, a muted description. Grammar's common sheet no longer paints a tone tint, a tone border, a 12px
  radius, a 20px indicator or an overlay-tone indicator colour over it; it only lets the row wrap at a narrow width so
  the action stays inside the surface. Forced colours keep their CanvasText border.
- `SectionHeader` title follows the type scale (knowledge/ui/presentation/font.yaml): FONT-4 20px/28px for `level` 1,
  FONT-3 16px/24px for levels 2-6, weight 600 (was `clamp(1.25rem, 1rem + 0.75cqi, 1.75rem)` / 700 / -0.025em); the
  eyebrow weight is 600 (was 700); the header wraps its action below the copy when the copy would fall under 20rem.
- No export, prop, class, token or hook moved.

## 0.5.3 - 2026-09-27

Behaviour change for Alert actions, additive for Button and Badge. Owner ruling 2026-09-27: follow HeroUI v3
exactly - its Alert examples put a `primary` Button ("Refresh") in an accent Alert and a `danger` Button
("Retry") in a danger Alert, and its Button variants (`@heroui/styles` `button.css`) are primary,
secondary, tertiary, outline, ghost, danger and danger-soft.

- `Button` gains HeroUI's `danger` and `danger-soft` variants (`ButtonVariant` adds `"danger" |
  "danger-soft"`), mapped one to one onto the vendor `button--danger` / `button--danger-soft`, on both
  the command (`<button>`) and destination (`<a>`) elements. No tone prop; the default stays `secondary`.
- `Alert`'s action Button variant follows the tone through the vendor status (`vendorStatusFor`):
  `informative` (accent) -> `primary`, `negative` (danger) -> `danger`, every other tone (affirmative,
  cautionary, neutral, pending, unavailable) -> `secondary` - HeroUI has no success or warning Button
  variant. Before 0.5.3 every Alert action was `secondary`; an informative or negative Alert with an
  `action` now renders a filled primary or danger Button. Size stays `sm`.
- Offset Pop: its pink decision accent on alert actions yields to Common's danger fill for a negative
  Alert (the same treatment its negative confirm action already had); other tones keep the pink.
- `Badge` takes `isDot?: boolean` (owner ruling 2026-09-27: status badges get their dot through the
  grammar, never hand-drawn CSS). True draws HeroUI's Chip dot - `<CircleFill width={6} />` - before the
  label: one 6px solid circle in `currentColor` (the badge's tone foreground), `aria-hidden`, class
  `starci-core-badge-dot` (6px box, `flex: none`, in `src/common/styles.css`), hook
  `data-grammar-badge-dot="true"` on the root. No halo, ring or size variant; skeleton draws no dot.
  Upstream Heroicons has no filled circle, so `CircleFill` is a Grammar-internal geometric glyph cut like
  the `@starci/heroicons` 16/solid customs (16 x 16 viewBox, `fill="currentColor"`, `data-slot="icon"`);
  it is not exported. In Offset Pop the dot follows that family's ink badge text.
- No class, token, hook or default of any other component moved.

### Tests

- `src/core/primitive/Button/index.spec.tsx`: `danger` / `danger-soft` render the vendor class (and not
  `button--secondary`) on the button and the anchor.
- `src/core/composite/Alert/index.spec.tsx`: under every Grammar root, the action Button carries the
  vendor class for every tone (informative primary, negative danger, the other five secondary) and no
  other variant class.
- `src/offset-pop/components-overlays.spec.ts`: the negative Alert action keeps the danger fill.
- `src/core/primitive/Badge/index.spec.tsx`: `isDot` renders exactly one leading `aria-hidden` 6px
  `currentColor` circle (and the root hook); none when `isDot` is false/omitted or while skeleton.
- Stories: `Primitives` `Button` shows Danger / Danger soft, `Badge` a "Status dot (isDot)" state;
  `Overlays` `Alert` shows the action variant per tone.

## 0.5.2 - 2026-09-27

Additive. `Meter` can draw a discrete count ("3 of 3", "2 of 3 capabilities") as equal segments: the
draw-time grammar proposal `Meter.segments`, accepted by the owner on 2026-09-27.

- `Meter` takes `segments?: MeterSegments`, a closed literal range `2 | 3 | ... | 12` (exported as
  `MeterSegments`). Untyped callers are clamped to 2..12. Without the prop nothing changes.
- Segmented, the reading is a whole count: `value`, `minValue` and `maxValue` are rounded to integers
  and the value clamped into range; `round((value - min) / (max - min) * segments)` segments fill.
- The track spans the full width of its container, the same length as a Progress track, at HeroUI's
  h-1 (0.25rem, 4px; owner ruling 2026-09-27 - the plain meter keeps h-2), laid out as N equal pill
  segments 0.25rem apart. Empty segments wear the track colour, filled
  ones the tone fill (`--starci-core-overlay-tone`: accent for neutral/pending, the tone colour
  otherwise). The continuous `meter-fill` is not rendered in this mode.
- Accessibility is unchanged: one `role="meter"` with `aria-valuenow` / `aria-valuemin` /
  `aria-valuemax` / `aria-valuetext`; the segments are `aria-hidden` spans with no role.
- New classes `starci-core-meter-segments` (on the vendor track) and `starci-core-meter-segment`,
  painted in `src/common/components-overlays.css`. The vendor track's `display`, `overflow`,
  `height` and `background` are re-cut with `!important` (the vendor `components` layer is declared after
  `starci-grammar-common`); forced colours draw empty segments as outlined `Canvas`, filled as
  `CanvasText`. New hooks `data-grammar-meter-segments` (root, the count) and
  `data-grammar-meter-segment="filled|empty"` (each segment).
- Offset Pop treats the segmented track through those hooks: the 4px line is too thin for its ink
  outline, so the track drops it and empty segments take the ink at 18%; filled segments are the
  family tone colour (the pink accent for neutral, a real measurement under ACCENT-1).
- No existing class, token, prop or default moved.

### Tests

- `src/core/primitive/Meter/index.spec.tsx`: under every Grammar root, a segmented meter is ONE
  `role="meter"` with the reading on `aria-value*`, N `aria-hidden` segments with the filled/empty
  split, full and empty extremes, integer rounding/clamping of the value and 2..12 clamping of the
  count; under the shipped overlay sheet (lifted out of its layer for jsdom) the track computes
  display flex, 4px (h-1) height, 0.25rem gap, transparent background, and each segment 100% height,
  flex 1 1 0 and the track's non-zero corner.
- `src/offset-pop/conformance.spec.ts`: ACCENT-1's decision list names the filled meter segment.
- `Primitives.stories.tsx` `Meter` gains a "Segmented count" state (3 of 3, 2 of 3, 5 of 8).

## 0.5.1 - 2026-09-25

Additive. Core gains the tertiary surface role the StarCi Academy render paints (a raised band on the
secondary surface).

- `STARCI_CORE_DNA.color.light.surfaceTertiary` = `oklch(93.73% 0.0012 354.13)` and
  `color.dark.surfaceTertiary` = `oklch(27.21% 0.0023 354.13)`, published through
  `STARCI_CORE_TOKEN_NAMES.surfaceTertiary` (`--starci-core-surface-tertiary`) and both token-default
  maps; the forced-colours block maps it to `Canvas`.
- The Core root binds `--starci-surface-tertiary` and `--starci-surface-tertiary-foreground` to it.
  HeroUI's `--surface-tertiary` is not re-bound: it stays Common's derived mix, so products that bind
  their own tertiary face never restyle vendor anatomy.
- Offset Pop does not mirror the role: it is a StarCi brand token and Common never reads it. The
  Offset Pop parity spec names it Core-only and no longer reads declarations out of CSS comments.
- No renderer, class or prop changed; no existing token moved.

## 0.4.13

Fix only. A live audit measured the conversation region of `ChatWorkspace` - the node stamped
`MEASURE-7 OVERFLOW-3` and named "Setup message" - rendering `overflow: auto auto` on every
capture. OVERFLOW-3 promises one scrolling axis and a second axis left clipped or visible on purpose;
both axes scrolled. This is the defect 0.4.11 repaired on `HorizontalScrollRegion`, on the sibling
region nobody had measured yet.

### The vertical region owns its overflow answer, and one axis

- Nothing in the family's sheet named `overflow-x` for this region. The vendor's
  `.scroll-shadow--vertical` sets `overflow-y: auto` alone, and every host class the region wears -
  `.starci-core-chat-workspace-conversation`, `.starci-core-chat-workspace-overlay-rail`,
  `.starci-core-accordion-scroll-region`, `.starci-core-form-scroll-viewport` - names that same one
  axis or names none at all. Per CSS a non-visible overflow on one axis forces the other from
  `visible` to `auto`, so the region rendered two scrolling axes under a one-axis claim.
- `src/common/styles.css` now declares `overflow-x: hidden; overflow-y: auto` on
  `[data-grammar-scroll-region="vertical"]`, the identity `VerticalScrollRegion` stamps on the
  scrollable branch. No `!important`: no host class and no vendor rule ever names `overflow-x`, so
  the declaration is unopposed whichever order a consumer imports the two sheets in.
- `VerticalScrollRegion` takes an `overflow?: "always" | "needed"` prop (default `"always"`), stamps
  `data-grammar-overflow` beside `data-grammar-scroll-region="vertical"`, and claims
  `MEASURE-7 OVERFLOW-3` or `MEASURE-7 OVERFLOW-4` accordingly - the shape `HorizontalScrollRegion`
  already has. `ChatWorkspace` asks for nothing, so its conversation, its inline rail and its overlay
  rail keep claiming `MEASURE-7 OVERFLOW-3`, as does every other host. A `data-contract` a caller
  passes in is still replaced by the region's own: one claim per node, and the node's own claim.
- No class, no markup, no JSX and no consumer prop changed. The non-scrollable branch is untouched.

### Tests

- `src/core/scrollable-surfaces.spec.tsx` gains the stamp-versus-render case the sibling region
  already had: the rendered node carries `data-grammar-scroll-region="vertical"` and
  `data-grammar-overflow="always"` under the single axis claim `OVERFLOW-3`, the shipped sheet
  declares both `overflow-y: auto` and `overflow-x: hidden` for that identity, and `overflow="needed"`
  moves the stamp and the claim together to `OVERFLOW-4`.
- `src/core/composition/ChatWorkspace/index.spec.tsx` measures the repair where the audit measured
  the defect: it renders the workspace under the shipped sheet in jsdom and reads the conversation
  region's COMPUTED overflow per axis, not the class list. Both axes are measured because a sheet
  that names one renders two - reading `overflow-y` alone would have called the old render correct.
  Without the repair the inline axis measures `visible`.
- The repository has no story for this component, so no story was updated. `SurfaceAccordionCard`'s
  own frameless double stamp stays out of scope and unchanged, and no consumer changed.

## 0.4.12

Fix only. A live audit measured a `Heading` stamped `FONT-4` rendering 36px and one stamped `FONT-3`
rendering 30px, where 0.4.9 rendered the same nodes at 20px and 16px - with `Heading/index.tsx`
unchanged between those versions. The component was never the defect. The family had no sheet behind
its own type scale.

### The FONT scale is the family's, so the family's sheet draws it

- `Heading` renders through the vendor's `Typography.Heading`, which adds `typography--h<level>`, and
  the vendor's sheet sizes those in its `components` layer. Against that the family fielded only the
  Tailwind utility classes on the component - `text-xl`, `text-base`, `text-sm`, `text-xs`,
  `text-4xl` - and a utility class exists only where the CONSUMER's Tailwind build scanned this
  package's dist. In the audited consumer that scan stopped finding the package after it was hoisted,
  the utilities vanished, and the vendor's sizes won under the family's stamps.
- `src/common/styles.css` now draws the scale itself, off the attributes `Heading` already stamps
  (`data-component`, `data-level`, `data-scale`): FONT-4 1.25rem/1.75rem, FONT-3 1rem/1.5rem, FONT-2
  0.875rem/1.25rem, FONT-1 0.75rem/1rem and FONT-6 2.25rem/1.25, with the recipe's weight and the
  `tracking-tight` that `font.md` gives FONT-4 and FONT-6 alone. This is what `.starci-core-text` has
  always done for its own sizes, and what `shipped-geometry.spec.ts` already demands of layout: a
  shipped object may not spell itself in classes only a consumer's build can create.
- `!important` on the standard levels, because a consumer may import this sheet before or after
  `@heroui/styles` and layer rank alone cannot decide the winner in both orders. The values re-state
  what the utilities carry, so where a scan still finds the package nothing moves. Only FONT-6's SIZE
  is important: `offset-pop` re-cuts the display row with its own weight, tracking and 0.96 line
  height, so display rhythm stays a normal declaration that a later family layer still owns.
- No class, no markup, no JSX and no component prop changed. `Heading/index.tsx` is untouched.

### The paired regression measures the render, not the class list

- `src/core/primitive/Heading/index.spec.tsx` renders every level and the display scale under the
  shipped sheet in jsdom, reads the `data-contract` off the node, and measures the computed size
  against the rank that stamp claims. jsdom's cascade skips rules inside an `@layer` block, so the
  spec lifts the sheet's rules out of their layer before measuring - the declarations it measures are
  the shipped ones. Without the repair the nodes measure UA defaults (32px under `FONT-4`).

## 0.4.11

Fix only. A live audit measured three of the family's own nodes stamping a `data-contract` the same
node's render contradicts. Every one of them is Core's render and Core's stamp, so every one of them
is repaired here rather than explained to a consumer.

### One node, one overflow answer

- `SurfaceCard`'s content node claimed `OVERFLOW-1 OVERFLOW-2` under `frame="frameless"` - "this
  surface does not clip" and "this surface clips" on one element. The shipped sheet paints
  `overflow: visible` on `.starci-core-surface.starci-core-frameless-surface` and `overflow: hidden`
  on `.starci-core-surface`, so the node now claims `OVERFLOW-1` alone when frameless and
  `OVERFLOW-2` alone when bounded. No class, no markup and no paint changed.

### A frameless surface takes no inset, and now says so

- The frameless card's body claimed `PADDING-4` (1rem) and rendered 0px on every side, because
  `.starci-core-frameless-surface > .starci-core-surface-content` sets `padding: 0`.
- The ruling is the family's own canon, not a convenience: `frame="frameless"` means the content
  already owns its visible boundaries, so Core must not draw another shell - and the shipped sheet
  drops the inset together with the frame. `PADDING-0` is how this family answers "no inset"
  everywhere else, on this same body under `composition="joined"`, on `SurfaceListCard`'s root and on
  `SurfaceAccordionCard`'s panel. So the frameless body claims `PADDING-0`; `joined` keeps
  `GAP-0 PADDING-0` and the bounded single body keeps `PADDING-4`. The render (0) is unchanged - only
  the promise moved to meet it.

### The scroll region owns its overflow answer, and one axis

- `HorizontalScrollRegion` stamps its own `data-contract`, so a `data-contract` a caller passed in was
  silently replaced and never reached the DOM - `Tabs` passed `OVERFLOW-4` and the strip rendered
  `OVERFLOW-3`. The region now takes an `overflow?: "always" | "needed"` prop (default `"always"`),
  stamps `data-grammar-overflow`, and claims `PADDING-1 MEASURE-3 OVERFLOW-3 OVERFLOW-5` or
  `PADDING-1 MEASURE-3 OVERFLOW-4 OVERFLOW-5` accordingly. `Tabs` asks for `overflow="needed"`.
- `.starci-core-horizontal-scroll-region` now declares `overflow-x: auto; overflow-y: hidden`. The
  vendor's `.scroll-shadow--horizontal` sets `overflow-x: auto` alone, and a computed `overflow-x:
  auto` forces `overflow-y` to `auto` too, so the node rendered `overflow: auto auto` - two scrolling
  axes under a claim that promises one.

### Tests

- `src/core/scrollable-surfaces.spec.tsx` gains three stamp-versus-render cases that read the stamp
  off the rendered markup and the declaration out of the shipped sheet: one overflow id on the
  frameless and bounded content nodes, `PADDING-0` on the frameless body against the sheet's
  `padding: 0`, and the region's single axis claim against `overflow-x`/`overflow-y`.
- `src/core/branch/Tabs/index.spec.tsx` gains a case that the real rendered strip claims `OVERFLOW-4`,
  not `OVERFLOW-3`, and carries `data-grammar-overflow="needed"`.
- No consumer changes. `SurfaceAccordionCard`'s own frameless double stamp and `OtpInput`'s claim are
  out of this fix's scope and unchanged.


## 0.4.9

Fix Core `Tabs` external panel relationships after the underlying collection mounts or updates.

- A `panelId` callback now remains authoritative on initial render, pointer/keyboard selection,
  and collection changes, including stable callbacks. Tabs keep their existing focus and selection behavior.
- The adapter preserves the vendor relationship it actually observes and restores it when `panelId`
  is removed. Cleanup disconnects observation; unchanged attributes are not rewritten.
- Regression tests render real external panels with the real HeroUI collection and cover initial
  linkage, selection, changed/removed callbacks, collection replacement, multiple instances and cleanup.
- No public API, presentation, dependency or consumer changes.


## 0.4.8

Fix only. A live audit found `SectionHeader` stamping `data-contract="GAP-5"` on its root while the
narrow `@container starci-core-primary-rail (max-width: 32rem)` collapse rule hard-coded `gap: 0.75rem`
underneath it - true at the default width, false the moment the header's own container collapses.

### The collapsed header keeps the region gap instead of inventing a tighter one

- `.starci-core-section-header`'s narrow-container rule now sets `gap: var(--starci-core-region-gap,
  1.5rem)` instead of the literal `0.75rem`. The direction and alignment still change (`flex-direction:
  column; align-items: flex-start`) - only the gap value was wrong.
- The family already answers this question twice: `PrimaryRailLayout` and `WorkspaceShell` are the
  other two GAP-5 region roots, and both hold `var(--starci-core-region-gap)` across every collapse
  tier they define - only the grid columns/areas change underneath them, never the gap. A collapsed
  `SectionHeader` follows the same law: stacking to a column is a reading-order change, not a demotion
  from a region boundary to a tighter internal rhythm, so its claim stays GAP-5 in every state.
- This is different from `.starci-core-rail-frame`'s and `.starci-core-static-row`'s own narrow-container
  rules, which genuinely relax to a named compact custom property (`--starci-core-rail-gap-compact`,
  `--starci-core-row-gap-compact`) - those are component-internal frames with no `data-contract` GAP
  claim of their own to keep honest, not region roots.

### A spec that a container query can actually catch

- `shipped-claims.spec.tsx`'s existing `unbackedClaims` check unions declarations across every rule
  that targets a class, so it would have called `GAP-5` backed as long as ANY rule - even one buried
  inside a narrow `@container` query jsdom never evaluates - resolved to 1.5rem. It could not have
  caught this regression, and would not catch a repeat of it.
- Added a dedicated case that reads every stylesheet rule whose subject is
  `.starci-core-section-header` (via `cssRules`, not `unbackedClaims`) and asserts each one's `gap`
  declaration, if it has one, resolves to `1.5rem` - covering the narrow-container rule directly
  instead of trusting the union.
- `SectionHeader` was also added to the general `CONVERTED_OBJECTS` claims table alongside the other
  Core primitives.

## 0.4.7

Fixes only. 0.4.6 raised the band's action and compact-navigation slots to the 44px touch floor and
declared the feature layer out of scope; a reference-app measurement at 1280 found two more misses
the same law reaches, plus one it cannot reach without a vendor edit.

### The navigation slot's own destinations meet the floor

- The three primary destinations in the `navigation` slot are `route`-appearance TextAction
  elements, and they were the vendor-inherited 36px - `.starci-core-text-action[data-appearance="route"]`
  carried `padding: 0.5rem 0.75rem` over a `sm` line-height, 36px total, with nothing raising it.
  `route` now also carries `min-block-size: var(--starci-core-control-min-size, 2.75rem)`.
- `min-block-size` was chosen over a taller `padding-block` because `route` paints no background at
  rest - only `data-current="true"` does - so the extra block size is invisible chrome around
  unchanged FONT-2/PADDING-2 typography, not a bigger pill. `route` is always a destination, so the
  floor is unconditional on the appearance itself rather than scoped to one composition, the same
  way `choice`/`section`/`tab` are free to keep their own geometry.
- The `navigation` slot's CSS also gained the family's `:where(button, [role="button"], a[href])`
  selector already shipped on the action and compact-navigation slots, so a consumer that renders
  anything other than a `route` TextAction there - a plain button, a differently-appearanced link -
  is still caught, the same general-purpose net the other two slots already are.
- The identity slot's brand mark is a `plain`-appearance TextAction used as a same-document
  pressable (`onPress`, not `href`), and it was 36px for the same reason. `plain` elsewhere in the
  family stays a compact inline mark with no reserved hit area - it is not always a pressable - so
  the floor is scoped to `.starci-core-navigation-feature-nav-identity .starci-core-text-action[data-appearance="plain"]`
  instead of the bare `[data-appearance="plain"]` rule, which would have grown every quiet inline
  action across the app that never claimed to be a touch target.
- The band still does not grow: the primary row keeps its 4rem height and 0.5rem block inset on
  each side, `--starci-core-band-height` stays `calc(4rem + 1px)`, and a spec still asserts the
  arithmetic that 44px fits inside the 3rem the row already offers a control.

### The theme switch is a documented gap, not a silent one

- The vendor theme switch inside the actions slot is a bare HeroUI `Switch` rendered by the
  consumer's own `ThemeSwitch` leaf (`src/components/leaves/ThemeSwitch`), not a Grammar
  composition, and it measures 64x36. A HeroUI `Switch` puts its real interactive node on a hidden
  `input`/label pairing that the shipped `:where(button, [role="button"], a[href])` selector does
  not address, and does not visibly own a `button`, `[role="button"]` or `a[href]` node to hang a
  rule on without reaching into vendor markup the family does not own.
- Grammar does not publish a `ThemeSwitch` today - the only one in the codebase is the app-owned
  leaf above - and none is added here. Rather than grow the vendor selector into an `!important`
  override of HeroUI internals, or publish a one-consumer component the family has no second use
  for yet, this stays an open gap: the consumer should wrap the switch in an IconButton-sized
  pressable (the same 2.75rem hit area `IconButton` already gives the cart and account controls
  beside it) until a real second consumer justifies a Grammar `ThemeSwitch`.

### Specs

- `styles.spec.ts` asserts the `route` and identity-slot `plain` rules verbatim, and that the
  `navigation` slot now carries the same three-slot `:where(...)` selector as the action and
  compact-navigation slots, still with no `min-height`/`min-block-size`/`height` on any of the three
  slots themselves.
- `index.spec.tsx` adds a rendered check that a realistic consumer's markup - a `plain` identity
  link, three `route` destinations, a compact trigger button, and a mixed button/anchor actions
  group - actually matches the selectors the shipped rules target, so the floor is proven to land on
  what gets rendered, not only on the selector text.
- The band-height arithmetic assertion from 0.4.6 (`4rem` row minus `0.5rem` block inset either side
  is still `>= 44px`) is unchanged and still passes: nothing in this release raises the floor past
  what the row already offers.

## 0.4.6

Fixes only. Three defects a screenshot audit found on a real surface, all three of them Grammar's.

### A collapse can no longer be outranked

- `PrimaryRailLayout` NEVER COLLAPSED when `railWidth` was set. The collapse was a bare class inside
  a container query, `(0,1,0)`; the rail track was an attribute selector outside it,
  `[data-grammar-layout-rail-width="wide"]`, `(0,2,0)`. A container query adds no specificity of its
  own, so the two-column form survived at every width: in a 358px container the primary track
  computed to `0px` and the whole product explanation - illustration, benefits, disclosures - was
  invisible on a phone while the rail floated over the remains of a heading.
- `WorkspaceShell` had the identical defect one tier up. Its `[navigation="present"][rail="present"]`
  rule `(0,3,0)` in the 72rem query, and its leading-rail rule `(0,4,0)`, both outranked the collapse
  group's bare class, so a shell carrying a navigation and a rail never stacked either.
- The repair is NOT a longer list of overrides. Restating the collapse once per attribute value
  repairs today's variants and breaks again on the one somebody adds next year, and the break is
  silent: jsdom evaluates no container query, so no render test can see it. The narrow form is the
  DEFAULT instead, and every wide form moved inside a `min-width` container query. The two ranges
  are mutually exclusive, so nothing inside the query can reach the collapsed layout at any
  specificity, whatever attribute is invented later - and a renderer without container queries gets
  the stacked form, which is the safe half of the pair.
- `PrimaryRailLayout` gained one correctness rule on the way: a rail track is only granted to
  `[data-grammar-layout-rail="present"]`, so `railWidth` on a layout with no rail can no longer
  reserve a column for a rail that was never passed.
- The sweep for the same pattern covered every container query in the sheet. `Rail` (18rem),
  `SurfaceCard`'s label and rows (28rem), the section header (32rem) and `ChatWorkspace` are clean -
  their collapses either have no attribute rule competing for the property or already read
  mobile-first. `PrimaryRailLayout` and `WorkspaceShell` were the only two, and both are fixed.
- `src/core/composition/collapse.spec.tsx` is the guard. It renders every `railWidth` x
  `collapsedOrder` variant and every navigation x rail x position x width combination, matches the
  attributes each one emits against the selectors the sheet contains, and fails if any rule outside
  a container query gives a matching element a side-by-side grid. The last check is a law rather
  than a list: it holds for EVERY class a container query touches, so a new composition inherits it.

### The band's controls meet the touch floor

- Every pressable in `NavigationFeatureNav`'s action slots was the vendor button's own height -
  36px on desktop, 40px compact - and the touch floor is 44px. The language menu, the cart, the
  account button, the compact drawer trigger and the field-shaped search trigger all sat under it.
  Both action slots now give their controls `min-inline-size` and `min-block-size` of 44px.
- It is a MINIMUM, not a size, and it is spelled on the pressable, never on the slot. `min-*` are
  properties the vendor's rules never set, so nothing here is owed an `!important`, and the glyph,
  the label, the paint and the corner are untouched. A slot with a min-height would have padded a
  row that has nothing in it.
- The feature layer is deliberately out of scope: its tabs belong to the `Tabs` branch, and a tab's
  target is that branch's answer to give.

### One boundary for the surface family

- `SurfaceCard` beside `SurfaceAccordionCard` in one column disagreed by 16px at both edges.
  `SurfaceCard` is the only member of the three whose root is a HeroUI `Card`, and the vendor's
  `.card` carries a 1rem padding that pushed the card's visible surface and its label further in
  than its siblings'. The label row and the content shell were already given `padding: 0 !important`
  for exactly this reason; the root had been missed. It is zeroed now, and the content region keeps
  the family's single `--starci-core-surface-inset` where the `PADDING-4` claim already puts it, so
  the vendor inset is removed rather than moved.
- `SurfaceListCard` and `SurfaceAccordionCard` were checked for the same thing and are clean: both
  are rooted in a Grammar `<section>` and take no vendor slot at all. The claims spec now renders
  all three together and fails if a family root picks one up.

### Intentional visual deltas

- A `PrimaryRailLayout` or a `WorkspaceShell` in a narrow container STACKS, which is what both
  always claimed to do. Anything that was reading as a squeezed two-column form on a phone becomes
  one column, and a rail passed `collapsedOrder="rail-first"` finally leads.
- The band's controls grow from 36/40px to 44px. The band itself does not: the primary row is 4rem
  with a 0.5rem block inset on each side, so 44px is 4px short of the 3rem the row already offers,
  and `--starci-core-band-height` stays `calc(4rem + 1px)`. A spec asserts the arithmetic, so
  raising the floor again would fail rather than quietly desynchronise the published offset.
- A `SurfaceCard`'s interior moves outward by 16px. For a transparent card the visible surface now
  starts at the object's own box, level with a list or an accordion beside it, and its copy keeps
  the single `PADDING-4` inset. For a labelled Core card the material box is UNCHANGED - a padding
  paints inside its own background - and only the label and content lose the doubled inset, leaving
  the one `--starci-core-surface-inset` the family rule was written for.

## 0.4.5

Additive. Two numbers that consumers were restating, and one edge they were painting themselves,
move into the package.

### The sticky band publishes where it stops

- `NavigationFeatureNav` and `Subnav` now publish `--starci-core-band-offset` on the Grammar root
  when they are sticky, and a page pins to it with `top: var(--starci-core-band-offset)` and bounds
  itself with `max-height: calc(100dvh - var(--starci-core-band-offset))`. It is the sum of two
  parts, each published on its own: `--starci-core-band-height` is the navigation band -
  `calc(4rem + 1px)`, and `calc(4rem + 2rem + 1px)` once a feature layer is stacked on it - and
  `--starci-core-band-subnav-height` is a stacked sticky `Subnav`, `calc(3.25rem + 1px)`, which
  drops to `0rem` above 70rem where a compact one is not on screen.
- It is CSS ONLY. Presence and stacking are already spelled by the data attributes these
  compositions emit, so the sheet selects them with `:has()` on `.grammar-common-root` rather than
  measuring anything in JS; no hook, no new data attribute, and no rule reaching `:root`, which
  would put the package outside its own boundary.
- Nothing is defined when no sticky band is present, so `var(--starci-core-band-offset, X)` still
  resolves to a page's own `X` exactly as before this property existed.
- `Rail` in `mode="sticky"` consumes it: `--starci-core-rail-offset` is still the override a host
  sets, and unset it now reads the published band before falling back to the 5.5rem it always used.
  A `WorkspaceShell` rail region gets this through the `Rail` it hosts. `Subnav`'s own sticky `top`
  reads `--starci-core-band-height` the same way, so a subnav stacked under a two-layer band no
  longer needs `--starci-core-subnav-offset` set by hand.
- `STARCI_CORE_BAND_TOKEN_NAMES` publishes all five property names from `@starci/grammar/core`.
  They are deliberately NOT in `STARCI_CORE_TOKEN_NAMES`: a theme token has one default the family
  always defines, while each of these is derived from what is on the page or supplied by a host.

### A verdict collection paints its verdict

- `SurfaceListCard` with `isVerdict` already squared its collection's corners for these rows; it now
  ships the edge those corners were preparing for - 2px on the row's leading side, in `--success` or
  `--danger` - selected by `data-verdict` on the row.
- The row is where the value has to live, because the rows of this collection are the CALLER'S
  children and no prop of the card can reach them. `data-verdict="success" | "danger"` is therefore
  published as the card's slot contract: `StaticStateRow` gained a `verdict` prop that emits it, and
  an application-owned row spells the attribute and gets the identical shipped edge. The union is
  exported as `RowVerdict` and re-exported as `SurfaceListRowVerdict`.
- The edge is an INSET SHADOW, read from `--starci-core-verdict-edge`. A border would move a
  caller's row content by two pixels and a padding would fight the inset the row already owns; a
  shadow paints inside the box that is already there. The hover-invariant reset that clears row
  shadows reads the same property, so a verdict does not vanish under the pointer.
- It is drawn but NOT claimed. `data-contract` ids address the boundary catalog, whose six rows are
  seams, an outline and elevation; a one-sided semantic accent is none of them, so inventing an id
  would make the claim checker agree with a promise the catalog never made. The specs assert the
  shipped rule and the rendered attribute directly instead.
- `verdict` is not `state`. A `PresentationState` says how the row itself is doing; a verdict is the
  direction of what the row REPORTS, and it is drawn as the collection's edge rather than as the
  row's treatment.

### Intentional visual deltas

- `Subnav`'s toggle keeps its 2.75rem target with `!important`, and takes no new prop. The size was
  already in the sheet, but it lost to the vendor button's own sizing declared in a later layer -
  the same reason the four declarations beside it are important - so a consumer was re-forcing
  `size-11` from outside the package to get a 44px target back. A spec now asserts the rendered
  control carries the class the rule selects.
- A sticky `Rail` under a Grammar band moves from 5.5rem to the band's real bottom. That is the
  point of the offset, and the number was only ever right for a one-layer band plus a gap.

## 0.4.4

- The utility debt is PAID. Every object 0.4.3 recorded as still spelling its layout in Tailwind
  utilities - `MarkdownArticle`, `Rail`, `Subnav`, `SurfaceCard`, `SurfaceListCard`,
  `SurfaceAccordionCard`, the shared Core class names, `EmptyNotice`, `ChatWorkspace`,
  `NavigationFeatureNav`, `Divider`, `IconButton`, `IconTile`, `Icon`, `Input`, `Progress`, `Text`,
  `TextAction` and the shared action recipe - now owns its box in `src/common/styles.css`, selected
  by the data attributes each component already emits. `Label` joined them, because its type scale
  had the same problem. The recorded debt list is empty, and the package check that kept it honest
  now proves it stays empty.
- Corners come from the theme radius ramp (`--radius-lg` / `--radius-xl` / `--field-radius`),
  never from a HeroUI v2 radius name. `rounded-large`, `rounded-field` and friends emitted nothing
  anywhere, which is why several objects arrived square.
- `!important` is used only where a Grammar class lands on a HeroUI part - `Card`, `Accordion`,
  `Button`, `TextField`, `Input`, `Skeleton`, `ProgressBar` - whose own rules live in the vendor's
  `components` layer, declared after `starci-grammar-common` and therefore winning every normal
  declaration regardless of specificity. That is the same reason 0.4.3 documented for `Sidebar`.
- Added a shared claims-versus-CSS checker (`src/__test__/styleClaims.ts`, excluded from `dist`) and
  a spec that renders every converted object and fails if any `data-contract` id it emits is not
  backed by a declaration on a Grammar class that element actually carries.

### Intentional visual deltas

Each of these is a utility that emitted nothing, or a shipped rule a utility was overriding.

- `MarkdownArticle`, `FencedCodeBlock` and `MarkdownTableFrame` now carry their own Grammar classes.
  They never did: the components spelled `min-w-0 w-full` and the whole
  `.starci-core-markdown-article` block in the sheet - reading rhythm, heading scale, list, code,
  blockquote, table and rule treatment - was unreachable. Authored Markdown gains that rhythm.
- `Icon` and `IconTile` sizing is shipped. An app-owned SVG has no intrinsic box, so a glyph in a
  consumer that did not scan this package rendered at the SVG default size; it is now 1rem / 1.25rem
  / 1.5rem by `data-usage`, and the plate 2rem / 2.5rem by `data-size`.
- `Input`'s password field reserves 2.75rem of inline-end padding for its reveal toggle. The old
  `pr-9` is a utility no application in this repository writes, so it was generated nowhere and the
  toggle sat on top of the value at every width.
- The `Input` resting control takes the field corner from `--field-radius`; `rounded-field` is not a
  Tailwind v4 name and emitted nothing.
- `StaticStateRow` now draws the 0.75rem row gap and 1rem inset the sheet always specified, instead
  of the `gap-2 py-2` that overrode it. This makes its own `GAP-3 PADDING-4` claim true.
- `SurfaceAccordionCard`'s trigger draws the 1rem inset the sheet specifies rather than the
  `px-4 py-3` that overrode it, which makes its `PADDING-4` claim true. Its body's inset is
  unchanged but now claims the rows it actually paints; the old `PADDING-8` named a row the padding
  scale does not have. The body's inset also moved onto a Grammar-owned element inside the vendor
  `Accordion.Body`, because the vendor puts a `className` on an inner node and every other prop on
  the outer one, which would split the rule from the claim promising it.
- `SurfaceCard`'s composition inset claim (`PADDING-4`, or `GAP-0 PADDING-0` when joined) moved from
  the surface shell to the content region, which is the element whose shipped rule draws it.
- The compact `ChatWorkspace` rail trigger's corner is the published control radius (0.75rem)
  rather than `rounded-lg` (0.5rem), and its hover fill and shadow are now shipped.
- `Rail`'s body carries `flex: 1 1 0%` unconditionally, matching the `flex-1` it used to spell.

### Capabilities

- `Button` takes `width?: "content" | "fill"`. `fill` forwards the vendor's own full-width variant
  and adds what the vendor does not own: a label that WRAPS onto a second line instead of
  overflowing, with the control height released to follow it. Two products were reaching through the
  Grammar boundary with a descendant width utility to get this.
- `Text` takes `overflow?: "wrap" | "truncate" | "clamp-2"`, shipped by `data-overflow`. Three
  dashboard blocks were reaching in with descendant selectors on `[data-size]` to force wrapping or
  truncation.
- `NavigationFeatureNav` makes `navigation` optional through the same `WithNavigation |
  WithoutNavigation` union `WorkspaceShell` uses. With no destinations it renders NO `nav` element -
  an empty navigation landmark is announced and reached and names nothing - and the primary grid
  drops the track instead of keeping it empty.
- `PrimaryRailLayout` takes `collapsedOrder?: "primary-first" | "rail-first"`. Once the container
  collapses to one column, `rail-first` lifts the rail above the primary content, for a filter or
  summary a reader needs before the content itself.

## 0.4.3

- `Sidebar` now owns its geometry in the packaged stylesheet. Every Tailwind utility it used to
  spell in JSX (rail and drawer widths, the right separator, list/section/item/header/footer
  rhythm, item shape and states) moved to `.starci-core-sidebar*` in `src/common/styles.css`,
  driven by `data-presentation`, `data-collapsed` and the React Aria item states. A consumer no
  longer has to scan `node_modules/@starci/grammar` with Tailwind to get a sidebar, and the item
  corner comes from the theme radius ramp instead of `rounded-large`, which emitted no CSS.
- Added `PressableField`: a field-shaped press target with input anatomy - optional leading icon,
  placeholder-style copy, optional `kbd` shortcut hint - painted from the same `--field-*` tokens
  `Input` reads. It replaces the two app-local `PressableInputLike` clones that pushed field
  geometry into a Grammar `Button` through `className`. It is not a `Button` variant.
- Added a package check that no shipped component spells layout or geometry in Tailwind utilities,
  with the remaining offenders recorded as a list that may only shrink.
