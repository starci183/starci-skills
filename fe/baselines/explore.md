# Explore baseline

## Definition

This is the approved product and migration baseline for Dashboard Explore. It applies when the
request says to preserve, fork, port, or match the legacy Explore experience. Generic visual and
component grammar remains owned by canon and design documents; this file records only the product
shape and evidence that make Explore recognisable.

The deciding question is: does the change preserve legacy Explore's product story and backend-backed
states without inventing interface or data?

The primary legacy evidence is:

- `starci-academy/src/components/pages/DashboardPage/ExploreTab/index.tsx`;
- its `FeedTabs`, `TrendingContents`, and `WhoToFollow` descendants;
- `starci-academy/src/components/blocks/feed/ActivityFeed`;
- the feed, trending-content, suggested-user, follow, reaction, and route-resolution operations those
  components call.

## Rules

### EXPLORE-1 — Fidelity is the first constraint when preservation is requested

When the request names legacy Explore or asks to preserve, fork, port, or match it, read the actual
legacy source and inspect its rendered behaviour before designing. Preserve composition, content
priority, states, interaction, and responsive intent. The new architecture may relocate ownership,
but it does not authorize a redesign. Follow [`mode.md`](../creativity/mode.md) and
[`refactor-parity/INDEX.md`](../governance/refactor-parity/INDEX.md).

### EXPLORE-2 — Preserve the product sequence and behaviour

Explore presents discovery before people suggestions. Discovery contains trending content, an
audience scope, a content-category filter, and the activity stream. The activity stream preserves
cursor pagination, day grouping, consecutive milestone roll-up, reactions, distinct filtered-empty
and platform-empty outcomes, and independent loading and failure states. A later-page failure keeps
the rows already loaded visible and offers an inline retry; it never replaces the feed with the
initial-error state. People suggestions preserve
backend order, pending and optimistic follow behaviour, and hide after a settled empty result. A
successful follow keeps the suggested identity in place and changes that row to the settled
"Following" state; it does not remove the row or reorder the list. A failed mutation rolls the
optimistic row state back.

### EXPLORE-3 — Populated states come from backend data and realistic seeds

Trending content, activity, reactions, and people suggestions come from backend operations. A page or
pure component must not hardcode plausible rows to make Explore look populated. Development seeds
must make populated Explore credible across its scopes and categories while leaving honest loading,
empty, and failure states observable. Seeded identities must satisfy the public GraphQL contract, and
suggestion queries must exclude malformed legacy identities rather than letting one nullable row
collapse an otherwise valid non-null result list. Treat backend behaviour and realistic seeds as business truth
under [`best-belief-source.md`](../creativity/best-belief-source.md).

### EXPLORE-4 — Internal journeys use the application router

Explore adds nothing here. Internal navigation is governed by
[`VENDOR-14`](../canon/patterns/vendor-boundary.md), which a rule module enforces, and the only
Explore-specific part is which destinations need resolving before the action is reported: a feed
row, a trending item and a suggested identity each resolve a product route at the connected
boundary rather than carrying one.

### EXPLORE-5 — Visible StarCi copy says content, never lesson

All user-visible Explore copy follows
the archived product-vocabulary evidence in
[`exception/changelog.md`](../governance/exception/changelog.md#internal-source-evidence-preserved--non-normative).
An upstream API, persistence field, or event name may retain `lesson`; the connected boundary maps it
to `content` before it becomes visible.

### EXPLORE-6 — Icons identify reference-backed peers; they do not decorate business concepts

Apply [`ICON-3`, `ICON-10`, and `ICON-12`](../canon/patterns/icon.md): a regular icon is `size-5`;
tiny inline marks are only generic status or action marks carried by the reference; business concepts
do not gain decorative tiny icons. A leading icon belongs where it helps distinguish heterogeneous
peers such as navigation or a list, not on a lone business summary.

### EXPLORE-7 — Existing presentation laws remain the single source of truth

Explore creates no local spacing, supporting-copy, or nested-surface exception. Apply
[`gap`](../principles/gap/INDEX.md), [`TYPESET-7`](../canon/patterns/typography.md), and
[`surface-in-surface/INDEX.md`](../principles/surface-in-surface/INDEX.md) directly instead of restating their values
here.

## Forbidden

| Never | Why it is refused | Instead |
|---|---|---|
| Reinterpret legacy composition during a parity request | It silently turns migration into redesign | Port the evidenced composition first; propose redesign separately |
| Hardcode frontend rows that resemble real Explore data | It creates a convincing but false backend state | Query the backend and add realistic development seeds |
| Use `href`, an anchor, or a framework link for a StarCi-internal journey | It bypasses the application's routing boundary | Report the action and use `router.push` at the connected boundary |
| Render `lesson` in visible StarCi copy | It violates the approved product vocabulary | Map boundary copy to `content` |
| Add a tiny feature or business icon for decoration | It creates noise and a false visual index | Use a regular `size-5` icon only where reference or peer identification requires one; keep tiny marks generic |
| Copy spacing, typography, or nested-surface rules into Explore | Duplicate law drifts from canon | Link to and apply the owning canon or design document |

## Examples

### Preserve before translating architecture

Correct:

> Read the legacy Explore tab, feed controls, trending section, activity grouping, and people
> suggestions; inspect the rendered states; then express the same product story through the current
> block, branch, shell, and leaf boundaries.

Incorrect:

> Build a plausible discovery grid from a screenshot and call it the Explore port.

### Keep populated states real

Correct:

```ts
const feed = useMyFeedQuery(scope, category)
const suggestions = useSuggestedUsersQuery()
```

Back those queries with realistic development seeds for trending items, activities, reactions, and
follow suggestions.

Incorrect:

```ts
const feed = [{ title: "Popular lesson" }]
```

### Route internally through the connected boundary

Correct:

```tsx
<_ExploreItem on={{ open: () => router.push(route) }} />
```

Incorrect:

```tsx
<a href={route}>Open</a>
```

### Apply vocabulary and icon law together

Correct:

> “Continue content” is visible copy. A navigation peer may have its reference-backed `size-5`
> leading icon; a business fact remains text-only.

Incorrect:

> “Continue lesson” is paired with a decorative tiny book icon.

### Reuse presentation law

Correct:

> Choose seams from `gap/INDEX.md`, render supporting `text-xs` through `TYPESET-7`, and use the documented
> border treatment for a nested surface.

Incorrect:

> Add Explore-only spacing, muted-copy, and surface-nesting rules that repeat canon.
