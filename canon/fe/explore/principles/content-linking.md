# Content linking: no screen is a dead end

Every surface is a step in a path. The rules below are what it takes for that path to stay
continuous: an onward move from wherever the reader is, references that behave like references, and
exactly one way back.

## The test

**No screen is a dead end. Every surface offers a way onward — onward into the core loop, back to
what was in progress, or across to something related — and every reference to another entity is
clickable and carries the right intent.**

## The rules

- **Every surface has at least one onward path.** With content, that is the next action: resume, or
  continue. Empty is not an exception. Baymard's testing of no-results and empty pages is blunt
  about this: a page that reports an absence and offers nothing else sends the reader to the browser
  controls, and often out of the product. An empty state ends with a way in, not a full stop.
- **A reference to another entity — a person, a document, a record, a ticket — inside prose or a
  feed is a real link, not static text.** Render it bold and clickable. When the target cannot be
  resolved, because it was deleted or the lookup failed, fall back to **bold plain text** rather
  than a link that looks live and goes nowhere; a dead link costs the reader a click and some trust,
  while plain bold text costs neither.
- **A deep link carries an INTENT, not just an address.** A results summary that has just measured
  where the reader is weakest should link to that specific place, not to the generic index the
  reader came from. The destination is one that was computed for them, which is the whole difference
  between a link and a breadcrumb trail back to the start.
- **Resume stays inside the scope of the surface it is on.** A section overview resumes the next
  piece of that section rather than jumping to the final item; a surface that has its own overview
  lands on that overview rather than forwarding straight through into a single item. Auto-forwarding
  takes away the one thing the reader came for, which is the ability to see where they are.
- **Backward navigation has exactly one affordance** — a breadcrumb chain on a browsing page, a
  single back link on a leaf page such as a detail view or a result. Two competing ways out is a
  worse failure than a plain one, because the reader has to work out whether they differ. This is
  Nielsen's third heuristic, user control and freedom, at its most literal: a clearly marked exit.
- **An empty state is a path, not a notice.** "Nothing here yet" is useless on its own; it always
  carries a link or an action to the place where that content gets created.

## One worked example

A search results page with zero matches is the surface where all six rules land at once. It states
the absence plainly, keeps the query visible and editable, offers a widened search or a nearby
category as the onward path, makes any suggestion it prints an actual link, and keeps the single
back affordance the rest of the section uses. What it does not do is print "No results" and stop.

Related: `call-to-action.md`, `affordance-and-feedback.md` (empty is one of the four states every
data-backed region has to handle).
