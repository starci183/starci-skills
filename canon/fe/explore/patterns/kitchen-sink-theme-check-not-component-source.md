# Kitchen sink — a dev-only theme check, not where components live

> Two pages get confused because both "show components". One is the design system's own book, where
> every component the app owns is authored beside a story that puts its states side by side — that is
> the single source, and there is exactly one of it. The other is a "kitchen sink": one page that
> renders the base UI library's raw primitives — every button, input, card and modal the vendor
> ships — in one place. Ending the confusion matters, because the kitchen sink is not a smaller
> version of the book; it answers a question the book cannot.

## When this applies

Standing up a page to eyeball components — one that renders `Button`, `Input`, `Card`, `Modal` and
the rest at every variant. Decide first which of the two pages it is, because they carry opposite
rules.

## The book is where the app's components live

Every component the app owns — an atom wrapping a vendor primitive, a block, a whole surface — is
authored in the one storybook and nowhere else, beside a story showing its states. A second place the
same component is rendered is a second source that drifts silently. The one-book rule (owned by
`starci-setup-storybook`, enforced by `scripts/workspace/check-single-source-of-truth.mjs`, which
fails the moment a registered source grows its own `.storybook/`) is exactly this rule. So a route
inside the app that re-renders the app's own components is not allowed — it is the second book wearing
a different hat.

## The kitchen sink renders the VENDOR's raw primitives, to check the theme in the real runtime

There is one thing the book cannot stand in for. The book renders components in ISOLATION; it cannot
prove that the app's theme — the CSS-variable tokens in `globals.css`, the vendor's theme config, the
real fonts, the provider tree — actually lands on the base library's own primitives when they run
inside the app. A kitchen sink answers precisely that: it imports the raw vendor primitives directly
(`Button`, `Input`, `Card`, `Modal`, … straight from the library, unwrapped by any of the app's
atoms), renders every variant and state, and is read in the running app. It shows the LIBRARY, not the
app's components, so it is not a second book and cannot drift against one.

Its constraints, because it is a convenience and never a source of truth:

- **It renders only the vendor's raw primitives.** The moment it renders one of the app's own atoms
  or blocks, it has become the forbidden second book — those live in the storybook.
- **It is dev-only.** Gated off production; a mirror for whoever is tuning the theme, not a page a
  user reaches.
- **It never becomes the reference.** The storybook stays the reference for the app's own components;
  the kitchen sink is only a theme probe on the raw library.

## Name it for what it is

A route's name has to carry which of the two it is. **`kitchen-sink`** (or `ui`) is the
every-primitive-in-every-state theme probe described here. **`prototype`** is a clickable mock of one
FLOW — a landing, a checkout — and is the wrong word for a wall of loose components. **`design`** names
nothing a reader can act on and is not used as a route. Pick the word that tells the next reader what
they are opening.
