# Proposal — one composite for the repeated "title + supporting line" pair

Status: proposal only, 2026-09-02. Nothing below is implemented. Owner decides.

## The evidence

Counted inside app-owned containers of the three authorized surfaces (starci `blocks/dashboard/*`,
`blocks/commerce/ProSubscriptionBlock`, nivo `blocks/auth/AuthenticationPanel` and the authentication
page), one container at a time, two or three Grammar leaves per container:

| Shape | Count | Where |
| --- | --- | --- |
| `Text size="sm" weight="semibold"` then `Text size="xs" tone="muted"` | 2 | dashboard, commerce |
| `Heading` then `Text size="sm" tone="muted"` | 2 | auth |
| `Heading` then `Text tone="muted"` | 1 | commerce |
| `Text size="sm" weight="normal"` then `Text size="xs" tone="muted"` | 1 | dashboard |
| `Text size="xs" tone="muted"` above `Text size="md" weight="semibold"` (qualifier first) | 1 | dashboard `ContinueLearning` |
| `SurfaceCopyGroup` wrapping `Text weight="semibold"` + `Text size="sm" tone="muted"` | 1 | commerce |

Eight occurrences of one relationship: a title line and one supporting line in `TONE-2`, stacked at
`GAP-1` or `GAP-2`. Seven of the eight are hand-built with a `div` the application owns. The
knowledge already names the gap: `gap.md` GAP-1 Case 1 and Case 2 carry owner `—` ("Common exposes no
public path"), and the `fe.presentation.resolve` dry run on `ContinueLearning` stopped with
`RULE_MISSING` on exactly this pair.

## The proposal

Do not add a leaf. `SurfaceCopyGroup` already exists for this relationship, has one use, and today
accepts free children and a `density` of `compact` (`.5rem`) or `comfortable` (`.75rem`). Make it the
owner:

- Slots instead of children: `title` (required), `description` (optional), `eyebrow` (optional, the
  qualifier that sits above the title). Only shells expose `children`; a composite projects typed
  slots.
- `density`: add `tight` (`.25rem`, GAP-1) beside `compact` (GAP-2) and `comfortable` (GAP-3).
- Fixed typography per slot, drawn from the font and tone scales: `eyebrow` = `Text size="xs"`
  (FONT-1, resolves TONE-2); `description` = `Text size="sm" tone="muted"` (FONT-2, TONE-2) or
  `size="xs"` when `density="tight"`; `title` = `Text size="sm" weight="semibold"` (FONT-2) by
  default, or a `Heading` at the given level when the title is document structure (`heading={2|3}`).
- `isSkeleton` passes through to every slot.

Knowledge changes that follow, none of them new law: `gap.md` GAP-1 Case 1 and 2 owner `—` →
`SurfaceCopyGroup density="tight"`; the "Gaps Common already owns" row gains `.25rem` → GAP-1;
`font.md` and `tone.md` "Common already owns" rows name the three slots. The `ContinueLearning` dry
run then resolves its identity pair to `owner: grammar`.

## What this does not decide

- The "supporting line + action" stack (`Text muted` then `TextAction`/`Button`) appears twice (auth,
  dashboard). Two instances are not a pattern yet; it stays app-owned.
- The leading `IconTile` beside a copy block appears once. Same.
- Migration of the eight call sites (six in starci, two in nivo) is the "apply to the apps" step and
  runs through `fe.presentation.resolve` → `fe.source.apply`, not by hand.

## Cost and risk

One component, one CSS density step, one spec, two knowledge tables, eight call sites. The risk is a
title that is semantically a heading being rendered as `Text`; the `heading` prop exists for that,
and the audit's A11Y rules catch a missing outline level.
