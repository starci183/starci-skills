# Centered form/setup — one narrow column, no rail, review then action then CTA

> The shell for a single focused task: reviewing an order before paying, filling in a multi-section
> form, setting up a session before it starts. Baymard's checkout research is the strongest public
> grounding — a single column, fields grouped into a few labelled sections, and one unmistakable
> action at the end — and Refactoring UI makes the same case for narrowing the measure so the eye
> never has to hunt for the start of the next line.

## When to use

One FOCUSED task. No secondary nav, no long list being browsed alongside it. Offering two ways to
fill the same field — paste or upload — still stays one column; two entry methods are one decision,
not two regions.

## Region map

1. **Page header** — title and description. No breadcrumb chain when the surface is a leaf task; the
   back-link slot carries the way out instead, because a leaf needs one way back rather than a map
   of where it sits.
2. **Body** — centered at a narrow measure, roughly 640 to 768 pixels, with a generous gap from the
   header to the content and tighter gaps inside it:
   - **Review or summary** — rows in a single list container with a total at the foot, OR
     **sections grouped by MEANING**: each group of fields (contact, delivery, payment) wrapped in
     one labelled card. Not one card per field. A card is a boundary around a group; a card around
     a single field says there is a group and then shows one thing.
   - **Closing CTA** — one primary at large size and full width, with the secondary and tertiary
     actions below it rather than beside it. One primary per surface: a second one of equal weight
     makes the reader decide which is the way forward before they can move (Hick's Law).
3. **Success REPLACES the layout.** When the form IS a page rather than a modal, a successful submit
   renders a success state in place of the form, with no toast. A toast leaves the filled-in fields
   on screen, so the surface still reads as unfinished work and the reader hesitates over whether to
   submit again — an open loop where the mechanism should be closing one (Zeigarnik).
4. **Empty or gate replaces the body.** An empty cart funnels onward to the thing that fills it. A
   visitor who is not signed in gets a static notice and the form is HIDDEN, not rendered disabled.
   A disabled form invites the reader to fill in something that can never be submitted, which is
   effort spent on an action the system has already decided to refuse.

## Related

Form flow (validation, disabling and autosave INSIDE the form) ·
`every-surface-offers-a-path-onward` (empty means a funnel, never a dead end) ·
[`page-shell-selection.md`](page-shell-selection.md).
