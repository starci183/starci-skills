# Progressive disclosure — hide the secondary, open it on demand

Generalises the "when to use a Drawer" rule and the summary-row-plus-caret label rule into one
decision about WHEN to hide something, applying to Drawer, Accordion, Modal and "see more" alike.

## The rule of thumb

**Secondary content — rarely used, or diluting the main decision — hides behind one label with a
caret and opens when wanted. Primary content is always laid out in the open and is never hidden.**

## The rules

**The trigger is one clickable summary row** — label on the left, caret-right on the right, with the
hover covering the whole row. Not a lone button parked next to static content, which reads as an
unrelated action rather than as "there is more here".

**Pick the layer by ROLE.** A Drawer is for secondary content you look at and return from without
leaving the main flow. A Modal is a BLOCKING step: a decision that must be made before continuing. An
Accordion is for several peer items where one or a few are open at a time. "See more" and pagination
are for a list longer than the default holds.

**Hide the trigger entirely when the secondary content is empty or unavailable** — a row that opens
onto nothing is worse than no row. In `PaymentModal`, the whole label row for international gateways
is hidden when the order has no USD price.

**The test for "secondary enough to hide":** it is rarely used or applies to a minority, OR it
dilutes the main decision, OR it is a large block that nobody must see immediately. If more than one
part qualifies at the same time, the overall layout is the problem — revisit it before stacking
another hidden layer on top.

## Already applied

`PaymentModal`: international gateways hidden behind "Thanh toán quốc tế ›" opening a Drawer, while
domestic gateways are laid out in the open. `GradeModelDropdown`: "Cài đặt chấm điểm ›" as a summary
row plus caret opening a panel.

The trigger itself still obeys [[interactive-needs-hover]] — full hover state and `cursor-pointer`.
