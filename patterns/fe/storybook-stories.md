# Storybook stories — STRICT (code style for `*.stories.tsx`)

> How to WRITE a story (`.storybook/stories/**/*.stories.tsx`) for the main FE app, branch `mtp`.
> This is code style for a **story**, which is not the same as code style for a **component**
> (`src/components`). A story is the living documentation of the design system: written wrong, it
> TEACHES the wrong thing about the very component it demonstrates. Every example below is quoted
> from a real story in `.storybook/stories/`. Verification is `tsc --noEmit` plus
> `eslint --max-warnings=0` — no browser needed, because a story is declarative code. Formatting
> follows [[imports-and-format]]: 4-space, double-quote, no semicolons, no `any`.

## 1. File skeleton — `meta` as a typed annotation, never `satisfies`

Import `import type { Meta, StoryObj } from "@storybook/nextjs"` and import the component through
the `@/components/...` alias.

Declare `meta` as a **type annotation** — `const meta: Meta<typeof X> = { ... }` — then
`export default meta`, then `type Story = StoryObj<typeof X>`. Only two fields: `title` and
`component`.

Grounding: 100% of real stories use the `Meta<typeof X>` annotation with `export default meta`;
**zero use `satisfies Meta`**. Do not "modernise" to `satisfies` — it would break with the entire
corpus.

```tsx
// .storybook/stories/blocks/buttons/Button/Button.stories.tsx
const meta: Meta<typeof Button> = {
    title: "Core/Button/Button",
    component: Button,
}
export default meta
type Story = StoryObj<typeof Button>
```

```tsx
// Wrong: satisfies (absent from the corpus) plus extra fields that do not belong — see §3
export default {
    title: "Button",
    component: Button,
    parameters: { layout: "centered" },
} satisfies Meta<typeof Button>
```

## 2. `meta.title` groups the tree by FAMILY — three levels of `<Root>/<Category>/<Name>`

Always all three levels: **Root** / **Category (family)** / **Name (leaf)**. The current Root is
`Core` for the majority — keep one consistent Root across the tree rather than inventing new ones.

**The Category is the FAMILY name, capitalised and singular**, derived from the code folder:
`async` → `Async`, `chips` → `Chip`, `buttons` → `Button`, `cards` → `Card`, `lists` → `List`,
`form` → `Form`, `stats` → `Stat`, `navigation` → `Navigation`, `layout` → `Layout`,
`feed` → `Feed`, `feedback` → `Feedback`, `identity` → `Identity`, `skeleton` → `Skeleton`. A
component that is alone in its family still gets three levels (`Core/Skeleton/Skeleton`) — the
repeated word is accepted to keep one tree shape.

The REAL exception changes the TREE by ROLE rather than dropping a level: `InfoTooltip` (code lives
in `feedback/`) becomes `Core/Overlays/InfoTooltip`; `DiffViewer` becomes `Core/Rendering/CodeDiff`.
Both regroup to the right family and both still have three levels.

The sidebar groups folders by Category, and each component keeps its own entry with its own Controls
and Docs — never merge several components into one file.

```tsx
// .storybook/stories/blocks/chips/DifficultyChip/DifficultyChip.stories.tsx
title: "Core/Chip/DifficultyChip"        // Root / Family / Leaf
```

```tsx
// Wrong: two levels, so the leaf floats beside folders in the sidebar
title: "DifficultyChip"
// Wrong: a foreign Root, out of step with the rest of the tree, which is "Core/…"
title: "Components/Chip/DifficultyChip"
```

A drift exists today: some files use the Root `"Block/…"` instead of `"Core/…"` — for example
`Block/Feed/ChatPanel`, `Block/Commerce/PricingTable`. The Root should be UNIFORM; when you touch
one of those files, pull it back to the dominant `Core` rather than multiplying variants.

## 3. The canvas is full-bleed — never set `parameters.layout`

`.storybook/preview.tsx` already sets `layout: "fullscreen"` GLOBALLY plus a decorator of
`min-h-screen w-full p-8`, so content flows from the **top left** and the canvas is identical across
Storybook. A story that overrides `layout` — `"centered"` above all — shrink-wraps the canvas,
strands the decorator's `h-full`, and leaves the block floating in whitespace.

