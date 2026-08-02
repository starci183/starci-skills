# Styling and Tailwind — STRICT

How to WRITE Tailwind classes in the FE source (`node .claude/scripts/workspace/read-workspace-context.mjs fe.path`):
semantic tokens, `cn()`, the spacing and radius scales, variant-follows-background, phosphor icons.
This is class code-style, not the design system — which specific colour or spacing to use is a
design decision, made elsewhere.

## 1. Semantic tokens — no stray hex or px

Colour is a CSS-variable token declared in `src/app/globals.css` — `--accent`, `--muted`,
`--foreground`, `--background`, `--default`, `--surface`, `--success/warning/danger`, and the
`-soft` / `-soft-foreground` family — consumed through Tailwind utilities: `text-muted` (399
occurrences), `bg-default` (121), `text-foreground` (179), `bg-accent-soft`.

Raw hex or rgb in a class or style is not allowed in an ordinary component. Hex is legitimate in
exactly three places, where THREE.js, WebGL, or an `<svg fill>` cannot read a CSS variable:
`blocks/marketing/ArchitectureScene`, `svg/LogoMark`, and
`features/profile/CV/.../CvHtmlDocument`. All 14 files using hex belong to that group; ordinary UI
components use zero.

```tsx
// blocks/chips/StatusChip/index.tsx — tone maps to a vendor colour token
<Chip color={toneToColor[tone]} variant="soft" size="sm" …>

// Wrong: hand-mixed raw hue. StatusChip's own comment records why:
// the old bg-<status>/10 + text-<status> FAILED contrast.
<span className="bg-[#34d399]/10 text-[#34d399]">
```

Size is a Tailwind step (`size-4`, `w-36`, `h-8`). An arbitrary `[Npx]` is for a genuinely fixed
media or scene dimension only — `w-[300px]`, `h-[560px]` for an illustration or canvas — and never
for spacing.

## 2. `cn()` from `@heroui/react` — the ONLY way to join classes

Import it as `import { cn } from "@heroui/react"`. Not `clsx`, not `twMerge`, not `tailwind-merge` —
this repo does not use them.

Base classes first, the `className` prop last; a conditional slot returns `null` when off:

```tsx
// blocks/identity/IconTile/index.tsx
className={cn(
    "flex shrink-0 items-center justify-center overflow-hidden",
    SIZE[size],
    showImage ? null : TONE[tone],   // an off slot is null, not an empty string
    className,                        // the prop is ALWAYS last, so it can override
)}
```

A long or reused class string becomes a module-level SCREAMING_SNAKE constant with JSDoc (see
[[react-idioms]] §5), or a `Record<Variant, string>` (§4 below).

## 3. The spacing scale — steps only, never arbitrary

Use Tailwind steps: `gap-2` / `gap-3` for standard density, `gap-6` for a large block; `p-3` for a
card (house rule), `p-6` for a section.

**A card is `p-3`**, enforced: `globals.css` bakes
`.card { padding: calc(var(--spacing) * 3) !important }`, overriding the vendor's `p-4`. Do not add
`p-4` or `p-6` by hand to a `<Card>`. When the card body is a divider list, use the flush variant
(`p-0`) and let each row carry its own `p-3`.

There is no arbitrary spacing anywhere in this repo — `gap-[10px]` and `p-[14px]` do not appear, and
should not start now.

## 4. Variant follows the BACKGROUND — background and foreground travel together

A tone or variant drives one `Record<Tone, string>` that maps to a PAIR — `bg-X-soft` with
`text-X-soft-foreground` — never a background set in one place and a text colour in another:

```tsx
// blocks/identity/IconTile/index.tsx
const TONE: Record<IconTileTone, string> = {
    accent:  "bg-accent-soft text-accent-soft-foreground",
    success: "bg-success-soft text-success-soft-foreground",
    danger:  "bg-danger-soft text-danger-soft-foreground",
    neutral: "bg-default text-muted",
}
```

A solid background always pairs with its own `-foreground`: `bg-accent text-accent-foreground` (the
CTA in `blocks/cards/ContinueCard`). Writing `bg-accent text-white` instead breaks the moment the
token changes.

Prefer the vendor's NATIVE pairing — `variant="soft"` sets `--chip-bg` to `X-soft` and `--chip-fg`
to `X-soft-foreground`, with contrast already tuned — over mixing your own `bg-<hue>/10`.

## 5. Concentric radius

The radius of an INNER surface is always one step smaller than the one containing it — a child
nested in a card steps down once:

```tsx
// blocks/cards/CourseCard/index.tsx
<Card className="overflow-hidden rounded-3xl …">
  {/* rounded-2xl is the inner step below the card's rounded-3xl */}
  <div className="… rounded-2xl bg-surface">
```

Radius also scales with box size: `size-12 → rounded-xl`, `size-16/20 → rounded-2xl` (the `SIZE` map
in `IconTile`).

A pill, chip, avatar, or round button is `rounded-full` — 277 occurrences, the most common step by
far. The scale actually in use is `full > xl > 2xl > 3xl > lg`; do not invent a `rounded-[Npx]`.

## 6. Do not hand-roll a primitive

Do not rebuild a tinted box, a pill, or a tile out of `div + class` when a canonical block already
exists: `IconTile` for an icon frame, `StatusChip` for a status pill, the vendor `Card` and `Chip`.
Grep `src/components/blocks` first. For the tier boundaries, see [[react-idioms]] §2.

Writing `<div className="rounded-2xl bg-accent-soft p-3">` to fake an IconTile is the exact move to
avoid — use `<IconTile tone="accent" … />`.

## 7. Phosphor icons

Icons come from `@phosphor-icons/react` (317 files; 8 stragglers use another library — do not
multiply them). Import the named `*Icon`:
`import { CheckCircleIcon } from "@phosphor-icons/react"`.

Render it bare and size it with a CLASS — `size-4` or `size-5`, the two common steps — or let the
parent force the size through `[&_svg]:size-N` (as `IconTile` and `StatusChip` do). The numeric
`size={20}` prop appears in only two legacy spots and should not spread.

Icon colour is INHERITED from the parent's `text-*` (`text-muted`,
`text-accent-soft-foreground`); do not set a colour on the icon itself. For emphasis use
`weight="fill"`.

```tsx
// blocks/cards/CheckListCard/index.tsx
<CheckCircleIcon className="size-5 shrink-0 text-success-soft-foreground" />

// StatusChip — forcing one size on whatever icon the caller passes in
<span className="shrink-0 [&_svg]:size-4">{icon}</span>
```
