---
name: api-backlog
description: Every canon rule that a type, an API shape, or a gate script could absorb, reframed as engineering work. Each item shipped is a rule that stops needing to be read.
---

# API backlog

Canon has two kinds of rules: the ones that need a human's judgement (see
[`principles/judgement.md`](../principles/judgement.md)) and the ones that only exist because
nobody built the type, the prop shape, or the gate that would make the mistake impossible to write.
This file is the second kind, reframed as engineering tickets. **Every item shipped here is one
fewer rule a contributor has to read, remember, and re-derive by hand — the rule doesn't move
somewhere else, it stops existing.** Groups are sorted by how many rules they delete, most first, so
the highest-leverage ticket is always at the top.

## Typography.tsx (5 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| `TypographySize` and weight already restricted via TS literal unions — no 11th size value, no 4th weight value possible | size/weight values outside the declared set are used | text |
| Flat, non-namespaced component API, enforced by a script forbidding the namespace pattern | using the old namespaced API `Typography.Xs`/`.H3` instead of the flat prop API | text |
| Discriminated union — when `size="code"` or `isLink`, type `weight` as unavailable instead of accepting and silently ignoring it | combining `size="code"` or `isLink` with a `weight` prop, which silently has no effect | text |
| Discriminated union — when `prefixIcon`/`suffixIcon` is passed, omit `weight` from that variant's type instead of accepting and overriding it silently | `weight="bold"` next to an icon is expected to render bold but always renders medium | text |
| Internal weight-to-class lookup as a total function that always emits a concrete class, even for the unset default, never null/empty | not declaring `weight` is assumed to emit no class, letting vendor CSS bleed through | text |

## eslint-plugin-starci-fe (5 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Gate script scanning `className` strings for `text-xs`/`text-sm`/`text-base`/`text-lg` or `font-medium`/`font-bold`/`font-semibold` outside `Typography.tsx` | scattering hand-written `text-*`/`font-*` classNames instead of using the size/weight props | text |
| Gate script (`check-color.mjs`) scanning `className` for `text-muted`/`text-accent`/`text-danger`/`text-success`/`text-warning` (with `-soft-foreground` variants) or `bg-*-soft` outside the 3 SSOT files | hand-writing a color class when the color/tone/status prop can express it | color |
| Lint rule banning icon-library imports outside the Phosphor whitelist, except `react-icons` for brand logos | using an icon set other than `@phosphor-icons/react` | icon |
| Gate scanning `className` outside Typography/Chip/Button for accent/chip/button-style classes, overlaps the color axis's gate | hand-writing a color class to fake one of the four prominence mechanisms | prominence |
| Gate rule banning the `text-left`/`text-right` string literals, permitting only the logical `text-start`/`text-end` classes | writing physical `text-left`/`text-right` instead of logical `text-start`/`text-end` | reading-flow |
| Gate scanning `atoms/forms/**` and any field skeleton for `rounded-xl`, requiring `rounded-field`. **Measured 2026-07-30: 5 live call sites** — `Input.tsx:687` a real field, plus `Input.tsx:72`, `Input.tsx:606`, `Select.tsx:73`, `SearchAutocomplete.tsx:136` on field skeletons. **Correct precedent already in the repo**: `composites/buttons/InputButtonLike.tsx:87` draws its field skeleton with `rounded-field`. Root of the confusion is written into the source itself — `src/.../Skeleton/Input/index.tsx:13` states *"rounded-field (0.75rem = rounded-xl)"* and then uses them interchangeably | "the two tokens are the same number so either will do" — true today, false the day `--field-radius` moves, and the first thing to break is a skeleton no longer matching the field it mirrors | radius foundation · skeleton |

