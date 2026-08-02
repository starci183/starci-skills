# Progressive disclosure — hide the secondary, open it on demand

One decision about WHEN to hide something, applying to Drawer, Accordion, Modal and "see more" alike.
Nielsen's progressive-disclosure guidance is the ground: show the few options most people need, and
put the rest one obvious click away. Hick's Law says why it pays — the time to choose grows with the
number of visible options, so every secondary control on screen taxes the primary decision.

## The rule of thumb

**Secondary content — rarely used, or diluting the main decision — hides behind one label with a
caret and opens when wanted. Primary content is always laid out in the open and is never hidden.**

## The rules

**The trigger is one clickable summary row** — label on the left, caret on the right, with the hover
covering the whole row. Not a lone button parked next to static content, which reads as an unrelated
action rather than as "there is more here". The summary row is also where the promise is made: its
label has to name what is behind it, because a caret alone tells the reader nothing about whether the
click is worth making.

**Pick the layer by ROLE.** A Drawer is for secondary content you look at and return from without
leaving the main flow. A Modal is a BLOCKING step: a decision that must be made before continuing. An
Accordion is for several peer items where one or a few are open at a time. "See more" and pagination
are for a list longer than the default holds.

**Hide the trigger entirely when the secondary content is empty or unavailable** — a row that opens
onto nothing is worse than no row. In a checkout, the whole "other payment methods" row disappears
when the order's currency has none, rather than opening an empty drawer.

**The test for "secondary enough to hide":** it is rarely used or applies to a minority, OR it
dilutes the main decision, OR it is a large block that nobody must see immediately. If more than one
part qualifies at the same time, the overall layout is the problem — revisit it before stacking
another hidden layer on top, because three collapsed sections in a column is not disclosure, it is a
page that has been hidden from its own reader.

The trigger itself still obeys [[interactive-needs-hover]] — a full hover state and `cursor-pointer`.
