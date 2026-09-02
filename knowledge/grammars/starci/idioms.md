# StarCi Core — idioms

An idiom is a composition StarCi reaches for again: a recurring way of putting published Grammar
renderers together that the owner has already chosen more than once. This file is taste, not law.
Universal law lives in [knowledge/ui](../../ui/INDEX.md); what each renderer is and owns lives in
[DNA](DNA.md), generated from the package. Nothing here re-narrates renderer anatomy, and nothing
here tells anyone to go looking for inspiration: a direction is composed from these idioms plus the
business shape, and a reference, when the request supplies one, is read through them.

Promotion has one bar: at least two occurrences in the evidence blocks — starci
`src/components/blocks/dashboard/*` and `src/components/blocks/commerce/ProSubscriptionBlock`, and
nivo `apps/app/src/components/blocks/auth/AuthenticationPanel`. A composition seen once is recorded
at the bottom and never composed from. Where the owner has already written down the intent, that
sentence is quoted from the block's own `classNames.ts`, because it is the owner's word on why the
shape exists. Every composition cell names only renderers and props the package publishes.

## Joined bands in one flush card

One card, no inner cards: the body is flush, and horizontal rules alone divide it into bands.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| A dashboard section holds two or more kinds of content that belong to one heading | `SurfaceCard label composition="joined"` around one app `flex flex-col` body whose children are the bands; the card owns the outer boundary and clipping, the app owns `border-t border-separator` between bands | 10 dashboard blocks: `ChangelogList`, `ContinueLearning`, `DailyQuest`, `FeedExplorer`, `JobReadinessWidget`, `OverviewContributions`, `StreakStrip`, `TrendingContents`, `WeeklyChallengeCard`, `WeeklyGoals`. Owner: "Stack full-bleed bands inside one bounded dashboard surface", "Separate stacked dashboard bands without inventing extra vertical space" (`blocks/dashboard/classNames.ts`) |
| A band is a list of peers | An app `ul`/`div` with `m-0 list-none p-0 divide-y divide-separator`; each row `px-4 pt-3 pb-3 last:pb-4`, so the inset is constant and only the outer bottom edge grows | `ChangelogList`, `DailyQuest` tasks, `JobReadinessWidget` pillars, `WeeklyChallengeCard` finishers, `MyCoursesProgress`, `RecommendedCourses`, commerce benefit grid. Owner: "One divided row inside a flush dashboard list: px-4 always; pb-4 only on the bottom edge" (`blocks/dashboard/classNames.ts`) |
| An explanatory page section carries prose, art, and a list | Same card, the three as successive bands rather than three cards | `ProSubscriptionBlock` benefits card: intro band, journey band, benefit grid inside one `SurfaceCard label composition={"joined"}` |

## A neutral band opens the card with its summary

The card's one-line answer sits first, on the secondary surface, and is separated from the evidence
below it — a summary, never a verdict.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| A card states a measure before it shows the evidence for it | App band `bg-surface-secondary text-foreground px-4 pt-4 pb-3` as the first child of the joined card, then `border-t border-separator` | `JobReadinessWidget` headline, `WeeklyGoals` summary, `WeeklyChallengeCard` countdown, `ProSubscriptionBlock` benefits intro |
| The band sits between two separators rather than at the top | The same treatment at `px-4 py-3` | `DailyQuest` reward band. Owner: "Neutral band between separators: px-4 always; p-3 on both separator sides vertically" (`blocks/dashboard/classNames.ts`) |
| The summary is a proven outcome, not a pending promise | Only then does the band take a state colour; an unclaimed promise stays neutral | Owner: "Keep an unclaimed promise neutral; only a proven claimed outcome receives success" (`DailyQuest/classNames.ts`); "Present weekly progress as a neutral summary rather than a state outcome" (`WeeklyGoals/classNames.ts`); [TRUTH-1..4](../../ui/proof/render-truth.md) |

## The card's one action closes the bottom band

A card has at most one onward action, and it lives in its own band against the card's bottom edge —
never floating inside the content.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| A card offers one way onward | App band `border-t border-separator px-4 pb-4 pt-3` as the last child, holding one `Button` or `TextAction` | `JobReadinessWidget`, `StreakStrip`, `WeeklyChallengeCard`, `WeeklyGoals`. Owner: "Keep a card's lone action separated at the bottom edge" (`blocks/dashboard/classNames.ts`) |
| The action is a purchase and must survive a narrow viewport | The same band with `grid grid-cols-1 gap-2`, the `Button variant="primary"` stretched to the band width, and an optional `Text size="xs" tone="muted"` under it | `ProSubscriptionBlock`. Owner: "Full-bleed divider and inset action content for the purchase boundary" (`ProSubscriptionBlock/classNames.ts`) |

## Generated art is a band, not a card

Generated imagery earns a band inside the surface it belongs to. It never becomes a second card, and
it never gets an inset frame that letterboxes it.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| The asset is the point of the section | Its own full-bleed band inside the joined card: `border-t border-separator` above, no inset, and an image at `block h-auto w-full` so the generated ratio survives | `ProSubscriptionBlock` journey band. Owner: "The generated journey is its own edge-to-edge joined band; the SurfaceCard owns outer clipping" and "Preserve the generated asset ratio without an inset frame or letterbox" (`ProSubscriptionBlock/classNames.ts`) |
| The asset is decorative reward or discovery art | `MediaFrame aspect="landscape" fit="contain" treatment="plain"` inside an app band on `bg-accent-soft`, or an accent slab with the art anchored to its trailing edge and `alt=""`/`aria-hidden` | `TrendingContents` media panel — owner: "Keep generated discovery media prominent without becoming a separate card"; `DailyQuest` hero — owner: "The generated quest illustration stays decorative on the hero's trailing edge" |