## async composite (5 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| A single `<Async>` composite owns the four-branch order internally; lint-forbid hand-rolled sequential `isLoading`/`isEmpty`/error checks in screen/block files | hand-writing the error/loading/empty/content if-else chain instead of going through the composite | async |
| Already enforced by `check-passthrough-block.mjs` | a block wraps the composite without adding any domain logic of its own | async |
| Discriminated union — either `{ error?: never }` or `{ error: true; errorContent: ReactNode }`, mirrored for `isEmpty`/`emptyContent` — so the flag can't be set without its content | setting `error`/`isEmpty` true without supplying `errorContent`/`emptyContent` | async |
| Same discriminated-union fix as the missing-content rule above | "setting `error` makes the error branch show itself" even without `errorContent`/`emptyContent` | async |
| Derive `isEmpty` internally as `!isLoading && length === 0` instead of accepting a caller-supplied boolean | "an empty array means empty" — passing a raw `isEmpty` boolean that ignores `isLoading` | async |

## Button atom (4 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Bake `text-start` in as the Button/pressable atom's own base style, instead of requiring every call site to remember the override | a `<button>`/whole-block pressable not overriding text-align itself, so the UA default silently centers it | reading-flow |
| Same fix as above — Button owns `text-start` as its base style | "did not write `text-center` but the text still lands centered" | reading-flow |
| Already enforced by `tsc` via the closed union literal for `variant` (7 members) and `size` (3 members) | `variant`/`size` set outside the seven-variant/three-size scale | button |
| Button simply doesn't expose a press-override `className` — the vendor owns press exclusively | manually adding `active:scale`/ripple classes to a Button | press |

## Surface primitive (4 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| No raw `className` access to `rounded-*`/`shadow-*`, only the typed radius/variant tokens | `rounded-*`/`shadow-*` outside the vocabulary, e.g. `rounded-[10px]` | surface |
| `variant: 'surface' or 'nested'` already makes border XOR shadow deterministic; forbid raw `border`/`shadow` className that bypasses variant | a box with both `border` and `shadow-surface` | surface |
| Shadow suppression as a computed side-effect of a `selected` prop, not a manually-added `!shadow-none` | a selection ring/outline without turning off the shadow | surface |
| Same fix as the selection-ring rule above | "combining `ring-2` with `shadow-surface` gives you a selection border" | surface |

## Frame gap prop (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Union literal type (`SeamScale`/`InsetScale`) instead of a raw number — already the mechanism, caught by `tsc` | gap outside the 6 steps / padding outside the 4 steps | frame |
| Union literal `SeamScale` — gap only accepts named steps, raw numbers rejected at compile time | writing a number for `gap` | seam |
| `gap` only settable through the typed `SeamScale` prop, no raw `className` bypass | a gap value outside the scale (`gap-1.5`, `gap-4`, `gap-5`) | seam |

## Frame child slot (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Children slot doesn't expose margin-capable `className`, only the typed auto-margin/bleed escape hatches | a frame's child carrying margin, except `mt-auto`/`ms-auto`/`-mx-*` | seam |
| Single ownership enforced by not exposing margin utilities on a gapped frame's children | a child carrying margin when the parent has gap — two owners for one seam | seam |
| Margin utilities not exposed on frame children except the typed escape hatches | a child carrying margin to push its own spacing, except `mt-auto`/`ms-auto`/bleed `-m-*` | inset |

## shared press utility class (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Bake the `:active` selector into a shared press utility/class so hand-written cards/rows never need `data-[pressed]` | using `data-[pressed]` instead of native `:active` on a hand-written card/row | press |
| Bake `transition-[scale]` into the shared press utility class list so callers never hand-write the transition property list | `transition-all`/`transition-transform` used for the `scale` step | press |
| Same fix as above | "`transition-transform` is enough for scale" — omitting `scale` from the transition property list | press |