**A wrapper that constrains WIDTH stays** (`w-80`, `max-w-2xl`, …) — a narrow container is often the
point of the story, for testing truncation. This rule bans `layout` only, never width.

```tsx
// .storybook/stories/blocks/form/TextField/TextField.stories.tsx
// the width constraint is kept, and there is no parameters.layout
render: () => (
    <div className="flex w-80 flex-col gap-3">
        ...
    </div>
)
```

```tsx
// Wrong: fighting the global canvas — the block ends up floating mid-page
export const Default: Story = {
    parameters: { layout: "centered" },
    ...
}
```

## 4. `parameters.usage` — the "Usage" caption — is REQUIRED on every story

Every story MUST carry `parameters.usage`. The decorator in `preview.tsx` renders it as a "Usage"
`Alert` directly ABOVE the canvas, while `autodocs` takes the `/** */` JSDoc above the story for the
Docs tab. No `usage` means no note on the canvas.

**The content says WHEN to use it, and must EXCLUDE its siblings** — not describe the mechanism, not
say what it does. Where a block has an alternative — a pager against a "load more" button, a modal
against a drawer, tabs against a segmented control, one variant against another — the `usage` must
say *when to pick this one INSTEAD OF that one*.

**Inline markdown (backticks) lives ONLY in `usage`** — `preview.tsx`'s `renderUsage` turns
`` `code` `` into a styled `<code>`. Outside `usage`, such as a description inside `render`, there is
no markdown.

```tsx
// .storybook/stories/blocks/buttons/Button/Button.stories.tsx
// says WHICH to pick and WHEN; backticks are fine inside usage
parameters: {
    usage:
        "Pick a variant by ROLE, not by the color you'd like to see: primary = the main CTA (at most 1 per surface) · " +
        "secondary = a supporting button PAIRED with a primary · tertiary = a supporting button that stands ALONE ...",
}
```

```tsx
// Wrong: describes how it looks, and never says when to choose it
parameters: { usage: "A blue rounded button with a shadow." }
// Wrong: no usage at all
export const Default: Story = { render: () => <Button>OK</Button> }
```

## 5. A comparison story (`AllVariants` / `Branches` / `AllDifficulties` / `SizesAndStates`)

The frame is FIXED, grounded in `Button.stories.tsx` (`AllVariants`) and `AsyncContent.stories.tsx`
(`Branches`):

- **The outermost element is ALWAYS `flex flex-col gap-6`, left-anchored** — stacked VERTICALLY,
  whether the variants are large (a card) or small (a chip). No horizontal row, no grid of two or
  more columns. A row or grid pushes content rightwards and squeezes each cell narrow, so the
  variants never render at their real width.
- **Each variant is a `flex flex-col gap-3` cluster** containing (a) a label group
  `flex flex-col gap-2`, then (b) the real demo.
- **The label is a `<Label>` with an initial capital** (`error` → `Error`) — never a hand-rolled
  `<span className="text-xs text-muted">`.
- **Directly under the `<Label>` sits one description of WHEN this variant is used**, written with
  `<Typography type="body-sm" color="muted">` — `body-sm` IS `text-sm`, so do not hand-roll
  `<span className="text-sm text-muted">`. The description states the CHOOSING CONDITION, in
  lower case and with **no markdown** (the `<Typography>` children are raw and never pass through
  `renderUsage`).

```tsx
// .storybook/stories/blocks/buttons/Button/Button.stories.tsx
render: () => (
    <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
                <Label>Primary</Label>
                <Typography type="body-sm" color="muted">
                    The main CTA. At most one per surface — two primaries breaks the hierarchy ...
                </Typography>
            </div>
            <Button variant="primary">Enroll now</Button>
        </div>
        {/* ...secondary, tertiary, ghost... each its own gap-3 cluster */}
    </div>
)
```

```tsx
// Wrong: a horizontal grid, a hand-rolled muted span for the label, and no "when" description
render: () => (
    <div className="grid grid-cols-3 gap-4">
        <span className="text-xs text-muted">primary</span>
        <Button variant="primary">Enroll now</Button>
    </div>
)
```

