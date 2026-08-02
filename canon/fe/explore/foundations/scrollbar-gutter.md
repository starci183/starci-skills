# Scrollbar gutter — killing the jitter

Two CSS declarations that stop the vertical scrollbar flickering in and out, and stop centred
content sliding sideways every time it does.

## 1. The rule (STRICT)

Declare once, on the document element:

```css
html { overflow-y: scroll; scrollbar-gutter: stable; }
```

- `overflow-y: scroll` means the document ALWAYS has a vertical scrollbar, so it never appears and
  disappears. That is the half that removes the flicker. It also pins the root as the scroll
  container, ending the perennial ambiguity about whether the document or the body is scrolling.
- `scrollbar-gutter: stable` reserves the scrollbar's space in advance, so horizontally centred
  content stops shifting. It is defined in CSS Overflow Level 3 precisely for this, and it behaves
  correctly under overlay scrollbars and while a dialog has scrolling locked.

## 2. Why it happens

The failure needs a page whose height lands within a pixel or two of the viewport. A full-height
side rail sized against the viewport minus the header does exactly that: with a 64px header and a
rail at `calc(100dvh - 4rem)`, the document is almost exactly one viewport tall. Sub-pixel reflow —
a font swapping in, an image settling, a badge appearing — tips it either side of that line, the
scrollbar toggles, and each toggle both flickers and shoves centred content roughly 15px sideways.

Short pages show it most clearly, because they have the least content to absorb the difference. That
is also why it survives review: the pages where it is visible are the ones nobody thinks to test.

## 3. `scrollbar-gutter: stable` alone is NOT enough

It only prevents the horizontal shift. If the symptom is the scrollbar itself flickering in and out,
`overflow-y: scroll` is the half that fixes it, by keeping the bar permanently present. The two
declarations solve two different halves of one symptom, and shipping only the modern one leaves the
jitter exactly as it was.

## 4. This is a LAYOUT bug, not a render bug

Before touching CSS, confirm that the components involved are static — no effect, no measurement, no
transition loop — which rules out a re-render, a skeleton or an animation as the cause. Judder in a
page looks like a React problem and is usually a box-model problem, and rebuilding a component that
was never at fault is the expensive way to find that out. Suspect a bug before redesigning.

Do not hand-roll a `padding-right: <scrollbar width>` compensation. Measuring the scrollbar in
JavaScript is wrong on overlay scrollbars, wrong when the user changes the setting, and wrong again
inside a nested scroll container. The two declarations above are the standard answer and need no
measurement.

## Operational note

A change to the document element usually needs a hard reload to take effect. Hot module replacement
routinely misses rules at that level, and the resulting "my fix does nothing" wastes more time than
the fix took to write.