## Accordion / Select / Checkbox wrapper atoms (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Wrapper atom requires children on its Indicator slot instead of allowing it to be left empty | leaving a HeroUI Indicator slot empty, letting the vendor draw its own glyph as a second icon set | icon |
| Checkbox wrapper types Indicator's children as a function `(state) => ReactNode` only, disallowing a plain `ReactNode` | overriding `Checkbox.Indicator` with a plain node instead of a function, so indeterminate wrongly also shows a checkmark | icon |
| Same function-only children type fix as above | "pass `<CheckIcon/>` into `Checkbox.Indicator`" | icon |

## HTML-constrained control content/title props (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Narrow the type — `title` prop typed as `string`, not `ReactNode` | a `title` field in an HTML-constrained control accepting `ReactNode` instead of `string` | markdown |
| Narrow the type — content slot of button/summary/a/inline elements typed as `string` so a `ReactNode`-accepting `MarkdownContent` can't be passed in | rendering `MarkdownContent` inside `<button>`/`<summary>`/`<a>`/an inline element | markdown |
| Same narrowing fix as above | "`ReactNode` for flexibility" | markdown |

## composite component API layer (3 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| No raw `className`/style slot capable of layout at composite tier; layout only available through Frame primitives | hand-writing layout (flex/grid + `gap-*`) from the composite tier up | frame |
| Same fix as above | hand-writing layout from the composite tier up | seam |
| Composite tier exposes no raw padding `className`, only the typed `InsetScale` prop | raw `p-*` at the composite tier or above, even when on-scale | inset |

## Typography.tsx / Alert.tsx / ChipBase.tsx — shared color SSOT (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| `TypographyColor`/`AlertStatus`/`ChipTone` already literal unions | a color value outside the 6-step scale, passed through the prop | color |
| Color-to-class lookup as `COLOR_CLS[color ?? "default"]`, a total mapping producing a concrete class even for the unset default, never a conditional that skips emission | not passing the color prop is assumed to emit no class, letting vendor CSS win | color |

## Dedicated tier-color scale + lint gate (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Lint rule comparing a prop's declared enum arity against the 3-value `AlertStatus` mapping target, flagging arity > 3 — give ≥4-step tiers their own color scale | forcing a tier of ≥4 continuous ordered steps into the 3 status tokens, colliding two steps on one color | color |
| Same arity-gate fix as above | "four difficulty levels map onto success/warning/danger" | color |

## Shared icon prop types (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| `IconWeight` restricted to exactly `'regular'` or `'bold'` | icon weight outside the two allowed notches | icon |
| Typed `IconSize` union of exactly the 5 allowed size classes instead of a free string | icon size outside the five allowed values | icon |

## Shared icon-size utility (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Replace hand-written per-component `Record<Size,Weight>` tables with one shared `getIconWeight(size)` derived from the canonical size table | a `Record<Size, Weight>` table assigning the same value to every key | icon |
| Same shared-function fix as above | "force bold across the whole size table for consistency" | icon |

## Table.tsx / CellBox (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Set `text-align` on the child span (`CellBox`), not directly on `<td>`/`<th>`, since a value set on an uncontested child beats an inherited un-layered vendor rule | setting `text-align` directly on `<td>`/`<th>` where un-layered vendor CSS silently overrides it | reading-flow |
| Same child-span fix as above | "`text-end` but the column still sits left" | reading-flow |

## Inset primitive exception API (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Typed required `exceptionReason: string` field, enforced by `tsc` instead of a regex on a comment | `// inset-exception:` without stating a reason | inset |
| Same typed-field fix removes the comment-syntax pitfall entirely | declaring the exception with `{/* */}` inside a ternary branch | inset |

## Atom tier components (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Atoms simply have no `InsetScale` prop — exemption built into the type surface | applying `InsetScale` down at the atom tier | inset |
| Same atom-tier exemption fix — no prop exists to violate | `Input` writes `pr-9`, a violation not yet caught | inset |

## Row primitive (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Row has no `rounded`/`border`/`shadow` props; chrome only comes from the parent frame | a ROW adding its own `rounded`/`border`/`shadow` | surface |
| Same fix as above | "a row in a list should get rounded corners to soften it" | surface |