**A story REFLECTS a rule; it does not INVENT one.** When a canonical variant has no rule yet,
describe it from the real call site using it — do not make up a new rule inside a story.

## 6. The MINIMUM story set — a story earns its place only by showing something no other story shows

One story is one **state, layout, or behaviour that LOOKS different** — not one different prop value.

- **An enum, tone, or size explosion collapses into ONE comparison story** (`AllVariants`,
  `AllDifficulties`) rendering every variant at once. Drop the per-value stories.
- **Delete filler:** a story differing only by `className`, only by the NUMBER of items, only by one
  icon or one word, or two stories that are near-duplicates.
- **Keep:** one real Default plus states that genuinely LOOK different — loading, empty, error,
  disabled, overflow, truncation, or a slot whose presence changes the layout. `ChatPanel` keeps
  exactly three stories — `Conversation`, `Empty`, `Typing` — because each is a different picture.

```tsx
// .storybook/stories/blocks/chips/DifficultyChip — one AllDifficulties story covering all four levels
export const AllDifficulties: Story = { render: () => (/* four variants stacked vertically */) }
```

```tsx
// Wrong: four per-value stories, none of which shows anything new
export const Beginner: Story = ...
export const Intermediate: Story = ...
export const Advanced: Story = ...
export const Insane: Story = ...
```

## 7. Skeleton stories — MIRROR the shape, demonstrated through `AsyncContent` / `isLoading`

Following `Skeleton.stories.tsx` and `AsyncContent/components.tsx`:

- **The skeleton MIRRORS the real layout tree** — keep the structural nodes (separator, wrapper,
  gaps, the same `p-3` as a real row) and replace ONLY the content nodes with `Skeleton.<Component>`.
  Do not scatter shimmer. The goal is a box that neither jumps nor collapses on resolve.
- **Demonstrate the loading state through the real wrapper** — `AsyncContent` with `isLoading` and
  `skeleton={...}` — rather than building a loose skeleton inside the main story.
- **The Skeleton reference story is a table**: the skeleton on the left, the REAL node of the same
  `type` on the right, so the heights can be compared.

```tsx
// .storybook/stories/blocks/async/AsyncContent/components.tsx
// the skeleton mirrors the real row: same SurfaceListCard, same p-3, same separator
export const skeleton = (
    <SurfaceListCard>
        {[0, 1].map((row) => (
            <SurfaceListCardItem key={row}>
                <div className="flex items-center gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-0">
                        <Skeleton.Typography type="body-sm" width="1/2" />
                        <Skeleton.Typography type="body-xs" width="1/3" />
                    </div>
                    <Skeleton className="size-4 rounded" />
                </div>
            </SurfaceListCardItem>
        ))}
    </SurfaceListCard>
)
```

```tsx
// Wrong: a flat shimmer that mirrors nothing — the box jumps when the content arrives
export const skeleton = <div className="h-40 w-full animate-pulse bg-default" />
```

## 8. Mock data — real domain language, FIXED ISO dates, no-op callbacks

- **Fake data carries REAL domain language** — actual course, lesson, and user names, never `foo` or
  lorem. The corpus is written in English (`"Build a REST API"`,
  `"Authentication & authorization"`); follow its voice rather than mixing at random.
- **Dates are FIXED ISO strings.** Never `new Date()` or `Date.now()` — a story must be
  deterministic for snapshots to be stable. Grounding: zero stories use `new Date()`.
- **Callbacks are no-ops** — `() => {}` — or real state inside a `Controlled` wrapper (§9).
- Heavy mock data and any `Controlled` component move into a `components.tsx` beside the story and
  are imported.

```tsx
// .storybook/stories/blocks/feed/CommentThread/components.tsx
createdAt: "2026-07-14T09:00:00.000Z",   // fixed ISO
onPress: () => {},                        // no-op
```

```tsx
// Wrong: a dynamic date changes the snapshot on every run
createdAt: new Date().toISOString(),
```

## 9. Stateful goes in a `Controlled` wrapper (in `components.tsx`); presentational renders directly

A block that needs `value + onChange`, a selection, or open/close state gets a `Controlled` wrapper
holding the `useState`, placed in `components.tsx` beside the story; the story passes only
`initial*`. A pure render-props block is rendered directly inside `render`.

