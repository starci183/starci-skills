# block — in a real system

Where the domain starts — and where the boundary takes the most pressure.

The rule is in [`../elements/block.md`](../elements/block.md). This is one system obeying it,
named so every row can be checked.

Blocks group by **domain area**, the first place in the tree where a folder may be named after the
business: `learn` · `dashboard` · `commerce` · `navigation` · `profile` · `consultant` · `ai`.

One area holding most of the tier is normal — that is where the product is.

## Representative rows

| Component | Renders | Why this tier |
|---|---|---|
| `ContinueLearning` | the next thing to resume, or an empty state | owns an entity and its empty case |
| `DailyQuest` | today's tasks with their progress | domain data plus the async switch |
| `ChallengeBrief` | a challenge's statement and hint | an entity; the hint's shell is chosen from the matrix, not invented |
| `ChallengeDeliverableList` | what must be produced, with pass marks | read-only rows carrying a verdict |
| `ModuleLessonList` | lessons in a module with progress | an entity list, not a shape |
| `PriceTag` | a price with its breakdown | commerce entity; the popover it opens is an atom |
| `TrialConversionStrip` | the nudge to convert, or nothing | owns the decision to render at all |
| `QuotaBar` | how much of an allowance is used | the *bar* is a composite; the allowance is the block |
| `Navbar` · `Footer` · `CollapsibleSidebar` | the app's own navigation | they know the product's routes — that is domain |
| `ProfileHero` | a profile's identity band | an entity |
| `ProfileLoadingState` · `ProfileNotFoundState` | one profile's async holes | the *decision*; the holes themselves come from `AsyncContent` |
| `ConsultantDirectoryGrid` | consultants as a grid | entity list; the grid is a frame |

## What a block owns that nothing below it can

The async switch: **error, then loading, then empty, then content** — decided once, inside the
block. A screen that writes that if-else in a different order renders a stale error on a background
refetch, or hides a real error behind a spinner.

Nothing below this tier is allowed to know a request exists, so the decision has exactly one place
it can live.

## Where the pressure shows

| Strain | What it looks like | Why it matters |
|---|---|---|
| loose fields | `title`, `subtitle`, `value`, `max`, `meta`, `timeLeft` instead of one entity | every caller unpacks it slightly differently |
| `className` accepted | the caller can restyle the block | one entity ends up looking different on two screens |
| vendor component imported | a shape taken straight from the library | each one is a missing atom |

None of that is fatal, and all of it is countable — which is the point. A tier's health can be
tracked as a number that should fall, instead of argued about.

---

Read from a live tree with `scripts/audit/scan-storybook-architecture.mjs`. Another repo answers with
different names, and its answer outranks this file.