## Card/Surface primitive (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Remove card-chrome styling capability from `className`, keep it exclusively on `contentClassName` | `className` restyling the card surface instead of `contentClassName` | surface |
| Same named-slot fix as above | "a second ghost card shows up behind the real card" | surface |

## Row vs Card press prop API (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Split the shared `press` union into per-component discriminated types — `RowPress` limited to `none`/`fill`/`underline` vs `CardPress` limited to `none`/`underline`/`scale` — so a Row can never be typed with scale/ripple | a ROW, or any element without its own border/radius, carrying `scale`/`ripple` | press |
| Same per-component discriminated-type fix as above | "it's inside a card so apply scale" — applying `scale`/`ripple` to a child ROW because the parent happens to be a card | press |

## Card / press primitive (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Derive rest-state styling internally from the computed press step; don't expose a free-form `className` override for interaction states | a pressable card carrying `hover:bg-*` at rest, outside the underline-link branch | press |
| Derive the press step from `href`/`actions`/`onPress` presence via a discriminated union instead of letting the author hand-pick it | "a pressable card is always scale+ripple" — applying scale+ripple to a card that actually has `href` with no `actions` | press |

## skeleton gate (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| AST/lint gate flagging components whose render returns literal JSX, not just children/slot passthrough, but lack an `isSkeleton` prop in their type | a component owns real shape pixels but is missing `isSkeleton` | skeleton |
| AST gate checking the `isSkeleton` conditional's source position precedes all other shape-branch conditionals | the `isSkeleton` branch doesn't come before every other shape branch | skeleton |

## eslint config — rules-of-hooks (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Already enforced by the `react-hooks/rules-of-hooks` eslint rule | hooks are called but the component early-returns before all of them run | skeleton |
| Same enforcement covers this | "put `if (isSkeleton)` right at the top of the function to be safe" | skeleton |

## child component API (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| The child only accepts skeleton state via its own `isSkeleton` prop passthrough — no separate shimmer-shape API exists to hand-roll against | hand-building a parallel shimmer tree for a child that already exposes `isSkeleton` | skeleton |
| Same passthrough-only fix as above | "the child component also needs shimmer, just draw it quickly" — hand-building instead of passing the flag | skeleton |

## responsive frame/row API (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Breakpoint prop typed as a name union `at`, limited to `"sm"`/`"md"`/`"lg"`, never a number | a breakpoint declared as a raw pixel number | responsive |
| `at` is a required prop with no default and no "auto" value | a row that doesn't declare where it breaks | responsive |

## layout frame with aside slot (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Discriminated union — either `{ aside?: never }` or `{ aside: ReactNode; collapseAt: Breakpoint }` | a side region (aside) shipped without a forced collapse rule | responsive |
| Same discriminated-union fix as above | "the aside is optional so the breakpoint can be too" | responsive |

## responsive frame (2 rules deleted)

| What to build | Rule it deletes | Axis |
|---|---|---|
| Internally split the container-query layer and the padding layer into two nested elements so the caller can never merge them | `@container` and `padding` applied on the same element | responsive |
| Same split-layer fix as above | "`@container` on the wrapper is tidier" — putting the container query and padding on one element so the query measures the padded content box and never reaches its threshold | responsive |

## Single-rule groups (1 rule deleted each)

