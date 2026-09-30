# Status colours: text and icons take the soft pair

Law module: `status-colors.mjs`. Catalogue: R61 FE_STYLE_TOKEN_ONLY (the class-name half of the soft-pair contrast obligation; the brand layer's own contrast is `starci/status-contrast` of @starci/stylelint-canon).

A status tone has two faces. The solid tone (`--success`) is a fill, with `--success-foreground` ink on it. A status shown as text or as an icon takes the soft pair, the way a HeroUI flat Chip does: `--success-soft-foreground` ink, on `--success-soft` when it sits on a tint. The soft pair is what the brand layer is checked to make readable (3:1 on the tint and on the page); the solid tone reads 3.8:1 or worse on white, so as a text colour it fails. The tones are the grammar's status tones (`success`, `warning`, `danger`, `info`), read from `lib/status-tones.generated.mjs`, which is generated from the grammar with the stylelint vocabulary.

Every rule below is an error in `starciFeConfig`; none can be switched off or suppressed inline.

## `starci-fe/status-text-uses-soft-foreground`

No class that paints text, an icon or a text decoration with a solid status tone: `text-<tone>`, `fill-<tone>`, `stroke-<tone>`, `decoration-<tone>` (with any variant, opacity or `!`), read from `className`/`class`, from `cn()`/`clsx()` arguments, conditionals, arrays, constants and `classes` entries.

**Invalid** (`src/components/leaves/StatusText/index.tsx`)

```tsx
<span className="text-success" />
<svg className={cn("size-4", ok && "fill-danger")} />
```

**Valid** (`src/components/leaves/StatusText/index.tsx`)

```tsx
<span className="bg-success-soft text-success-soft-foreground" />
<button className="bg-success text-success-foreground" />
<div className="border-danger ring-2 ring-warning" />
```

**Finding code:** `FE_STYLE_TOKEN_ONLY`

**Why:** `<file>` colours text or an icon with a solid status tone (`<what>`, for example `text-success`). A solid tone is a background colour; used as a text colour it reads below 4.5:1 on the page background.

**Fix:** Change to the soft pair: `text-<tone>-soft-foreground` (with `bg-<tone>-soft` if it sits on a light background); solid tones are used only with `bg-<tone>` and `text-<tone>-foreground`.
