# Hover style matches what the target IS — STRICT

[[interactive-needs-hover]] says every interactive element must have a hover state. This file says
which KIND of hover, because one hover style for everything is wrong in a way that reads as a bug: a
navigation row that fills its background looks like a thing you are selecting rather than a thing you
are leaving for. Material's state-layer model draws the same line — a hover layer tints a *container*
you are acting on in place, while a link announces its target by changing the text itself.

The classifying question is **does this action GO THERE (navigate away) or STAY HERE (open or select
in place)?** — plus, what is the target made of? That gives three modes.

## 1. Go-there — a navigation link underlines its TITLE, it does not fill

`group-hover:underline` on the label, and no background fill. This covers both a plain text link (an
article headline, a document title) and a **whole-row click that navigates** — a list row where
clicking anywhere opens that record's page. A row being fully clickable does not make it a selectable
surface; it makes it one large link, so it underlines its label, and the row itself carries the
`group` with no background tint.

The underline is also the accessible form. WCAG 1.4.1 forbids colour as the only carrier of meaning,
and Nielsen Norman's link guidance treats the underline as the one link signal readers recognise
without having to be taught it.

The trap: "the whole row is clickable" reads as "so it should fill". Ask where the click LANDS
instead. Anything that leaves for another page is mode 1, however large its hit area.

## 2. Identity — avatar plus name fades as ONE unit

A person cluster (avatar plus name, linking to a profile) uses opacity — not underline, not fill:

```tsx
<Link className="text-foreground no-underline transition-opacity hover:opacity-60">
  <Avatar … />
  <span>{name}</span>   {/* plain span, not a separately styled link */}
</Link>
```

Opacity is the only effect that dims BOTH halves evenly. An underline reaches the text and leaves the
avatar untouched, which looks broken; filling the row is mode 3 and says the wrong thing. Note the
explicit `text-foreground no-underline`: most component libraries ship a `Link` primitive that
defaults to a coloured, underlining style, and an identity cluster must not read as a permanently
coloured link sitting inside otherwise ordinary text.

## 3. Stay-here — accordion and in-place select fill the background

`hover:bg-default`, the surface skin of a container that opens or selects without navigating.
Reserved for an accordion trigger and for a row that selects in place — picking one shipping method
out of three, choosing which account to act as. The fill is the promise that the surface you are
looking at is the surface you will still be looking at afterwards, which is exactly why it must not
appear on a row that is about to replace the page.

## Where the choice lives in code

The list-row component takes a **`hover: "fill" | "underline"`** prop, defaulting to `fill`.
`underline` turns the row into a `group` with no fill and lets the caller apply `group-hover:underline`
to its own title; `fill` applies `hover:bg-default`. The row owns the style, the feature picks the
mode. Leaving the choice to each call site is how a screen ends up with three hovers meaning the same
thing.

## The three modes on one screen

An activity feed: each entry's headline is a navigation row, so it underlines its title and stays
untinted. The author chip beside the timestamp is an identity cluster, so it fades as a unit. The
filter panel above the feed is an accordion, so its trigger fills. A reader who has used the screen
twice can predict where a click will land before making it — which is the whole return on keeping the
modes separate.
