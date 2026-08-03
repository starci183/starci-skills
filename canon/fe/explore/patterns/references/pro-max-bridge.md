# Bridge — querying the design-intelligence oracle for a landing brief

Operational companion to [`../landing-generation-with-design-intelligence.md`](../landing-generation-with-design-intelligence.md).
This file records HOW to consult the `ui-ux-pro-max` design database at the brief step, and how its
answers map onto this system's shells and rules. It is a convenience, not a dependency: when the
database is not installed, fall back to the priority ruleset below and say so, rather than inventing
a match.

## The three queries worth running

The skill ships a search script; invoke it by its own full path (it does not assume a working
directory). `python` may be `python3` or `py -3`.

```bash
# 1. Whole design system for the product — pattern, palette, type, motion tier, anti-patterns
python "<skill>/scripts/search.py" "<product-type> <industry> <tone> <density>" --design-system

# 2. Landing structure only — section order + CTA placement + conversion notes for the fit
python "<skill>/scripts/search.py" "<pattern keywords>" --domain landing

# 3. A single dimension when unsure — style | color | typography | ux | icons | gsap
python "<skill>/scripts/search.py" "<keyword>" --domain <domain>
```

Feed multi-dimensional keywords, not one word: `"exam-prep learning vibrant content-dense"`, not
`"app"`. Three optional dials tune the same query without changing it — `--variance` (minimal↔bold),
`--motion` (subtle↔choreographed), `--density` (spacious↔dashboard). A zero-result search is reported
as a fallback to defaults, never dressed up as data.

## Its priority ruleset — the order to resolve conflicts in

The database orders UX rules by impact; this is the order to satisfy them in, and the first three are
non-negotiable regardless of the visual direction chosen.

| # | Category | Must hold | Never |
|---|---|---|---|
| 1 | Accessibility | contrast 4.5:1, alt text, keyboard nav, aria-labels | removing focus rings, icon-only controls without labels |
| 2 | Touch & interaction | ≥ 44×44px targets, feedback within ~150ms | hover-only reliance, 0ms state changes |
| 3 | Performance | modern image formats, lazy load, reserved space (CLS < 0.1) | layout thrash, cumulative layout shift |
| 4 | Style selection | one coherent style, vector icons | mixing idioms at random, emoji as icons |
| 5 | Layout & responsive | mobile-first, no horizontal scroll | fixed px widths, disabling zoom |
| 6 | Typography & colour | 16px base, line-height ~1.5, semantic tokens | body text < 12px, raw hex in components |
| 7 | Animation | 150–300ms, motion carries meaning | decorative-only motion, no reduced-motion path |
| 8 | Forms & feedback | visible labels, error beside the field | placeholder-as-label, errors only at the top |
| 9 | Navigation | predictable back, bottom nav ≤ 5 | overloaded nav, broken back behaviour |
| 10 | Charts & data | legends, tooltips, not colour alone | colour as the only encoding |

## Pattern → shell, and the rule to apply on the way in

The database names dozens of landing patterns. Each maps onto the one marketing shell
([`../../layouts/marketing-landing.md`](../../layouts/marketing-landing.md)); what differs is the
beat order and which claims it wants — and each of those claims passes the [[landing-marketing]]
filter first.

| Oracle pattern | Beat order it suggests | Rule to apply on the way in |
|---|---|---|
| Hero-Centric | full-bleed hero → one value strip → key proof → primary CTA | one primary CTA; hero is the only full-fold region |
| Feature-Rich Showcase / Bento | hero → feature grid (4–6) → use cases → proof → CTA | curated selection, one entity one section; shared-axis items become a matrix |
| Hero + Testimonials / Reviews | hero → problem → solution → testimonials → CTA | proof is a real gated number or a static illustration — never an invented review strip |
| Comparison Table | hero → comparison matrix → deep-dive → CTA | the matrix draws the shared axis once; every cell is a real, defensible claim |
| Pricing-Focused | hero → tier cards → feature comparison → FAQ → CTA | market only tiers that exist in the catalogue; the comparison is a matrix, not repeated cards |
| Product Demo / App-Store | hero → demo or device mockup → features → proof → CTA | a "screen of the product" is a mockup frame grounded in the real screen, not an invented layout |
| Waitlist / Coming-Soon | hero + countdown → teaser → capture → count | no fabricated countdown or waitlist count; keep the section editorial until the number is real |

Where a pattern leans on a claim the product cannot yet back, the section stays editorial and is
upgraded from telling to showing once the data is wired — the same rule the marketing canon already
states.
