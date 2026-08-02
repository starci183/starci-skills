# Hover style matches what the target IS — STRICT

[[interactive-needs-hover]] says every interactive element must have a hover state. This file says
which KIND of hover, because one hover style for everything is wrong in a way that reads as a bug:
a navigation row that fills its background looks like a thing you are selecting rather than a thing
you are leaving for.

The classifying question is **does this action GO THERE (navigate away) or STAY HERE (open or select
in place)?** — plus, what is the target made of? That gives three modes.

## 1. Go-there — a navigation link underlines its TITLE, it does not fill

`group-hover:underline` on the label; no background fill. This covers both a plain text link
("Nổi bật tuần này", a post title) and a **whole-row click that navigates** — a course row where
clicking anywhere in the row opens the course page. A row being fully clickable does not make it a
selectable surface; it makes it one large link, so it underlines its label and the row is wrapped in
`group`, with no background tint.

The trap: "the whole row is clickable" reads as "so it should fill". Ask where the click LANDS
instead. Navigating to another page is mode 1. Course, lesson and post rows are all navigation, so
all three underline.

## 2. User identity — avatar plus name fades as ONE unit

A user cluster (avatar + name, linking to a profile) uses opacity, not underline and not fill:

```tsx
// TopLearners — mirrors the canonical identity in reuseable/LeagueRow
<Link className="text-foreground no-underline transition-opacity hover:opacity-60">
  <Avatar … />
  <span>{name}</span>   {/* plain span, not a styled link */}
</Link>
```

Opacity is the only effect that dims BOTH halves evenly. Underline reaches the text and leaves the
avatar untouched, which looks broken; filling the row is mode 3 and says the wrong thing. Note the
explicit `text-foreground no-underline`: HeroUI `Link` defaults to `text-link` plus an underline on
hover, and identity clusters must not read as a coloured, permanently underlined link.

## 3. Stay-here — accordion and in-place select fill the background

`hover:bg-default`, the accordion surface skin. Reserved for an accordion trigger (open/collapse) or
a row that carries the accordion skin and selects in place without leaving the surface — the payment
method row picking a gateway. Ruling, 2026-06-25: *"hover bg đổi màu chỉ áp dụng cho accordion
thôi"* — background fill is the accordion's privilege and is not used on navigation rows.

## Where the choice lives in code

`SurfaceListCardItem` / `SurfaceListCardRow` take a **`hover: "fill" | "underline"`** prop, default
`fill`. `underline` turns the row into a `group` with no fill and lets the feature apply
`group-hover:underline` to its own title; `fill` applies `hover:bg-default`. The block owns the
style, the feature picks the mode.

## First applied 2026-06-25

- `TopLearners`: the user `<Link>` became
  `text-foreground no-underline transition-opacity hover:opacity-60` with the name as a plain
  `<span>`, mirroring `LeagueRow`.
- `CourseRow` (dashboard, Khóa học): `SurfaceListCardItem hover="underline"` plus
  `group-hover:underline` on the title, dropping the fill.
- Trending title is mode 1 (underline); the payment method row is mode 3 (fill, select in place).
