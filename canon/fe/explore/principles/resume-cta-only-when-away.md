# A "Resume" CTA appears only when the reader has LEFT the unfinished task — STRICT

## The rules

**A resume CTA — the control that jumps back to the unfinished task — renders only when the user is
NOT on that task.** While the current view IS the saved position, hide it, because it would link to
the page it is sitting on. The gate compares position against position, never presence against
absence:

```ts
// Sidebar header of a document reader
resume: resumeHref && lastVisited?.id !== currentDocumentId ? resumeHref : undefined

// Wrong: gated on the link existing, so it never goes away
resume: resumeHref
```

**Why:** resume means "take me back to where I stopped". If I am already there, there is nothing to
resume, so the control is dead weight — and worse than dead weight when it is a large button pinned
to the bottom of a rail, because it occupies the position the reader has learned to trust for the
next real action. Nielsen Norman's minimalist-design heuristic is the general statement: every unit
of interface competes with the useful units around it.

**The general form:** any "take me to X" affordance hides while the reader is on X. Do not render a
no-op action just because the data behind it exists; gate on whether that data differs from the
current position. The same test retires a "back to top" button at the top of the page, a "go to
checkout" button inside the checkout, and a breadcrumb whose last node links to itself.

An affordance shows up only when it can do something. A control that is present, styled as active,
and does nothing teaches the reader that controls here may be decorative — and that conclusion is
applied to the controls that do work.