```tsx
// .storybook/stories/blocks/feed/ChatPanel/ChatPanel.stories.tsx
import { baseMessages, Controlled } from "./components"
render: () => <Controlled initialMessages={baseMessages} />
```

```tsx
// Wrong: useState stuffed into a StoryObj's render — unreusable, and repeated in every story.
// Move it into Controlled in components.tsx.
render: () => {
    const [messages, setMessages] = useState(baseMessages)
    return <ChatPanel messages={messages} ... />
}
```

## 10. A presentational block plus `AsyncContent` — the `variant / scenario / state` taxonomy

Block stories are built on the tree **`variant / scenario / state`**. The three levels map onto CODE
without forcing the block to grow three props:

- **variant** is a shape **prop** — `variant="item" | "hero"`.
- **scenario is the SHAPE**, a **discriminating prop** that decides the COMPOSITION — which parts
  render. Use a **discriminated union** so the data and the shape cannot drift apart:

  ```tsx
  type Props = { variant: Variant; title: ReactNode; meta?: ReactNode[]; timeLeft?: ReactNode; urgent?: boolean; ctaLabel?: ReactNode } & (
      | { scenario: "progress"; value: number; max?: number }   // progress ⇒ value is REQUIRED
      | { scenario: "no-progress" }                             // no-progress ⇒ value is FORBIDDEN
  )
  // in the component: {scenario === "progress" && <ProgressMeter value={value} max={max} />}
  ```

- **state — loading, error, empty — is NOT a prop of the block.** The block renders only the LOADED
  case. State belongs to the **`AsyncContent`** wrapper and its priority switch
  (`error → loading → empty → content`). The real API (`blocks/async/AsyncContent`):
  - `isLoading` with `skeleton`, a `Skeleton.*` tree MIRRORING the shape — per scenario, so a
    no-progress skeleton has no bar.
  - `error` with `errorContent={{ title, onRetry, retryLabel }}` — props, not nodes.
  - `isEmpty` with `emptyContent={{…}}` — only when the consumer has an empty branch.
  - `children` — the loaded block.

Rendering the kinds out as stories:

```tsx
// loaded leaves — render the block DIRECTLY (variant × scenario × tone)
export const NotUrgent: Story = { name: "Không gấp",
    render: () => <ContinueCard variant="hero" scenario="progress" value={2} max={8} /> }
export const Urgent: Story = { name: "Gấp",
    render: () => <ContinueCard variant="hero" scenario="progress" value={7} max={8} timeLeft="2 minutes left" urgent /> }
export const NotStarted: Story = { name: "Chưa có tiến độ",
    render: () => <ContinueCard variant="hero" scenario="no-progress" /> }

// state leaves — through the REAL AsyncContent, never a hand-rolled <SectionCard><Skeleton/>
export const Loading: Story = { name: "Đang tải",
    render: () => (
        <AsyncContent isLoading skeleton={<HeroProgressSkeleton />}>
            <ContinueCard variant="hero" scenario="progress" value={2} max={8} />
        </AsyncContent>
    ) }
export const LoadError: Story = { name: "Lỗi tải (mạng rớt)",
    render: () => (
        <AsyncContent isLoading={false} error={new Error("network")}
            errorContent={{ title: "Mất kết nối", retryLabel: "Thử lại", onRetry: () => {} }}>
            <ContinueCard variant="hero" scenario="progress" value={2} max={8} />
        </AsyncContent>
    ) }
```

Because the skeleton mirrors the shape (§7), there is **one skeleton per SCENARIO** — progress has a
bar, no-progress does not — and it is never multiplied by tone.

`ContinueCard` is the template being straightened toward this standard: an explicit `scenario` prop
plus loading and error through `AsyncContent`, replacing the implicit `value === undefined` and a
hand-rolled `<SectionCard><Skeleton/>`.

## 10b. Anatomy is the REAL DOM tree, PER LEAF (`BlockAnatomy`)

Each **leaf** — each story state or scenario — wraps its own render in its **OWN `BlockAnatomy`**, so
every leaf carries its own anatomy axis (diagram plus tree). There is no collected `Anatomy` story,
and no `blockShell`; that has been removed.

