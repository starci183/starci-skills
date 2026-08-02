# Typography

The type scale lives inside the HeroUI `Typography` component, selected with `type=`. It is not a
set of loose Tailwind `text-*` classes, and reaching for those instead puts a size in the tree that
no other component shares.

Source: `@heroui/styles/dist/components/typography.css` (`.typography--h1..h6`, `body*`, `code`),
`globals.css` (`--font-sans`), and `src/app/[locale]/layout.tsx` (`Open_Sans` via
`next/font/google`).

## 1. The `type` scale

`h1` 36px, `h2` 30px, `h3` 24px, `h4` 20px, `h5` 18px, `h6` 16px — ALL of them
`font-semibold tracking-tight`. Headings have no separate weight step; semibold is baked in.

`body` is 16px with `leading-7`, `body-sm` 14px with `leading-6`, `body-xs` 12px with `leading-5`,
and `code` is 14px mono on `bg-default`.

## 2. `weight` only means something for `body*`

`normal / medium / semibold / bold` change the weight of prose. Do not push a `weight` onto `h1`-`h6`:
they are already fixed at semibold, so the override either does nothing or fights the baked style,
and either way it tells the next reader the heading scale has a weight axis that it does not have.

## 3. `color` on the component has exactly two values

`default` and `muted`. Every other colour — accent, success, warning, danger — is a className
override, not a `Typography` variant. See [[color]].

## 4. A page title and a modal title are DIFFERENT sizes on purpose

`PageHeader` title is H3 (24px). A modal header is `type="body" weight="semibold"` (16px). The modal
is deliberately a step down from the page, because it is a smaller surface with a narrower claim on
attention ([[header]] §1/§5). Do not carry H3 into a modal.

## 5. `--font-sans` is BROKEN

`globals.css` declares `--font-sans: var(--font-inter)`, and `--font-inter` is not defined anywhere
in the repo. The font that actually loads is `Open_Sans` through `next/font/google`, attached
directly as `font.className` on `<body>` — it never passes through this variable. A `font-sans`
utility used OUTSIDE `<body>` therefore falls back to the OS sans stack.

Not yet fixed. Flag it when you next touch this area; the target is
`--font-sans: var(--font-open-sans)`.

## 6. `font-serif` is banned for Vietnamese text

No `--font-serif` is declared, so `font-serif` falls back to the OS serif — which BREAKS Vietnamese
diacritics, detaching the mark from its vowel. Do not use it for Vietnamese text until a
Vietnamese-capable serif face is loaded through `next/font`. See
[[fe-lint-no-next-img-directive-and-serif-polish]].

## 7. `font-mono` is for code

There is no app override; it is the Tailwind default mono stack. Do not use it for ordinary UI text
— a model name, a label — outside genuine code, unless that specific case has been approved. See
[[chip]] §4.

## Related

[[header]] · [[color]] · [[fe-lint-no-next-img-directive-and-serif-polish]] · [[chip]].
