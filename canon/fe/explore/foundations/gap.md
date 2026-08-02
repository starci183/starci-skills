# Gap and vertical rhythm

One scale covers all spacing — gap and padding alike. Settled 2026-06-24; it supersedes the earlier
`0 / 2 / 3 / 4 / 6` scale, which had a step at 4 that no longer exists.

## 1. The scale is `0 · 2 · 3 · 6 · 8`

- **`gap-0`** — glued together: a number and its unit, an eyebrow sitting tight against its title.
- **`gap-2`** (8px) — a sub-cluster: title and description, price and its discount chip, icon and
  label, chip and chip. Also **item to item inside a dense list** — the short muted rows of a
  `LabeledList` in a rail ([[list]] §3) sit at `gap-2`. Also **a `<Label>` above a single text
  input** ([[label]] §1b), which is a tight pair by HeroUI's own convention.
- **`gap-3`** (12px) — within one block: label to content (in `LabeledList`, label to list to
  action), rows inside a card, sibling sub-blocks at the same level. Also **a `<Label>` above a
  card, a radio group, or a cluster of controls** — `FlexWrapCardRadio`, `FlexWrapButtonRadio`,
  `SelectableCardGroup` — which need air, and so differ from label-to-single-input at `gap-2`
  ([[label]] §1b).
- **`gap-6`** (24px) — between two regions with different jobs: section to section, the left and
  right halves of a grid. **Only for genuinely large clusters.** Several small components stacked
  vertically — inside a modal, say: a summary, a list of gateways, a link, a trust line — stay at
  `gap-3`. Settled 2026-06-24: three small components read as `gap-3`. The step is chosen by the
  SIZE of the blocks, not merely by "these do different things".
- **`gap-8`** (32px) — a wider separation when a cluster genuinely needs a larger beat.

Anything off the scale — 1, 1.5, 5, 7, 9, 10 — is out, except the two named exceptions below. The
point of a five-step scale is that a reader can tell the relationship between two elements from the
gap alone; a sixth value nobody can name destroys that.

## 2. Two named exceptions

**`PageHeader` to the content below it is `gap-10`** (40px), in the app only. The header cluster
(breadcrumb, title, description, chips) gets a large breath before the page content starts. This is
the only place in the app that uses it.

**On landing and marketing pages, a `SectionHeading` to the content below it is `gap-16`** (64px).
Settled 2026-06-26, correcting a first draft that said `gap-24` — that was too far. Every landing
section has a `SectionHeading` (eyebrow, title, intro) and sits `gap-16` above its content block,
which is the landing breathing rhythm as opposed to the app's `gap-10`. A section with several
content blocks wraps them in `<div className="flex flex-col gap-6">` so that header-to-content stays
`gap-16` while the content's own rhythm stays `gap-6`. Applied on: courses, treasure, founder, faq,
and LearnLoop (both the pinned and static variants).

Note this is header-to-content WITHIN a section; section-to-section on landing uses a larger gap
still ([[landing-marketing-section-spacing-and-editorial-stats]]).

## 3. A divider inside a card or stack takes `gap-3` on both sides

Settled 2026-06-30. When two blocks are separated by a divider (`border-t`) inside one card or
stack, the space above and below the divider is `gap-3` (12px), not `gap-6`. The divider is already
doing the separating; adding 24px on each side reads as a gulf.

The implementation is symmetric: the upper block and the lower block (`border-t pt-3`) are two
children of a `flex flex-col gap-3` container, so the space above the divider comes from the
container and the space below from `pt-3` — 12px on each side. Each block keeps its own internal
rhythm (a control cluster inside one of them may still be `gap-6`); only the band around the divider
is `gap-3`.

Same spirit as [[whitespace-over-dividers]]: prefer whitespace, and if you do use a divider, do not
also pay for a large gap.

## 4. In a vertical stack, `gap-6` DIVIDES and `gap-3` groups

`gap-6` marks the boundary between two regions with different jobs; everything inside one region is
`gap-3`. Spreading `gap-6` evenly over every stacked block leaves the page thin and shapeless;
forcing everything to `gap-3` erases the region boundaries. Group into `gap-3` clusters, then spend
`gap-6` on the one line that actually divides them.

Course home is the worked example. Region A is identity and action — breadcrumb, title, continue
button with progress — internally `gap-3`. Region B is browsing — search, index tree — internally
`gap-3`. Between A and B, `gap-6`.

The "continue learning plus progress" block stays **flat, not wrapped in a `Card`**. It is the
primary action with a meter sitting directly on the page background; wrapping it produces a box
inside a box ([[card]], a card is for a bounded object; and [[design-restraint]]).

The skeleton mirrors the same structure and the same rhythm — `gap-6` dividing, `gap-3` inside — so
nothing shifts when the data lands.

When the page uses the `PageHeader` block, the header separates out on its own terms
(header to content is the named `gap-10` exception) and the continue/progress block is CONTENT,
living inside the `gap-6` cluster. See [[header]] §2.

## 5. Scrolling does not compress the header

While the page scrolls, the header cluster at the top — breadcrumb, title, description, chips —
keeps its gaps unchanged. The content below scrolls; the header's rhythm does not shrink. See
[[sticky]].

## 6. Reading the scale back

Each pair of elements picks one step from the relationship between them: glued (0), sub-cluster (2),
within a block (3), between blocks (6), between wide regions (8), header to content (10).

Card padding is a separate decision, owned by the block rather than by this scale. This file
recorded it as `px-4 py-3`; `globals.css` now bakes `.card { padding: calc(var(--spacing) * 3)
!important }`, so read the card padding rule from its own file before quoting a number here.

Known debt: a few places still use `gap-4` — the pricing card interior among them — which is off the
current scale. Candidates to pull back to 3 or 6; see the debt ledger.
