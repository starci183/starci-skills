# Marketing landing — full-fold hero, stacked story sections, closing CTA

> A public selling or storytelling page: no login, no task inside it, measured by scroll depth and
> conversion rather than by task completion. Refactoring UI supplies the hierarchy discipline the
> shape depends on — one thing is the loudest, everything else steps down — and Fogg's B=MAP names
> what the page is actually doing: it raises motivation down the scroll while keeping the ability
> cost of the next step at one click.

## When to use

Selling or storytelling in public, with no task or form inside the page. A real form belongs in
[`centered-form-setup.md`](centered-form-setup.md); a landing page that grows a form has become two
surfaces wearing one route.

Copy and data rules — claims grounded in numbers the system can actually produce, a curated
selection rather than a dump of the whole catalogue — live with the persuasion material. This file
describes only the SHAPE of the page.

## Region map

Vertical, one column at a wide measure, with a large and constant gap between beats. That gap is a
NAMED exception to the spacing scale, granted to the landing page alone: a marketing beat is a scene
change, and scene changes are read by the size of the silence between them.

1. **Hero** — the ONLY full-fold region: eyebrow, headline, two CTAs, one visual. Every other beat
   sizes to its content, with no forced viewport height, so that no beat leaves half a screen empty.
2. **Proof strip** — a heading plus real numbers, immediately after the hero. Proof placed this
   early is what stops the page reading as a brochure, and it is the cheapest motivation the page
   will ever buy.
3. **Story beats** — each beat is a heading (eyebrow, title, intro) plus one content block. Each
   section carries an id and a scroll offset so anchor navigation from the navbar lands with the
   heading clear of the sticky header rather than underneath it.
4. **FAQ** — an accordion. Questions are objections; answering them late is answering them at the
   moment the reader is deciding.
5. **Closing CTA** — centred, exactly one primary, repeating the hero's main action. The reader who
   scrolled this far has the motivation; what they need is the ability, which means not having to
   scroll back up to find the button.
6. **Back-to-top control** — floating bottom right, appearing only once the reader has scrolled past
   the hero. Shown from the top it is a control for a journey nobody has taken yet.

## Related

The persuasion and copy material (claims, proof, and what a CTA may promise) ·
`every-surface-offers-a-path-onward` ·
[`page-shell-selection.md`](page-shell-selection.md).
