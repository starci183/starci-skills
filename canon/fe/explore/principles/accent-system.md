# Accent: four roles, one channel per element

Accent is the one high-chroma colour a product owns. It is a **signal, not decoration**: a screen
carries accent at a few points only, in the 60-30-10 proportion, and everywhere outside the four
roles below carries none.

Two rules ride on top of that, and they are the ones that actually get broken:

- **One element uses exactly ONE accent channel** — background OR text OR icon OR border, never
  three at once. The channel is chosen from the table in §3, not by taste.
- **Accent never encodes STATUS.** Done, locked and error are semantic colours (success, muted,
  danger). Accent is reserved for "selected", "go next", "mine", and the primary call to action.

Material 3 states the same separation in its colour-role model: status belongs to the semantic
roles, and the primary role belongs to the one action the surface wants taken
(`m3.material.io/styles/color/roles`). Refactoring UI arrives there from the other direction — a
palette earns its emphasis by being spent rarely — and the 60-30-10 split is the practical
expression of that.

## Why the two rules exist

The failure they prevent is one meaning rendered several ways in the same product. A settings
application can easily end up spelling "currently selected" three times: full accent text in the
left navigation, an accent icon with neutral text in the body, plain accent text in the table of
contents of a documentation panel. Three spellings of one word, and the reader has to learn each
surface separately rather than learning the product once.

## 1. The four roles that may carry accent

| Role | Example |
|---|---|
| Primary call to action | "Place order", "Start free trial" — one primary per surface |
| Selected view | the open navigation row, tab or sidebar item; the facet currently filtering a table |
| Brand | the logo, one word of a hero line |
| Mine / the emphasised value | the viewer's own row inside a shared list |

## 2. The discriminator: "selected" is not "status"

**SELECTED** means *I clicked this, and it is the view or filter now open*. **STATUS** means *this
is the state of a piece of content* — done, current, locked. They render differently:

- **Selected** — a persistent selection: a navigation row, a tab, a sidebar entry, a facet, a radio
  card. Render **tonal**: `bg-accent/10` with the label **and** icon both in accent.
- **Status** — a transient state inside a progress list: the step being worked on, the record now
  syncing. Only the **icon** carries colour; the text stays `foreground`; the row background stays
  untinted. Current is accent, done is success green, todo and locked are muted.

The question that decides an unfamiliar case: is this element *a view I chose to open* (tonal), or
*the state of one item in a list* (icon only)?

**Why.** Tint plus accent icon plus accent text on a status row reads as "a navigation item is
selected", while the done and todo rows in the same list are speaking a different colour language —
one list, two vocabularies. Letting the icon carry the colour leaves the row transparent, so the
list stays clean and the single accent point is the one place the reader should pick up again.

## 3. The six canonical channels

| Element / state | Where the accent goes | Not allowed |
|---|---|---|
| Primary CTA | **solid** `bg-accent` with the accent-foreground text and icon | tint, `text-accent` |
| Navigation, tab or sidebar, selected | `bg-accent/10` with label **and** icon in accent (tonal) | icon only, text only |
| Active item in a text list (table of contents, current breadcrumb, step index) | `text-accent` alone | tint, icon |
| "Current" status in a progress list | accent **icon only**, text `foreground` | tinting the row |
| Progress or meter | fill `bg-accent` on a `bg-default` track | accent text |
| The viewer's own card or row in a list | `ring-accent` or `border-accent` plus **one small detail** (an accent value or chip), background `bg-surface` | `bg-accent/10..15` across the whole block |

## 4. Status is semantic

- Done is `text-success` with a check icon, never accent.
- Locked, todo and not-yet-reached are `text-muted`, with a lock or empty-circle icon.
- Error and disabled are `text-danger` with a warning icon — and disabled takes a different icon
  from locked, because they are different reasons and WCAG 1.4.1 forbids leaving the difference to
  colour alone.
- Accent appears in a status list at exactly one point: the "current / go next" item, as a single
  icon. That is the place the reader resumes.

## 5. What this forbids

- **Accent flood** — `bg-accent/5` through `/15` on a large block, section, card or thumbnail.
  Accent is a small detail (icon, chip, value, border), not an area fill; block backgrounds are
  `bg-surface` or `bg-default`. A small bounded thing that is genuinely *selected* — one chip, one
  radio card — may take a `/10` tint, because it is still a small patch.
- **Three channels for one meaning** — ring plus text plus tint all saying "mine". Pick one: the
  ring plus a single accent value.
- **Status tint** — `bg-accent/10` on a current or in-progress row, which disguises status as
  selection.
- **Accent for done**, which must be the success colour.
- **Decorative accent** on a static, non-interactive label or icon, applied only to look nice.
- **Solid accent on hover** for an ordinary row. Hover is `bg-default` or a `/10` tint, not a solid
  `bg-accent` — except a control that is genuinely active, such as the current page in a pager,
  which is solid by design.

## 6. Implementation

The primary call to action is the primary button variant. A selected navigation row is
`bg-accent/10` plus `text-accent` on both label and icon. An inline active entry is `text-accent`.
A current status is an accent icon with foreground text on a transparent row. Progress is a
`bg-accent` fill over `bg-default`. The viewer's own row is `ring-2 ring-accent` or `border-accent`
plus one accent value, on `bg-surface`.

Ring opacity stays on one rung. Do not distinguish states by scattering `/25 /30 /35 /50`: selected
is `ring-accent`, current is a `/10` tint plus an icon. The difference between selected and current
is carried by the **channel**, not by opacity.

## The four ways this breaks in practice

- **Status tint.** A progress list tints its current row and also puts the label in accent, so the
  same row is spelled the way the sidebar spells a selected view. Drop the tint, keep the accent
  icon and foreground text.
- **Accent flood.** A thumbnail, a card or a podium base takes a `/5` to `/15` accent wash as a
  background. Replace it with the neutral surface, and if the block genuinely needs marking, mark it
  with a border.
- **Several spellings of "mine".** A ranked table that marks the viewer's own row by ringing the
  avatar in one view, tinting the whole card in another, and colouring the name in a third. Collapse
  them to one: the ring plus one accent value.
- **Opacity drift.** Ring opacity varies component by component because each state was given its own
  rung. States are distinguished by channel; opacity stays put.

A meter cell whose fill *is* the value — a density grid, a utilisation bar — is not a violation even
at high opacity, because there the colour is the data.
