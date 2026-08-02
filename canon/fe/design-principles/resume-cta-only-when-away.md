# A "Resume" CTA appears only when the reader has LEFT the unfinished task — STRICT

Read from the content-map rail, where "Tiếp tục học" stayed on screen even while the reader was
already on that exact lesson (2026-06-24).

## The rules

**A resume CTA — the button that jumps back to the unfinished task — renders only when the user is
NOT on that task.** While the current view IS `currentTask`, hide it, because it would link to the
page it is sitting on. The gate:

```ts
// OutlineRail header
continue: continueHref && currentTask?.id !== activeContentId ? … : undefined
```

**Why:** resume means "take me back to where I stopped". If I am already there, there is nothing to
resume, so the button is dead weight and it is noise — especially as a large CTA stuck to the bottom
of the rail. An affordance shows up only when it can do something.

**The general form:** any "take me to X" CTA hides while the reader is on X. Do not render a no-op
action just because the data behind it (`currentTask`) exists; gate on whether it differs from the
current position.

## First applied 2026-06-24

`ContentMap` (the lesson reader's content-map rail): the `OutlineRail` header's `continue` becomes
`undefined` when `currentTask?.id === activeContentId`. It had previously been gated on
`continueHref` alone, so it never went away.
