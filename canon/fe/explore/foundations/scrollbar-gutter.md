# Scrollbar gutter — killing the jitter

Settled 2026-06-25. Two CSS declarations that stop the vertical scrollbar flickering in and out, and
stop centred content sliding sideways every time it does.

## 1. The rule (STRICT)

`globals.css` declares, once, immediately after the `@import`:

```css
html { overflow-y: scroll; scrollbar-gutter: stable; }
```

- `overflow-y: scroll` means the document ALWAYS has a vertical scrollbar, so it never appears and
  disappears — that is what removes the flicker. It also pins `html` as the scroll container,
  ending the ambiguity about whether `html` or `body` is the scroller.
- `scrollbar-gutter: stable` reserves the scrollbar's space in advance, so `mx-auto` content stops
  shifting horizontally. It also behaves under OS overlay scrollbars and while a modal has scroll
  locked.

## 2. Why it happened

The learn page has a left rail at `h-[calc(100dvh-4rem)]`, so with the 4rem navbar the document is
EXACTLY about 100dvh tall. Sub-pixel reflow tips it either side of that line, the scrollbar toggles,
and each toggle both flickers and pushes centred content roughly 15px sideways. Short pages —
leaderboard, the flashcards overview — showed it most clearly, because they have the least content
to absorb the difference.

## 3. `scrollbar-gutter: stable` alone is NOT enough

It only prevents the horizontal shift. If the symptom is the scrollbar itself flickering in and out,
`overflow-y: scroll` is the half that fixes it, by keeping the bar permanently present. Trying
`scrollbar-gutter` on its own left the jitter exactly as it was; adding `overflow-y: scroll` ended
it.

## 4. This is a LAYOUT bug, not a render bug

Before touching CSS, the two overview components (`DueReviewHero`, `FlashcardStatsStrip`) and the
meter blocks (`ProgressMeter`, `SegmentBar`) were confirmed static — no effect, no measurement, no
transition loop — which ruled out a re-render or a skeleton or an animation as the cause. Suspect
a bug before redesigning: [[heatmap-trong-la-bug-token-khong-redesign]].

Do not hand-roll a `padding-right: <scrollbar-width>` hack. `overflow-y: scroll` plus
`scrollbar-gutter: stable` is the standard answer and needs no measurement.

## First applied 2026-06-25

`globals.css`: `html { overflow-y: scroll; scrollbar-gutter: stable; }`. The reported symptom was
the leaderboard and flashcards review pages "juddering"; the cause was the 100dvh rail making the
scrollbar flicker, not a re-render.

A global change to `html` needs a HARD refresh (Ctrl+Shift+R) to take effect — HMR routinely misses
rules at the `html` level.
