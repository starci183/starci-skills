# Colour and tokens

Every colour in a product is a semantic token — a name that says what the colour is for, not what
the colour is. Material 3 calls these colour roles, Fluent 2 calls them global and alias tokens, and
both exist for the same reason: a value written as `#0F62FE` can only be found by searching for that
string, while a value written as `--accent` can be re-themed, contrast-checked and reasoned about.

## 1. Semantic tokens only — no hex, no raw palette class

- **Backgrounds** — one token for the page itself and a small family for the surfaces laid on it
  (primary, secondary, tertiary). Form fields get their own family, because fields move
  independently of cards.
- **Text** — a foreground, a muted foreground, an accent, and the semantic trio of success, warning
  and danger.
- **Borders** — a separator token for hairlines between things, a default border token for the
  outline of a thing.
- **Third-party brand colour** — a sign-in provider's blue, a repository host's black — gets its own
  brand token rather than a literal, so it is visibly not part of the palette.
- Anything categorical maps back onto success, warning, danger or accent rather than inventing a
  hue. A seventh colour invented for one badge is a colour with no meaning anywhere else.

The one legitimate exception is **data-driven colour**: a per-language swatch in a repository list, a
per-category colour in a chart legend, a user-chosen label colour. That belongs in a data utility and
is applied through an inline style, because it is data rather than design. It never becomes a token
in the theme.

## 2. Active, selected or highlighted — a tint plus matching text

A component in its active or selected state — a navigation row, a chip, a tab, a segment — takes a
tinted background at roughly ten percent alpha with its icon and text in the same hue at full
strength. This is the standard tonal pattern, the one Material's secondary container, Fluent's
subtle-selected fill and most shadcn-derived systems all land on, and it reads as "on" without
needing a border or a shadow.

The hue is the accent for an ordinary active state, success, warning or danger when the state is
genuinely semantic, and a neutral fill for a selection that carries no judgement.

**Only for a small bounded element.** Do not flood a ten-percent accent across a whole section: the
accent earns its meaning by being rare, which is the entire argument of Refactoring UI's chapter on
using colour sparingly. To mark "mine" or "currently selected" in a list, put the accent on one
detail — a ring, a chip, a value — rather than tinting the whole row.

## 3. The primary action is a solid fill, never a tint

The main action on a surface is solid: the accent as background, the accent-foreground as text. Not
the ten-percent tint. The tint belongs to active, selected and secondary states, and spending it on
the primary action leaves the screen with no visual centre — every element is equally quiet and the
eye has nowhere to land.

Whatever colour the accent-foreground is, it must be verified rather than assumed. An accent that
sits high on the lightness axis — a pink, a lime, a cyan near 70% — is close to the line where white
text stops passing 4.5:1, and the honest fix is to darken the accent for the button rather than to
ship the pair and hope.

## 4. A large toned area on a dark background uses an opaque mix, not alpha

To tone a large box on a dark background — a diagram node, an emphasised card — mix the tone into
the surface colour opaquely rather than laying alpha over it:

```css
background: color-mix(in oklch, var(--tone) 22%, var(--surface));
```

Alpha smears as soon as anything sits behind the box. A gradient, a glow, an ambient background
reads straight through the fill, and the box looks like frosted glass laid over the page instead of
a solid object on it. An opaque fill with a border in the same tone reads as one object; a coloured
border over a translucent centre fights itself.

**This is not the chip rule.** A chip stays on alpha, because it is small and sits on a flat surface
with nothing behind it. Large area over anything textured: opaque mix.

**Tone only the areas that mean something.** The focal node in the accent, the failing node in
danger, and everything else neutral. Eight coloured nodes is a rainbow, and a rainbow carries no
information.

**Text stays the ordinary foreground** on a toned fill. The tone is already carried by the border
and the background; tinting the text as well only spends contrast to say the same thing twice.

**A neutral area over a glow is the exception**: mix the surface with transparency and add a
backdrop blur. Translucent, it catches the light behind it and stays alive instead of reading as a
hole cut in the page. The division of labour is that toned areas are opaque and come forward, and
neutral areas are glass and catch what is behind them.

## 5. Accessibility

WCAG 2.2 sets the floor: 4.5:1 for body text, 3:1 for large text and for the non-text parts that
carry meaning — icons, focus rings, the boundary of a control. Coloured text on its own
ten-percent tint behaves like coloured text on white; the dark tokens clear it comfortably, and any
bright token has to be measured.

Colour is never the only channel. WCAG 1.4.1 states it plainly, and the practical form of it is that
every status colour is paired with an icon or a word, so that the difference between "passed" and
"failed" survives both a monochrome print and the eight percent of men with red-green colour vision
deficiency.

## Related

Where the token VALUES and the light/dark theme are configured — one file, `globals.css`, and never a
component — is `canon/fe/enforce/authoring/styling-tailwind.md` §1.

[[accent-system]] · [[button]] · [[chip]].