## Title and one supporting line

Two lines, tightly stacked: what the thing is called, then one muted line that qualifies it. It is
the most repeated relationship in the whole surface set.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| Inside a row or cell, where the title is not document structure | `Text size="sm" weight="semibold"` then `Text size="xs" tone="muted"`, stacked at [GAP-1](../../ui/presentation/gap.md) | Dashboard rows and the commerce benefit rows. Owner: "Title and explanation stack for one outcome" (`ProSubscriptionBlock/classNames.ts`) |
| The title is the surface's own name | `Heading` then `Text size="sm" tone="muted"` | nivo `AuthenticationPanel` header and its notice tree. Owner: "Title and subtitle stay visually coupled" (`AuthenticationPanel/classNames.ts`) |
| The qualifier belongs above the title | `Text size="xs" tone="muted"` first, then `Text size="md" weight="semibold"` | `ContinueLearning`. Owner: "Keep the supporting kind close to the destination title it qualifies" |
| Grammar should own the pair | `SurfaceCopyGroup` — the one renderer published for this rhythm | `ProSubscriptionBlock` purchase status |

Counted once per container across the evidence blocks, this pair occurs eight times, seven of them
hand-built with an app `div`; the inventory and the proposal to give `SurfaceCopyGroup` typed slots
are in [audits/1.0.1/proposals/copy-group-composite.md](../../../audits/1.0.1/proposals/copy-group-composite.md).

## Pending is the same tree, resting

A loading surface is the finished surface with its content at rest — same card, same bands, same row
count. It is never a spinner and never a different tree.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| The block is waiting for its data | `SurfaceCard state={loading ? "pending" : "neutral"}`, a fixed-length array of resting items in place of the real ones, and `isSkeleton` on every `Text` and `Heading` inside | `ChangelogList`, `ContinueLearning`, `DailyQuest`, `JobReadinessWidget`, `OverviewContributions`, `StreakStrip`, `WeeklyChallengeCard`, `WeeklyGoals`, `ProSubscriptionBlock` |
| An action exists but must not fire yet | The same tree with `Button isDisabled` rather than a removed button, so the layout does not move when data lands | `ProSubscriptionBlock` purchase action |
| The block has no data at all, or the read failed | A different tree: `SurfaceCard composition="single"` around one `EmptyNotice` with `message`, optional `actionLabel`, and `iconSource` — empty and failed are states, not a resting variant | `ContinueLearning`, `DailyQuest`, `TrendingContents`; [STATE-1](../../ui/composition/state.md) |

## One highlighted card

At most one card in a view wears `isHighlight`, and it is the one thing the reader is meant to do
next. Highlight is a claim about the task, not decoration.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| Peers are shown together but one is the intended next step | `SurfaceCard isHighlight={true}` on that one card only; peers keep the same props otherwise, so the difference reads as rank rather than as a different component | `ContinueLearning`, where only the first resume item is highlighted — owner: "The first resumable item is the focal task; later items remain useful but quieter" |
| The view exists to close one decision | The decision card is the highlighted one and sits in the rail of `PrimaryRailLayout`; everything explanatory stays unhighlighted in `primary` | `ProSubscriptionBlock` plan rail |

## Single-column form stack

Fields, then the status sentence, then one primary submit — one column, one submit, in that order.

| Use when | Grammar composition | Evidence |
| --- | --- | --- |
| A step asks for credentials or a code | An app `form` around `flex flex-col gap-4`: `Input` per field with `label`, `placeholder`, `hint`, `errorMessage`, `isError`, `isDisabled`; then the status `Text size="sm" tone="muted" live` (`assertive` for a refusal, `polite` otherwise); then one `Button variant="primary" type="submit" isPending` | nivo `AuthenticationPanel`, both the `details` and `code` steps. Owner: "Credentials and their submit controls form one semantic unit" (`AuthenticationPanel/classNames.ts`) |
| Secondary ways onward exist | They follow the form as `TextAction size="sm"` in a wrapping row, never as a second `Button variant="primary"` | `AuthenticationPanel` resend/back row and its footer prompt. Owner: "Secondary text actions wrap cleanly instead of overflowing" |

## Seen once, not yet an idiom

Recorded so nobody re-derives them as if they were house style, and so a second occurrence can
promote them. A direction may not compose from this table; a request that needs one of these shapes
is a choice for the owner.

| Composition | Where | What a second occurrence would settle |
| --- | --- | --- |
| Priced decision rail: `Heading level={2}` beside `Badge tone="accent"`, then price and period as one labelled fact, then the bottom action band | `ProSubscriptionBlock` plan | Whether the price/period pair is the house way to state a recurring charge |
| `SurfaceAccordionCard depth="top"` carrying secondary explanation with no card of its own around it | `ProSubscriptionBlock` disclosures | Whether disclosure is the house answer for content that must be present but not read |
| Orientation stack before the first band: breadcrumb, then `SectionHeader composition="context-intro" level={1}`, inside a `max-w-3xl` column | `ProSubscriptionBlock` | Whether a route opens with orientation rather than with its first surface |
| Provider shortcut above a labelled `Divider`, before the credential form | nivo `AuthenticationPanel` | Whether the shortcut always precedes the form |
| A leading `IconTile` beside a copy block | `ContinueLearning` | Whether identity art belongs beside copy or above it |

The owner's own proposal records one further shape — a muted supporting line followed by an action —
at two instances and declines to promote it ("Two instances are not a pattern yet; it stays
app-owned"). It stays out of this file until the owner says otherwise.