| Component / layer | What to build | Rule it deletes | Axis |
|---|---|---|---|
| Modal atom (title slot) | A dedicated `Modal.Title` component that always renders base+semibold and forbids a size/weight override | "big and bold, so it should be a heading" — a Modal title is easily confused with the heading tier | text |
| ChipBase.tsx type | `ChipBaseProps` already omits `onClick`/`onPress` from its type entirely, forcing a real Button or a `Popover.Trigger` wrapper | attaching `onClick`/`onPress` directly onto a Chip to fake a button | prominence |
| scripts/check-seams.mjs | Extend the gate to flag hand-written `justify-*`/`items-*` even when not paired with `gap-*` in the same string | hand-written `justify-*`/`items-*` at the composite tier or above | reading-flow |
| Cluster/Grid (frames owning their own row rhythm) | Frames with a fixed internal row rhythm simply have no `gap` prop to pass | passing `gap` into a frame that owns its own row rhythm | frame |
| Frame/Container primitive | A frame declares container-mode XOR padding, never both as independently settable props on one element | a new frame opening `@container` and setting padding on the same element | frame |
| Container | `gap`/`header`/`footer` already removed from Container's prop surface, forcing `Container > Stack.V` composition | "Container already has gap, no need to wrap in Stack" | frame |
| Stack (`as` prop) | Narrow `as` to a union of exactly 5 allowed tag names instead of the broad `ElementType`, which collapses children to `never` | "type `as` as `ElementType` for flexibility" | frame |
| Frame/Inset padding prop | Union literal `InsetScale` prop plus a required typed exception, instead of raw `p-*` className | a padding value outside the scale (`p-4`, `p-5`, `p-1.5`) at the frame tier or above, without declaring an exception | inset |
| Field component | Keep the concentric-radius calculation private/internal to Field, not exported as a shared utility others could misapply | "apply the concentric formula to a cover image" | surface |
| Button cluster/group composite | Derive the variant tier from the cluster's own counted level count inside a `ButtonGroup` composite, instead of hand-picking each button's variant independently | `ghost` used in a cluster that only has 2 emphasis levels | button |
| Pressable primitive + eslint config | Route all press behavior through a single `Pressable` primitive that always renders the semantic element internally, plus a jsx-a11y rule forbidding a bare clickable `<div>` | hand-rolling `<div cursor-pointer>` instead of the native `<button>`/`<a>` | press |
| press prop API | Already enforced by `tsc` via a closed union literal type for the press/hover prop | a `hover` value set outside the defined union | press |
| Row/press primitive | Derive the hover/press class internally from whether a real handler exists; forbid a free-form `className` override for interaction states | "add `hover:bg` to signal it's pressable" when there is no real `onPress`/`href` | press |
| import boundary / architecture gate | Restrict import of the async composite to `blocks/**` via an eslint `no-restricted-imports` boundary per directory | a SCREEN importing the async composite directly | async |
| screen-tier usage gate | Gate requiring the composite call to be the sole top-level JSX returned by the screen component | calling the composite at screen tier but only replacing part of the tree instead of an early full return | async |
| architecture/story gate | Gate checking the component's file path matches `blocks/**` and has a companion `.stories` file before it counts as block tier | "wrapping it in an internal function right inside the screen file already separates tiers" | async |
| component's skeleton branch | Exhaustive discriminated-union switch over the axis with an `assertNever` default branch so a missing case fails `tsc` | a known-in-advance shape axis is skipped — one generic shape drawn for every configuration | skeleton |
| primitives barrel / lint config | Lint-forbid any export/import matching the `Skeleton.*` compound naming pattern | rebuilding a shared `Skeleton.*` compound | skeleton |
| component props type | Discriminated union — either `{ isSkeleton: true }` or `{ isSkeleton?: false; ...requiredContentProps }` — so content stays required in the non-skeleton branch | content props dropped to blanket-optional instead of a union keyed on `isSkeleton` | skeleton |
| story gate | Gate checking every component's story file exports a `Skeleton` variant | no dedicated `Skeleton` leaf/story exists for the component | skeleton |
| primitive prop type definitions (e.g. `AsyncContent`) | Type the icon prop as `ComponentType<SVGProps<SVGSVGElement> & {weight?: IconWeight}>` instead of importing a library-specific type | declaring an icon prop typed to a specific library's own type | icon |
