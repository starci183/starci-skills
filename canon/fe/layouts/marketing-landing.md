# Marketing landing — full-fold hero, stacked story sections, closing CTA

> Grounded in `Landing` (`src/components/features/landing/Landing/index.tsx`, routes `/` and
> `/home`). Public, no login.

## When to use

A public selling or storytelling page, measured by scroll and conversion, with no task or form
inside it. A real form belongs in [`centered-form-setup.md`](centered-form-setup.md).

The COPY and DATA rules — grounded in real data, a curated track rather than a dump of the catalog,
static versus live showcase — live in the `landing-marketing` principles. This file describes only
the SHAPE of the page.

## Region map

Vertical, one column at `max-w-6xl`, with a `gap-16` rhythm between beats. That gap is a NAMED
exception to the `gap` foundations, granted to the landing page alone.

1. **Hero** — the ONLY full-fold region (`min-h-[calc(100dvh-4rem)]`, `HeroBanner`: eyebrow,
   headline, two CTAs, visual). Every other beat sizes to its content, with no `min-h-screen`, so
   that no beat leaves half a screen empty.
2. **Live-proof strip** — `SectionHeading` plus `StatStrip`. Real numbers immediately after the
   hero, which is what stops the page reading as a course bazaar.
3. **Story beats** — each beat is a `SectionHeading` (eyebrow, title, intro) plus one content block:
   the scrollytelling learning loop, track cards, the knowledge-graph split, founder truths, the
   talent marketplace. Each section carries an `id` and `scroll-mt-24` so the navbar anchor nav
   lands correctly.
4. **FAQ** — `Accordion variant="surface"`.
5. **Closing CTA** — centred, exactly one primary, repeating the hero's main CTA.
6. **Back-to-top FAB** — floating bottom right, appearing only once the reader has scrolled past the
   hero (`scrollY > 600`).

## Related

`landing-marketing` principles (ten sections of copy and data rules) · `card` component canon (do
not render the same entity across N repeated sections) ·
[`page-shell-selection.md`](page-shell-selection.md).
