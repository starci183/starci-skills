# Accent: four roles, one channel per element

Accent is the StarCi pink. It is a **signal, not decoration**: a screen carries accent at a few
points only, in the 60-30-10 proportion, and everywhere outside the four roles below carries none.

Two rules ride on top of that, and they are the ones that actually get broken:

- **One element uses exactly ONE accent channel** — background OR text OR icon OR border, never
  three at once. The channel is chosen from the table in §3, not by taste.
- **Accent never encodes STATUS.** Done, locked and error are semantic colours (success, muted,
  danger). Accent is reserved for "selected", "go next", "mine", and the primary call to action.

This file absorbed `highlight-accent-as-detail-not-block-fill` on **2026-07-07**, so the rule
"accent is a seasoning, not a block fill" lives here rather than in its own file.

The split below was forced by a real confusion, ruled on **2026-06-30**: the same meaning —
"currently selected / current" — was rendered three different ways in one product. Full text accent
in the sidebar, accent icon with foreground text in the body path, plain text accent in the table of
contents. Three spellings of one word. External support for the same position: Material 3 says not
to use accent for status (`m3.material.io/styles/color/roles`), and ux4sight's accent-colour piece
argues the sparing-use case.

## 1. The four roles that may carry accent

| Role | Example |
|---|---|
| Primary call to action | "Tiếp tục học", "Đăng ký" — one primary per surface |
| Selected view | the open nav, tab or sidebar item; the category currently filtering |
| Brand | the logo, one word of a hero line |
| Mine / the emphasised value | "hạng của tôi", "XP của tôi" inside a list |

## 2. The discriminator: "selected" is not "status"

**SELECTED** means *I clicked this, and it is the view or filter now open*. **STATUS** means *this
is the state of a piece of content* — done, current, locked. They render differently:

- **Selected** — a persistent selection: a nav row, a tab, a sidebar entry, a category, a radio
  card. Render **tonal**: `bg-accent/10` with the label **and** icon both in accent.
- **Status** — a transient state inside a progress list: the lesson being studied, the current
  step. Only the **icon** carries colour; the text stays `foreground`; the row background stays
  untinted. Current is accent, done is success green, todo and locked are muted.

The question that decides an unfamiliar case: is this element *a view I chose to open* (tonal), or
*the state of one item in a list* (icon only)?

**Why.** Tint plus accent icon plus accent text on a status row reads as "a nav item is selected",
while the done and todo rows in the same list are speaking a different colour language — one list,
two vocabularies. Letting the icon carry the colour leaves the row transparent, so the list stays
clean and the single accent point is the one place the reader should resume.

## 3. The six canonical channels

| Element / state | Where the accent goes | Not allowed |
|---|---|---|
| Primary CTA | **solid** `bg-accent` with white text and icon (`--accent-foreground`) | tint, `text-accent` |
| Nav / tab / sidebar, selected | `bg-accent/10` with label **and** icon in accent (tonal) | icon only, text only |
| Active item in a text list (table of contents, current breadcrumb, milestone index) | `text-accent` alone | tint, icon |
| "Current" status in a progress list | accent **icon only**, text `foreground` | tinting the row |
| Progress / meter | fill `bg-accent` on a `bg-default` track | accent text |
| The "mine" card or row in a list | `ring-accent` or `border-accent` plus **one small detail** (an accent value or chip), background `bg-surface` | `bg-accent/10..15` across the whole block |

## 4. Status is semantic

- Done is `text-success` (green) with `CheckCircleIcon`, never accent.
- Locked, todo and not-yet-reached are `text-muted`, with a Lock or Circle icon.
- Error and disabled are `text-danger` with `WarningCircleIcon` — and disabled is a different icon
  from locked, because they are different reasons.
- Accent appears in a status list at exactly one point: the "current / go next" item, as a single
  icon. That is the resume point.

## 5. What this forbids

- **Accent flood** — `bg-accent/5` through `/15` on a large block, section, card, thumbnail or
  podium base. Accent is a small detail (icon, chip, value, border), not an area fill; block
  backgrounds are `bg-surface` or `bg-default`. A small bounded thing that is genuinely *selected*
  — one chip, one radio card — may take a `/10` tint, because it is still a small patch.
- **Three channels for one meaning** — ring plus text plus tint all saying "mine". Pick one: the
  ring plus a single accent value.
- **Status tint** — `bg-accent/10` on a current or in-progress row, which disguises status as
  selection.
- **Accent for done**, which must be success green.
- **Decorative accent** on a static, non-interactive label or icon, applied only to look nice.
- **Solid accent on hover** for an ordinary row. Hover is `bg-default` or a `/10` tint, not a solid
  `bg-accent` — except an active pager control, which is solid by design.

## 6. Implementation

CTA: `Button variant="primary"`. Selected nav: `bg-accent/10` plus `text-accent` on both label and
icon. Inline active: `text-accent`. Current status: `<Icon className="text-accent"/>` with
foreground text and a transparent row. Progress: `bg-accent` fill over `bg-default`. Mine:
`ring-2 ring-accent` or `border-accent` plus an accent value, on `bg-surface`.

Ring opacity stays on one rung. Do not distinguish states by scattering `/25 /30 /35 /50`: selected
is `ring-accent`, current is a `/10` tint plus an icon. The difference between selected and current
is carried by the **channel**, not by opacity.

## First applied 2026-06-30 — audit of 181 files

Most of the app was already correct. Exemplars: `ContentMapRow`, `SidebarNavItem`, `OnThisPage`,
`LeaderboardCategoryRail`, `FlashcardStudyRail`, `FlexWrapCardRadio`.

The violations fell into four groups:

- **Status tint.** `CourseContents` L322 and `PersonalProjectDashboard` L279 — drop `bg-accent/10`
  from the current row ("Đi tiếp lộ trình") and keep the accent play icon with foreground text, so
  the sidebar (tonal selection) and the body (icon-only status) stop contradicting each other.
- **Accent flood.** `FoundationItemThumbnail` L37 and `FoundationCategoryThumbnail` L39
  (`bg-accent/10` card background becomes `bg-default`); `UpcomingLivestreamCard` L116
  (`bg-accent/5` removed); `TrackLadder` L47 (`bg-accent/5` replaced by `border-accent/40` alone);
  `LeaderboardPodium` L75 (the `bg-accent/15` base fill removed).
- **Three spellings of "mine" on the leaderboard, collapsed to one:** an `ring-accent` avatar plus
  an accent XP value, with no large fill. `LeaderboardPodium` and `LeaderboardChampion` were
  changed to match `LeaderboardTable`.
- **Low severity.** `MindMap` has inconsistent ring opacity on the canvas. `StreakStrip` L97 uses
  `bg-accent/80`, kept, because a heatmap cell is a meter. `FlashcardDeckList` L226 is an active
  pager and solid by design — a false positive.
