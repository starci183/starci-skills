# StarCi Core — Control state

This file maps the `CONTROL-STATE-n` rules to the live Core family: how a control carries pending,
unavailable, unresolved, and persistent state through the published props, and what Core paints.
`gap` in the last column means Common publishes no owner for the case.

## CONTROL-STATE-1 — Stable identity through action state

An action keeps its name and its element while it moves from idle to accepted work to a result.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | A command accepts work | `Button isPending` → HeroUI `isDisabled` and `isPending`, `data-action-pending="true"`, an `aria-hidden` `Spinner` in place of `startContent`, `endContent` dropped, the label `children` kept inside a span with `aria-busy`; `TextAction isPending` → `disabled` on its native `button`, `aria-busy`, the same spinner swap, plus a 300ms press lock that refuses a second `onPress` | Spinner colour is `current`; Core adds no pending paint |
| Case 2 | A destination is pending | `Button href` and `TextAction href` render an anchor that keeps `role="link"`, sets `aria-disabled`, and withholds `href` and `onFollow` while pending or disabled; the element never becomes a button | Inherited unchanged |
| Case 3 | A whole-surface action is pending | `SurfaceCard state="pending"` sets `data-grammar-state="pending"`, withholds the overlay link's `href` with `tabIndex={-1}` and `aria-disabled`, or `disabled` on the overlay button, and suppresses `isHighlight` | Common CSS sets `cursor: progress`; Core paints nothing further |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/branch/SurfaceCard/index.tsx

## CONTROL-STATE-2 — Unavailable is not pending

Unavailable, accepted work, and unresolved initial content are three inputs, never derived from one
another.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Three separate inputs on an action | `Button` and `TextAction` publish `isDisabled`, `isPending`, and `isSkeleton`; all three block activation; only pending emits `aria-busy` and `data-action-pending`; only skeleton hides the label (`Button` anchor `aria-hidden`, shimmer class; `TextAction` an `aria-hidden` span with `data-loading="true"`) | Inherited unchanged |
| Case 2 | A field | `Input` publishes `isDisabled` and `isSkeleton`, not pending; skeleton renders two HeroUI `Skeleton` blocks under `data-state="skeleton"` and no label or control | Inherited unchanged |
| Case 3 | Other owners | `IconButton`: `isDisabled`, `isSkeleton`; `Badge`, `Icon`: `isSkeleton`; `SurfaceCard state="unavailable"` → `data-grammar-state="unavailable"` at `var(--starci-core-disabled-opacity, 0.55)` | Core sets no `--starci-core-disabled-opacity`; the fallback applies |
| Case 4 | The one-time-code field | `gap` — `OtpInput` publishes `disabled` and `invalid` (not the `isDisabled`/`isError` names) and no skeleton input, so its unresolved state has no owner | Nothing to paint |

Source: packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Input/index.tsx; packages/grammar/src/core/OtpInput.tsx

## CONTROL-STATE-3 — Persistent state has its own value

A persistent selection is one application value driven through the Common owner, never a second
DOM-local state.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Peer views | `Tabs selectedKey` (required) and `onSelect(key)`; `items` is the ordered inventory; `panelId` writes `aria-controls` on each tab, both as a prop and again in a layout effect once the client is ready; HeroUI supplies `aria-selected` and roving keyboard behaviour | Core adds no scoped tab rule |
| Case 2 | A current destination | `TextAction isCurrent` → `aria-current="page"` when `appearance="route"`, otherwise `aria-current="true"`, plus `data-current="true"`; the `route`, `choice`, `section`, and `tab` appearances change weight, fill, or a 2px bottom border on current | Fills resolve through `--accent-soft` and `--accent`, which Core binds for `--accent` only |
| Case 3 | A controlled disclosure | `SurfaceAccordionCard` takes `isOpen`/`onOpenChange` or `items[].isOpen`/`onItemOpenChange` and emits `data-grammar-disclosure-state="open|closed"` per row; HeroUI `Accordion.Root expandedKeys` is derived from those props | Inherited unchanged |
| Case 4 | Before hydration | `Tabs` renders an `aria-hidden` placeholder (`data-grammar-tabs-client="pending"`) until mounted, so selection is observable only once `ready` | Inherited unchanged |

Source: packages/grammar/src/core/branch/Tabs/index.tsx; packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/actionStyles.ts; packages/grammar/src/core/branch/SurfaceAccordionCard/index.tsx

## CONTROL-STATE-4 — Evidence and falsifiers

Every reachable control state is proved from the rendered attributes, callback counts, and
settlement, not from class names.

| Case | Rule | Common owner | Core realization |
| --- | --- | --- | --- |
| Case 1 | Attributes to capture | `data-action-pending`, `aria-busy`, `disabled` or `aria-disabled`, `data-loading`, `data-state="skeleton"`, `aria-selected`, `aria-current`, `data-current`, `data-grammar-state`, `data-grammar-disclosure-state` | Core emits no attribute of its own beyond `data-grammar-family="core"` on the root |
| Case 2 | Callback counts | `TextAction` command path refuses a second `onPress` for 300ms and while unavailable; `Button` withholds `onPress` entirely while unavailable; whole-card overlays withhold `href` or set `disabled` | Inherited unchanged |
| Case 3 | Layer attribution | Isolated Common output, then the Core delta (token bindings and the one labelled-card rule in `core/styles.css`), then the application delta | The Core delta is small enough to diff against `core/styles.css` directly |

Source: packages/grammar/src/core/primitive/TextAction/index.tsx; packages/grammar/src/core/primitive/Button/index.tsx; packages/grammar/src/core/styles.css