```tsx
export const Loading: Story = { name: "Đang tải",
    render: () => frame(
        <BlockAnatomy name="FlashcardDeckList" tier="block" leaf="Đang tải" parts={LOADING_PARTS}
            note="AsyncContent nhánh loading → lưới skeleton mirror.">
            <FlashcardDeckList decks={[]} isLoading showAnatomy onOpenDeck={() => {}} />
        </BlockAnatomy>) }
```

- **`parts` REFLECTS EXACTLY the DOM and JSX tree that leaf renders.** Every primitive and
  sub-block actually rendered is PRESENT — including structural parts such as `AsyncContent` and
  wrapper switches — **nested to match the DOM** (use `children` for a child part), ordered top to
  bottom. Check it against the REAL JSX: nothing missing, nothing extra, and no curating for
  tidiness.
- **Use the REAL primitives** (import the ported version); an inline hand-rolled stub is banned. Use
  the real `AsyncContent`, not a fragment with `if (isLoading) …` — only then is the DOM tree honest
  and only then can a part show its badge.
- **Each part carries a `tier`** (`block` / `design` / `primitive`). Two or more elements in the
  SAME role become ONE GROUP — `ButtonGroup · primary + secondary`, not `Button ×2`.
- **A leaf with a different composition gets its own `parts`**; leaves sharing a composition and
  differing only by tone or data share one `*_PARTS` constant. The full `reason` lives on the main
  leaf; the others carry a one-line `note`.
- **How the badge works:** the panel MEASURES `[data-anat-part]` — attached to the real element, or
  to the `inset-0` marker `AnatomyOverlay` emits when `showAnatomy` is on — and then draws the badge,
  so the pill never covers content. The `name` in the spec must MATCH the real part's label or tag
  for the badge to anchor correctly. Hovering focuses the light: unrelated parts dim while the part
  and its ancestors stay lit, the badge lifts, and the legend row highlights.

## 11. Verification is `tsc` plus `eslint`, not a browser

A story is declarative code. After adding or editing one, run `tsc --noEmit` and
`eslint --max-warnings=0` on the files you touched. Do not drive Storybook through a browser to
"verify" — it is slow and it is not this lane's job; the UI is reviewed by eye in the already-open
Storybook, where HMR applies the change. A story must be clean: no unused imports, no `any`,
4-space, double-quote, no semicolons.

## 12. Tests — smoke (`test-runner`), Chromatic, and axe; `play` ONLY for interaction

Do **not** write cross-product tests for a presentational primitive. That is over-engineering: large
boilerplate multiplied across many primitives, asserting Tailwind classes that Chromatic already
catches. Regression in a static primitive is VISUAL, and Chromatic owns it. The sufficient set is:

- **`test-runner` smoke** (`@storybook/test-runner`, Playwright): runs EVERY story automatically and
  fails on a crash or a non-render. It enforces coverage **without writing any `play`**. Needs
  Storybook running plus a one-time `npx playwright install chromium`; then `npm run test-storybook`.
- **Chromatic**: a visual regression snapshot per story, which catches "changed a prop mapping →
  it looks different" in size, colour, or layout.
- **axe** (`@storybook/addon-a11y`): accessibility, failing on error.
- **`play` (`storybook/test`)**: written ONLY when there is real interactive BEHAVIOUR to assert —
  click into `onPress`, opening or closing an overlay, validating a form (the anchor case is
  `PriceTag`'s play opening a dialog). Never for asserting the size or count of a static primitive.

So: a story presents states (variants, sizes, loading) for review by eye; regression is Chromatic
plus smoke; behaviour is `play` where it is genuinely needed. Do not breed a cross-product
`⚙ Test` story.

## Related

- [[imports-and-format]] — 4-space, double-quote, no semicolons, import order; all of it applies to
  stories too.
- [[loading-and-skeleton]] and [[async-data]] — mirror-shape skeletons and the async wrapper, the
  source of §7 and §10.
- [[props-and-types]] and [[type-safety]] — `WithClassNames` and the no-`any` rule for the component
  a story demonstrates.
- `src/components/blocks/async/AsyncContent` — the real state switch that §10 renders through.
