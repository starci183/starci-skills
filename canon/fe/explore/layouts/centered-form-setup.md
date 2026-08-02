# Centered form/setup — one narrow column, no rail, review → action → CTA

> Grounded in `CartView` (`src/components/features/cart/CartView/index.tsx`, route `/cart`) — order
> review plus a checkout CTA — and `JobPostForm`
> (`src/components/features/careers/Jobs/JobPostForm/index.tsx`, route `/jobs/post`) — a
> multi-section react-hook-form. `/checkout` belongs to the same family: review plus payment.

## When to use

One FOCUSED task: reviewing an order, filling in a form, setting up a session. No secondary nav, no
long list being browsed alongside it. Offering two ways to enter the same field (paste or upload)
still stays one column — see input component canon §6.

## Region map

1. **`PageHeader`** — title and description. No breadcrumb chain when the surface is a leaf task;
   the back-link slot carries the way out instead (header component canon §3).
2. **Body** — `mx-auto max-w-2xl` or `max-w-3xl`, `gap-10` from header to content, then `gap-6` /
   `gap-3` inside:
   - **Review/summary** — `CartView` renders `SurfaceListCard` rows with a `PriceTag` total — OR
     **sections grouped by MEANING**: `JobPostForm` wraps each group of fields (company, position,
     apply method) in one `LabeledCard`. Not one card per field (card component canon §6).
   - **Closing CTA** — a primary `size="lg" fullWidth`, with the secondary or tertiary actions
     (cancel, empty the cart) below it.
3. **Success REPLACES the layout.** When the form IS a page rather than a modal, a successful submit
   renders `SubmitSuccess` in place of the form, with no toast (`JobPostForm`). A toast leaves the
   filled-in fields on screen, so the surface still reads as unfinished work.
4. **Empty or gate replaces the body.** An empty cart in `CartView` funnels to "Duyệt khóa học"; a
   visitor who is not logged in on `JobPostForm` gets a static notice and the form is HIDDEN, not
   rendered disabled — a disabled form invites the reader to fill in something that can never be
   submitted.

## Related

`form-flow` (validation, disabling and autosave INSIDE the form) ·
`layout-must-funnel-to-courses-and-cover-full-data-state-matrix` (empty means a funnel, never a dead
end) · card component canon §6 (grouping sections by meaning) ·
[`page-shell-selection.md`](page-shell-selection.md).
