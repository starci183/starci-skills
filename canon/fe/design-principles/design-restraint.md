# Design restraint

The shared kernel of three rules that turned out to be one: `whitespace-over-dividers.md`, the
anti-pattern section of `accent-system.md`, and the rule that a progress block leads with a growing
quantity rather than a vanity strip. All three say **minimum visual weight**.

## The test

**A screen carries exactly the visual weight it needs to communicate — everything decorative,
repeated or vanity gets cut.**

## The rules

- **Accent follows 60-30-10.** Accent is a seasoning at a few small points — an icon, a chip, a
  value, a border — and never a fill across a whole block or section. Accent flood is an
  anti-pattern, not "making it stand out more".
- **Separate with whitespace before reaching for a divider.** The `gap` between two sections already
  separates them; add a `border-t` or a `Separator` only when two regions cannot be separated by gap
  — inside one bounded block, or where two joined regions must share a container.
- **Cut vanity numbers.** A count that repeats what the eye already sees (a list showing its items
  does not also need "N items" underneath), or a number that means nothing because the sample is too
  small (100% retention from exactly one attempt) — hide it rather than display it to fill the
  dashboard.
- **One meaningful quantity — a single meter or headline — beats N numbers of equal rank.** A stat
  strip of same-size figures is a dashboard for the look of it, with no way to tell which figure
  matters.
- **Icons and colour are not applied to static, non-interactive elements to make them pretty.** Every
  visual emphasis must mean something: it is interactive, or it is a state signal.

Already applied in: `whitespace-over-dividers.md` (section rails separated by `gap-6`, with the
`Separator` and the redundant count removed); `accent-system.md` §5 (accent flood and decorative
accent as anti-patterns); the progress-block rule (one mastery meter replacing a strip of three
loose numbers).

Related: `card.md` — never stacking two bordered cards, the same restraint applied to surfaces.
