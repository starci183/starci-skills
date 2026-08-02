# Color and tokens

Every colour in this app is a semantic token. The accent is a seasoning, not a surface — see
[[accent-system]] — and the two components that carry most of the colour decisions are
[[button]] and [[chip]].

## 1. Semantic tokens only — no hex, no `slate-*`, no `cyan-500`

- **Backgrounds** — `bg-background` is the table, `bg-surface` (and `-secondary` / `-tertiary`) is
  the paper laid on it; form fields use the `--field-*` family.
- **Text** — `text-foreground`, `text-muted`, `text-accent`, and the semantic
  `text-{success,warning,danger}`.
- **Borders** — `border-separator` or `border-default`.
- **Third-party brand colour** (Facebook, GitHub) gets a `--brand-*` token rather than a literal.
- Anything categorical maps back onto success / warning / danger / accent instead of inventing a
  hue.

The one legitimate exception is **data-driven colour** — a per-language swatch for TS or Go, a
per-category colour. That belongs in a domain util and is applied through `style`, because it is
data, not design. It never becomes a token in `globals.css`.

## 2. Active, selected, or highlighted — tint plus matching text

A component in its active or selected state (a nav row, a chip, a tab, a segment) gets a tinted
background `bg-<Color>/10` with icon and text in the same `<Color>` at full strength. That is the
standard tonal pattern — the same one shadcn, Material and Linear use — and it reads as "on"
without needing a border or a shadow.

`<Color>` is `accent` for the primary active state, `success` / `warning` / `danger` when the state
is semantic, and `default` for a neutral selection (`bg-default text-foreground`).

**Only for a small bounded block.** Do not flood `bg-<Color>/10` across a whole section: the accent
earns its meaning by being rare ([[accent-system]]). To highlight "mine" or "currently selected" in
a list, put the accent on a detail — a ring, a chip, a value — rather than tinting the entire row.

A semantic chip in its raised form is `bg-<token>/10 text-<token>`, soft and borderless; that is
already settled in [[chip]].

## 3. Primary is SOLID, never tinted

The main action is a solid fill: `bg-accent` with `--accent-foreground`. Not `bg-accent/10`. The
`/10` tint belongs to active, selected and secondary states, and using it for the primary action
leaves a screen with no visual centre. See [[button]] §2.

`--accent-foreground` is **white** — `oklch(100% 0 0)`, settled 2026-06-26 — so text, icons and
arrows sitting on a solid accent are white. The accent is a pink near 70% lightness, which is close
to the line: verify 4.5:1 rather than assuming it, and darken the accent for the button if it fails.

## 4. A large toned node on a dark background uses opaque `color-mix`, not alpha

To tone a large box or node on a dark background — a diagram node, an emphasised card — the
background is an opaque mix:

```
color-mix(in oklch, var(--<tone>) 20-26%, var(--surface))
```

rendered through an inline `style`, since `color-mix` does not compress into a class.

Why not `bg-<Color>/10`: alpha smears when a glow or gradient sits behind the box — the glow reads
through and the node looks like frosted glass. An opaque fill with a border in the same tone sits
together; a coloured border over pure black fights.

**This is not the chip rule.** A chip stays on alpha (`bg-<token>/10`, §2 and [[chip]]) because it
is small and sits on a flat surface with no glow behind it. Large box on a glow, opaque mix.

**Tone only the nodes that mean something** — the focal node in `accent`, the problem node in
`danger` — and leave the rest neutral (`bg-surface` with `border-default`). Eight coloured nodes is
a rainbow and carries no information.

**Text stays `text-foreground`** on a toned fill. The tone is already carried by the border and the
background; tinting the text as well only lowers contrast.

**Neutral node over a glow is the exception**: give it
`color-mix(in oklch, var(--surface) 80%, transparent)` plus `backdrop-blur`. Translucent, it catches
the glow and stays alive instead of reading as a dead black hole. The division of labour is: toned
nodes are opaque and pop, neutral nodes are glass and catch the light.

## 5. Accessibility

Contrast at least 4.5:1 for text, at least 3:1 for icons and secondary marks. `text-<Color>` on
`bg-<Color>/10` behaves like coloured text on white — the dark tokens pass comfortably, but accent
and any bright token must be verified. Colour is never the only channel: pair it with an icon or a
label.

## Related

[[accent-system]] · [[button]] · [[chip]] · [[no-emoji]] (icons in place of emoji).
