# Design restraint

Three rules that look separate — whitespace before dividers, accent as a seasoning, one meaningful
quantity instead of a strip of figures — share a kernel: **minimum visual weight**. Every mark on a
screen costs the reader something, so each one has to be doing work. Tufte's data-ink argument is
the oldest form of it, and it survives the move from a printed chart to an application surface
almost unchanged.

## The test

**A screen carries exactly the visual weight it needs to communicate — everything decorative,
repeated or vanity gets cut.**

## The rules

- **Accent follows 60-30-10.** Accent is a seasoning at a few small points — an icon, a chip, a
  value, a border — and never a fill across a whole block or section. Accent flood is an
  anti-pattern, not "making it stand out more": emphasis is relative, so spreading it removes it.
- **Separate with whitespace before reaching for a divider.** The gap between two sections already
  separates them; proximity is the strongest grouping signal available and it is free. Add a rule or
  a separator only where a gap cannot do the job — inside one bounded block, or where two joined
  regions must share a container.
- **Cut vanity numbers.** A count that repeats what the eye already sees — a list of six items does
  not also need "6 items" underneath — or a number that means nothing because the sample is too
  small, such as a hundred-percent success rate drawn from a single run. Hide it rather than print
  it to fill space.
- **One meaningful quantity beats N numbers of equal rank.** A strip of same-size figures is a
  dashboard for the look of a dashboard: nothing in it says which figure matters, so the reader
  either reads all of them or none. One headline value or one meter, with the rest demoted or on
  demand, is the version that gets read.
- **Icons and colour are not applied to static, non-interactive elements to make them pretty.** Every
  visual emphasis must mean something: either the element is interactive, or the emphasis is a state
  signal. Decoration that looks like signal trains the reader to ignore signal.

The failure this guards against is cumulative rather than local. No single divider, count or tint is
wrong on its own, which is why they accumulate; the screen only becomes unreadable after the
twentieth one, and by then nobody can name the change that did it.

Related: `card.md` — never stacking two bordered cards is the same restraint applied to surfaces;
`accent-system.md` §5 for the accent half in detail.
