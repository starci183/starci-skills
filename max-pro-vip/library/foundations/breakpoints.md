---
name: breakpoints
tier: foundations
admitted: 2026-07-30
---

# Breakpoints

## Role

The viewport-width ladder Tailwind's `sm:`/`md:`/`lg:`/`xl:`/`2xl:` variants key off. It decides
which rule applies at which **window** width. It does not decide container-query breakpoints —
those are a separate ladder, sharing lookalike names, covered below because the collision is the
single biggest trap in this scale.

## Source of truth

Tailwind v4's built-in defaults, `node_modules/tailwindcss/theme.css` (`--breakpoint-sm/md/lg/xl/2xl`).
Not overridden: no `--breakpoint-*` declaration in `globals.css`, no `tailwind.config.*` file in the
repo. Every step is Tailwind's own hand-set constant — there is no app root and nothing here is
derived.

## Scale

| Step | Value | Derived as | Means |
|---|---|---|---|
| `sm:` | 640px (40rem) | Tailwind default, not derived | the mobile/desktop cut most rules key off — hide/show tab labels, switch input variants |
| `md:` | 768px (48rem) | Tailwind default, not derived | rarely load-bearing on its own — the zone between "not mobile" and "not yet `lg`" |
| `lg:` | 1024px (64rem) | Tailwind default, not derived | the rail/2-pane opening boundary for anything living **outside** the app shell |
| `xl:` | 1280px (80rem) | Tailwind default, not derived | — |
| `2xl:` | 1536px (96rem) | Tailwind default, not derived | — |

None of the five derive from anything — they are Tailwind's own literals and the app leaves them
untouched. The trap is not inside this table; it is a second, lookalike scale living next to it.

**`globals.css` defines a parallel container-query scale, pinned to the same pixel numbers, for a
real reason:** the app shell is a left column that a docked panel (the content-AI rail) can narrow
at will, so anything living inside the shell must respond to the **column's** width, not the
window's. `@theme { --container-app-sm: 40rem; --container-app-md: 48rem; --container-app-lg: 64rem;
--container-app-xl: 80rem; }` gives `@app-sm:`/`@app-md:`/`@app-lg:`/`@app-xl:` variants at the exact
same pixel values as the viewport scale above (there is no `@app-2xl:`). Anything inside the shell
should use `@app-*:`; anything rendered outside it — modal/drawer shells, toasts, other fixed
overlays — correctly keeps the plain viewport variant.

**Collision 1 — same pixel value, different box measured:** `lg:` (viewport, 1024px) and `@app-lg:`
(container, also pinned to 1024px) resolve to the same number today. `lg:` measures the browser
window; `@app-lg:` measures the shell column. Using `lg:` on something that lives inside the shell
will look right until the content-AI rail actually narrows the column — then it silently keeps the
wide-window layout because the window itself never shrank.

**Collision 2 — same name pattern, different pixel value, and this one is already live in the
codebase:** Tailwind v4 also ships its **own** built-in container scale under the bare `@sm:`/`@md:`/
`@lg:`/`@xl:` names (`--container-sm: 24rem` … `--container-lg: 32rem` in `theme.css` — **half** of
`@app-lg`'s 64rem). These bare container variants are already used correctly elsewhere in the
codebase for genuinely local container queries (`GroupPressableCard`, `LessonPager`,
`TalentDirectory` — a grid sizing itself off its own immediate wrapper, unrelated to the shell).
Typing `@lg:` when the intent was `@app-lg:` compiles with no error and applies at half the intended
width — this exact trap is called out by name in the `globals.css` comment next to the
`--container-app-*` block.

## How steps relate

Each step is an independent Tailwind default; no formula connects them. The relation that matters
is not between steps but between **scales**: viewport (`sm:`…), shell-container (`@app-sm:`…), and
Tailwind's own local-container (`@sm:`…) are three different ladders that happen to overlap in name
or in number. Which one a given class variant means depends entirely on whether the element sits
inside the app shell, outside it, or is doing its own unrelated local container query.

## Forbidden

| Forbidden | Caught by |
|---|---|
| typing bare `@sm:`/`@md:`/`@lg:`/`@xl:` intending the shell-relative breakpoint | nothing — compiles clean, silently applies at half the intended pixel width |
| using plain viewport `sm:`/`md:`/`lg:`/`xl:` on something that lives inside the app shell column | nothing — looks correct until the content-AI rail narrows the shell |
| inventing an arbitrary breakpoint (`min-[900px]`) when one of the five already fits | nothing — arbitrary values compile fine |

## Read by which axes

Layout/shell decision sheets that place things inside vs. outside the app shell — rail behavior,
sidebar collapse, tab-label hide/show — must first decide which of the three scales applies before
picking a step.

## Anchors

`node_modules/tailwindcss/theme.css` for both the viewport `--breakpoint-*` defaults and Tailwind's
own `--container-*` defaults. `globals.css` (`@theme` block, "Container breakpoints that MIRROR the
viewport scale") for the `--container-app-*` declarations and the explicit warning against the
`lg:` → `@lg:` rename trap. `src/hooks/reuseables/useSmViewpoint.ts` for the JS-side mirror
(`isMobile` ≤640px, `isTablet` ≤768px, `isDesktop` ≥1024px). Confirmed bare local-container usage in
`GroupPressableCard`, `LessonPager`, `TalentDirectory`.
